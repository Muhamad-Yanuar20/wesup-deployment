-- A checkout failure is not cancellation of the buyer's registration.
-- Apply before deploying the payment continuation UI. No existing data is changed.
create or replace function public.guard_payment_cancellation()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_batch_status public.batch_status;
  v_deadline timestamptz;
begin
  if new.status <> 'cancelled' or old.status not in ('registered','pending_payment') or old.status = new.status then
    return new;
  end if;
  select b.status,coalesce(t.effective_payment_closes_at,t.payment_closes_at)
    into v_batch_status,v_deadline
    from public.batches b join public.batch_timeline t on t.batch_id=b.id
    where b.id=new.batch_id;
  if v_batch_status in ('cancelled','takedown') then
    new.cancellation_reason := coalesce(nullif(new.cancellation_reason,''),case when v_batch_status='takedown' then 'takedown' else 'supplier_cancel' end);
    return new;
  end if;
  if old.status='registered' and new.cancellation_reason='buyer_withdrawal' then
    if exists(select 1 from public.batches b join public.batch_timeline t on t.batch_id=b.id where b.id=new.batch_id and b.status='published' and clock_timestamp()<t.registration_closes_at) then
      return new;
    end if;
    raise exception 'registration withdrawal is closed' using errcode='55000';
  end if;
  if v_deadline is null or clock_timestamp()<v_deadline then
    raise exception 'payment window still open; registration cannot be cancelled' using errcode='55000';
  end if;
  if exists(select 1 from public.payments p where p.registration_id=new.id and
    (p.status='paid' or exists(select 1 from public.payment_attempts a where a.payment_id=p.id and a.status in ('pending','paid')))) then
    raise exception 'payment must be reconciled before cancellation' using errcode='55000';
  end if;
  new.cancellation_reason := case when new.payment_penalty_exempt then 'verified_disruption' else 'payment_deadline' end;
  return new;
end;
$$;
revoke all on function public.guard_payment_cancellation() from public,anon,authenticated;
create trigger payment_cancellation_guard before update of status on public.registrations
for each row execute function public.guard_payment_cancellation();

create or replace function public.record_registration_status_event()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_source text := nullif(current_setting('app.operation',true),'');
  v_request_id text := nullif(current_setting('app.request_id',true),'');
begin
  if tg_op='INSERT' then
    insert into public.registration_status_events(registration_id,from_status,to_status,source,actor_id)
      values(new.id,null,new.status,'registration_created',auth.uid());
  elsif old.status is distinct from new.status then
    insert into public.registration_status_events(registration_id,from_status,to_status,source,actor_id,metadata)
      values(new.id,old.status,new.status,
        coalesce(v_source,case when new.status='cancelled' then 'cancellation:'||coalesce(new.cancellation_reason,'unknown') else 'status_update' end),auth.uid(),
        jsonb_strip_nulls(jsonb_build_object('reason',new.cancellation_reason,'operation',v_source,'request_id',v_request_id)));
  end if;
  return new;
end;
$$;

