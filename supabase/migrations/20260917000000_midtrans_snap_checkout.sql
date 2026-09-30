-- Midtrans Snap multi-method checkout and authoritative payment events.
-- Additive: existing Core API QRIS attempts remain readable and payable.

alter table public.payment_attempts
  add column if not exists integration_type text not null default 'core_qris',
  add column if not exists provider_status text,
  add column if not exists payment_type text,
  add column if not exists provider_fraud_status text;

alter table public.payment_attempts
  drop constraint if exists payment_attempts_integration_type_check;
alter table public.payment_attempts
  add constraint payment_attempts_integration_type_check
  check (integration_type in ('core_qris', 'snap'));

create index if not exists payment_attempts_provider_order_idx
  on public.payment_attempts (provider_order_id);

create table if not exists public.payment_checkout_sessions (
  id uuid primary key default gen_random_uuid(),
  payment_attempt_id uuid not null unique references public.payment_attempts (id) on delete cascade,
  snap_token text not null,
  redirect_url text,
  expires_at timestamptz not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  cancelled_at timestamptz
);

alter table public.payment_checkout_sessions enable row level security;
alter table public.payment_checkout_sessions force row level security;
revoke select, insert, update, delete on table public.payment_checkout_sessions from public, anon, authenticated;
grant all on table public.payment_checkout_sessions to service_role;

-- Snap tokens are intentionally kept out of the exposed order read models.
-- The server-side charge route reads this table with service_role and returns
-- only the token belonging to the authenticated order owner.

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
    return jsonb_build_object('processed', true, 'registrationStatus', v_result_status, 'escrow', 'held');
  end if;

  -- Provider refunds and chargebacks after settlement suspend the supplier balance.
  -- The escrow trigger moves any available balance back into the frozen bucket and
  -- an admin alert is emitted for manual reconciliation.
  if lower(p_provider_status) in ('refund', 'partial_refund', 'chargeback', 'partial_chargeback') then
    update public.payments
       set status = case when lower(p_provider_status) in ('refund', 'chargeback') then 'refunded'::public.payment_status else status end,
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
    return jsonb_build_object('processed', true, 'frozen', true, 'registrationStatus', v_registration.status);
  end if;
  if lower(p_provider_status) in ('expire', 'deny', 'cancel') then
    update public.payment_attempts
       set status = case when lower(p_provider_status) = 'expire' then 'expired'::public.payment_status else 'failed'::public.payment_status end,
           updated_at = now()
     where id = v_attempt.id and status <> 'paid';
  end if;

  return jsonb_build_object('processed', true, 'registrationStatus', v_registration.status, 'providerStatus', lower(p_provider_status));
end;
$$;

revoke execute on function public.apply_midtrans_payment_event(uuid, text, text, text, text, jsonb) from public, anon, authenticated;
grant execute on function public.apply_midtrans_payment_event(uuid, text, text, text, text, jsonb) to service_role;

-- Provider refunds can arrive after a pickup release. Re-define the ledger
-- trigger so a released/forfeited hold is debited from `available` when it is
-- frozen again; this keeps payout checks conservative.
create or replace function public.record_supplier_escrow_ledger()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_supplier_id uuid;
  v_from text;
  v_to text;
  v_type text;
  v_key text;
begin
  select b.supplier_id into v_supplier_id
    from public.registrations r
    join public.batches b on b.id = r.batch_id
   where r.id = new.registration_id;
  if v_supplier_id is null then return new; end if;

  if tg_op = 'INSERT' and new.status = 'held' then
    v_from := null; v_to := 'escrow'; v_type := 'escrow_created';
  elsif tg_op = 'UPDATE' and old.status is distinct from new.status then
    if new.status = 'frozen' then
      v_from := case old.status
        when 'held' then 'escrow'
        when 'released' then 'available'
        when 'forfeited' then 'available'
        when 'frozen' then 'frozen'
        when 'refunded' then 'refunded'
        else null end;
      v_to := 'frozen'; v_type := 'escrow_frozen';
    elsif new.status in ('released', 'forfeited') and new.release_destination = 'supplier' then
      v_from := case old.status when 'held' then 'escrow' when 'frozen' then 'frozen' else 'available' end;
      v_to := 'available'; v_type := case when new.status = 'forfeited' then 'escrow_forfeited' else 'escrow_released' end;
    elsif new.status = 'refunded' then
      v_from := case old.status when 'held' then 'escrow' when 'frozen' then 'frozen' else 'available' end;
      v_to := 'refunded'; v_type := 'escrow_refunded';
    else
      return new;
    end if;
  else
    return new;
  end if;

  if v_from is null and v_to is null then return new; end if;
  v_key := format('%s:%s:%s:%s', v_type, new.registration_id, coalesce(old.status::text, 'none'), coalesce(new.released_at::text, new.created_at::text));
  insert into public.supplier_ledger_entries (supplier_id, registration_id, from_bucket, to_bucket, amount, entry_type, idempotency_key)
  values (v_supplier_id, new.registration_id, v_from, v_to, new.amount, v_type, v_key)
  on conflict (idempotency_key) do nothing;
  return new;
end;
$$;