-- Transaction log: append-only payment status transitions + gateway events.
-- Tracks Pending -> Paid -> Refunded (and escrow-relevant outcomes) per order
-- and records payment-gateway data for reconciliation auditing.
-- No scheduled jobs are introduced; rows are written explicitly by the
-- authoritative payment paths (webhook / reconcile RPCs).
-- ============================================================

create table if not exists public.transaction_logs (
  id uuid primary key default gen_random_uuid(),
  registration_id uuid not null references public.registrations (id) on delete cascade,
  payment_id uuid references public.payments (id),
  payment_attempt_id uuid references public.payment_attempts (id),
  event_type text not null check (event_type in ('payment_status_change', 'gateway_event')),
  from_status public.payment_status,
  to_status public.payment_status,
  provider_status text,
  gateway_transaction_id text,
  payload jsonb not null default '{}'::jsonb,
  source text not null check (source in ('webhook', 'reconcile', 'system', 'manual')),
  actor_id uuid references public.profiles (id),
  created_at timestamptz not null default now()
);

alter table public.transaction_logs enable row level security;

create policy "transaction_logs_umkm_select" on public.transaction_logs
  for select to authenticated using (exists (
    select 1 from public.registrations r where r.id = registration_id and r.umkm_id = auth.uid()
  ));
create policy "transaction_logs_supplier_select" on public.transaction_logs
  for select to authenticated using (exists (
    select 1 from public.registrations r
    join public.batches b on b.id = r.batch_id
    where r.id = registration_id and b.supplier_id = auth.uid()
  ));
create policy "transaction_logs_admin_all" on public.transaction_logs
  for all to authenticated using (public.is_admin());

create index if not exists transaction_logs_registration_created_idx
  on public.transaction_logs (registration_id, created_at desc);
create index if not exists transaction_logs_payment_idx
  on public.transaction_logs (payment_id, created_at desc);

-- ============================================================
-- record_transaction_log: SECURITY DEFINER writer. Only service-role
-- server code may append; browser clients are limited to role-aware SELECT.
-- ============================================================
create or replace function public.record_transaction_log(
  p_registration_id uuid,
  p_payment_id uuid,
  p_payment_attempt_id uuid,
  p_event_type text,
  p_from_status text,
  p_to_status text,
  p_provider_status text,
  p_gateway_transaction_id text,
  p_source text,
  p_payload jsonb default '{}'::jsonb
) returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
begin
  if auth.uid() is not null and not public.is_admin() then
    raise exception 'service role required' using errcode = '42501';
  end if;
  if p_event_type not in ('payment_status_change', 'gateway_event') then
    raise exception 'invalid event type' using errcode = '22023';
  end if;
  if p_source not in ('webhook', 'reconcile', 'system', 'manual') then
    raise exception 'invalid source' using errcode = '22023';
  end if;
  insert into public.transaction_logs
    (registration_id, payment_id, payment_attempt_id, event_type,
     from_status, to_status, provider_status, gateway_transaction_id,
     payload, source, actor_id)
  values
    (p_registration_id, p_payment_id, p_payment_attempt_id, p_event_type,
     p_from_status::public.payment_status, p_to_status::public.payment_status,
     p_provider_status, p_gateway_transaction_id,
     p_payload, p_source, auth.uid())
  returning id into v_id;
  return v_id;
end;
$$;

revoke execute on function public.record_transaction_log(uuid, uuid, uuid, text, text, text, text, text, text, jsonb) from public, anon, authenticated;
grant execute on function public.record_transaction_log(uuid, uuid, uuid, text, text, text, text, text, text, jsonb) to service_role;

-- ============================================================
-- Re-define apply_midtrans_payment_event to record each authoritative
-- outcome in transaction_logs. Existing behaviour is preserved.
-- ============================================================
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
       where id = v_registration.id and status = 'cancelled';
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
      select public.record_transaction_log(
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
    select public.record_transaction_log(
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
    select public.record_transaction_log(
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
    select public.record_transaction_log(
      v_registration.id, v_payment.id, v_attempt.id,
      'gateway_event', v_payment.status::text, null,
      lower(p_provider_status), p_provider_transaction_id, 'webhook', p_payload);
  end if;

  return jsonb_build_object('processed', true, 'registrationStatus', v_registration.status, 'providerStatus', lower(p_provider_status));
end;
$$;

revoke execute on function public.apply_midtrans_payment_event(uuid, text, text, text, text, jsonb) from public, anon, authenticated;
grant execute on function public.apply_midtrans_payment_event(uuid, text, text, text, text, jsonb) to service_role;