create or replace function public.apply_midtrans_payment_event(
  p_payment_attempt_id uuid,
  p_provider_status text,
  p_provider_transaction_id text default null,
  p_payment_type text default null,
  p_fraud_status text default null,
  p_payload jsonb default '{}'::jsonb
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_attempt public.payment_attempts%rowtype;
  v_payment public.payments%rowtype;
  v_registration public.registrations%rowtype;
  v_batch public.batches%rowtype;
  v_was_paid boolean;
  v_result_status public.registration_status;
  v_new_payment_status public.payment_status;
begin
  if auth.uid() is not null and not public.is_admin() then
    raise exception 'service role required' using errcode = '42501';
  end if;

  if lower(coalesce(p_provider_status, '')) not in (
    'pending', 'settlement', 'capture', 'expire', 'deny', 'cancel',
    'refund', 'partial_refund', 'chargeback', 'partial_chargeback', 'authorize'
  ) then
    raise exception 'unsupported Midtrans transaction status' using errcode = '22023';
  end if;

  select * into v_attempt
    from public.payment_attempts
   where id = p_payment_attempt_id
   for update;
  if not found then raise exception 'payment attempt not found' using errcode = 'P0002'; end if;

  select p.* into v_payment
    from public.payments p
   where p.id = v_attempt.payment_id
   for update;
  select r.* into v_registration
    from public.registrations r
   where r.id = v_payment.registration_id
   for update;
  select b.* into v_batch from public.batches b where b.id = v_registration.batch_id;
  v_was_paid := v_payment.status = 'paid' or v_attempt.status = 'paid';

  -- Late unsuccessful events cannot downgrade a confirmed settlement.
  if v_was_paid and lower(p_provider_status) in ('pending','expire','deny','cancel','authorize') then
    return jsonb_build_object('processed',false,'duplicate',true,'registrationStatus',v_registration.status);
  end if;

  update public.payment_attempts
     set provider_status = lower(p_provider_status),
         payment_type = coalesce(nullif(trim(p_payment_type), ''), payment_type),
         provider_fraud_status = coalesce(nullif(trim(p_fraud_status), ''), provider_fraud_status),
         provider_transaction_id = coalesce(nullif(trim(p_provider_transaction_id), ''), provider_transaction_id),
         provider_payload = case when p_payload = '{}'::jsonb then provider_payload else p_payload end,
         updated_at = now()
   where id = v_attempt.id;

  if lower(p_provider_status) in ('settlement', 'capture')
     and (p_fraud_status is null or lower(p_fraud_status) = 'accept') then
    if v_was_paid then
      return jsonb_build_object('processed', false, 'duplicate', true, 'registrationStatus', v_registration.status);
    end if;

    if v_registration.status = 'cancelled'
       or v_batch.status in ('cancelled', 'takedown') then
      update public.payments
         set status = 'paid',
             midtrans_transaction_id = coalesce(p_provider_transaction_id, midtrans_transaction_id),
             paid_at = coalesce(paid_at, now()),
             webhook_payload = p_payload,
             reconciled_at = now(),
             updated_at = now()
       where id = v_payment.id and status <> 'refunded';
      update public.registrations set status = 'refund_pending', updated_at = now()
       where id = v_registration.id and status in ('registered', 'pending_payment', 'cancelled', 'paid');
      insert into public.escrow_holds (registration_id, amount, status, pickup_confirmed_at, auto_release_at, release_destination)
        values (v_registration.id, v_registration.final_amount, 'held', null, null, 'umkm')
        on conflict (registration_id) do nothing;
      update public.escrow_holds
         set status = 'frozen', release_destination = 'umkm'
       where registration_id = v_registration.id and status = 'held';
      insert into public.refund_requests (registration_id, batch_id, trigger_type, amount, status)
        values (v_registration.id, v_registration.batch_id, 'force_majeure', v_registration.final_amount, 'pending')
        on conflict (registration_id) do nothing;
      update public.payment_attempts set status = 'paid', updated_at = now() where id = v_attempt.id;
      insert into public.notifications (user_id, type, title, message, data)
        values (v_registration.umkm_id, 'refund', 'Pembayaran diterima, refund diproses',
                'Pembayaran diterima setelah pesanan dibatalkan. Dana masuk antrean refund manual.',
                jsonb_build_object('registration_id', v_registration.id, 'payment_attempt_id', v_attempt.id))
        on conflict do nothing;
      perform public.record_transaction_log(
        v_registration.id, v_payment.id, v_attempt.id,
        'payment_status_change', v_payment.status::text, 'paid',
        lower(p_provider_status), p_provider_transaction_id, 'webhook', p_payload);
      return jsonb_build_object('processed', true, 'registrationStatus', 'refund_pending', 'refundPending', true);
    end if;

    update public.payments
       set status = 'paid',
           midtrans_transaction_id = coalesce(p_provider_transaction_id, midtrans_transaction_id),
           paid_at = coalesce(paid_at, now()),
           webhook_payload = p_payload,
           reconciled_at = now(),
           updated_at = now()
     where id = v_payment.id and status <> 'refunded';
    update public.registrations
       set status = 'paid', updated_at = now()
     where id = v_registration.id and status in ('registered', 'pending_payment');
    insert into public.escrow_holds (registration_id, amount, status, pickup_confirmed_at, auto_release_at)
      values (v_registration.id, v_registration.final_amount, 'held', null, null)
      on conflict (registration_id) do nothing;
    update public.payment_attempts set status = 'paid', updated_at = now() where id = v_attempt.id;
    select status into v_result_status from public.registrations where id = v_registration.id;
    insert into public.notifications (user_id, type, title, message, data)
      values (v_registration.umkm_id, 'payment_success', 'Pembayaran berhasil',
              'Pembayaran tagihan Anda telah dikonfirmasi. Pesanan menunggu persiapan Supplier.',
              jsonb_build_object('registration_id', v_registration.id, 'payment_attempt_id', v_attempt.id))
      on conflict do nothing;
    perform public.record_transaction_log(
      v_registration.id, v_payment.id, v_attempt.id,
      'payment_status_change', v_payment.status::text, 'paid',
      lower(p_provider_status), p_provider_transaction_id, 'webhook', p_payload);
    return jsonb_build_object('processed', true, 'registrationStatus', v_result_status, 'escrow', 'held');
  end if;

  -- Provider refunds and chargebacks after settlement suspend the supplier balance.
  -- The escrow trigger moves any available balance back into the frozen bucket and
  -- an admin alert is emitted for manual reconciliation.
  if lower(p_provider_status) in ('refund', 'partial_refund', 'chargeback', 'partial_chargeback') then
    v_new_payment_status := case when lower(p_provider_status) in ('refund', 'chargeback')
      then 'refunded'::public.payment_status else v_payment.status end;
    update public.payments
       set status = v_new_payment_status,
           webhook_payload = p_payload,
           reconciled_at = now(),
           updated_at = now()
     where id = v_payment.id;
    update public.escrow_holds
       set status = 'frozen', release_destination = null
     where registration_id = v_registration.id
       and status in ('held', 'released', 'forfeited');
    insert into public.notifications (user_id, type, title, message, data)
      select id, 'refund'::public.notification_type, 'Rekonsiliasi pembayaran diperlukan',
             'Midtrans mengirim pembaruan refund/chargeback. Saldo Supplier dibekukan sampai Admin menyelesaikan rekonsiliasi.',
             jsonb_build_object('registration_id', v_registration.id, 'payment_attempt_id', v_attempt.id, 'provider_status', lower(p_provider_status))
        from public.profiles
       where role = 'admin';
    perform public.record_transaction_log(
      v_registration.id, v_payment.id, v_attempt.id,
      'payment_status_change', v_payment.status::text, v_new_payment_status::text,
      lower(p_provider_status), p_provider_transaction_id, 'webhook', p_payload);
    return jsonb_build_object('processed', true, 'frozen', true, 'registrationStatus', v_registration.status);
  end if;
  if lower(p_provider_status) in ('expire', 'deny', 'cancel') then
    update public.payment_attempts
       set status = case when lower(p_provider_status) = 'expire' then 'expired'::public.payment_status else 'failed'::public.payment_status end,
           updated_at = now()
     where id = v_attempt.id and status <> 'paid';
    perform public.record_transaction_log(
      v_registration.id, v_payment.id, v_attempt.id,
      'gateway_event', v_payment.status::text, null,
      lower(p_provider_status), p_provider_transaction_id, 'webhook', p_payload);
  end if;

  return jsonb_build_object('processed', true, 'registrationStatus', v_registration.status, 'providerStatus', lower(p_provider_status));
end;
$$;
