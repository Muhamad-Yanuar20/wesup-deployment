-- Supplier batch transaction lifecycle.
-- Additive migration: preserves the original catalog schedule while storing
-- effective close/payment timestamps for capacity and manual early-close.

alter table public.batches
  add column if not exists capacity_quantity integer,
  add column if not exists payment_window_hours smallint not null default 24,
  add column if not exists registration_closed_at timestamptz,
  add column if not exists close_reason text,
  add column if not exists final_registered_quantity integer,
  add column if not exists locked_tier_number integer,
  add column if not exists locked_unit_price numeric(12, 2),
  add column if not exists invoices_issued_at timestamptz,
  add column if not exists ready_at timestamptz,
  add column if not exists completed_at timestamptz;

alter table public.batches
  drop constraint if exists batches_capacity_quantity_check;
alter table public.batches
  add constraint batches_capacity_quantity_check
  check (capacity_quantity is null or capacity_quantity > 0);

alter table public.batches
  drop constraint if exists batches_payment_window_hours_check;
alter table public.batches
  add constraint batches_payment_window_hours_check
  check (payment_window_hours in (3, 6, 12, 24));

alter table public.batches
  drop constraint if exists batches_close_reason_check;
alter table public.batches
  add constraint batches_close_reason_check
  check (close_reason is null or close_reason in (
    'capacity_reached', 'registration_expired', 'supplier_manual',
    'supplier_cancelled', 'admin_cancelled', 'no_registrations'
  ));

alter table public.batch_timeline
  add column if not exists effective_payment_opens_at timestamptz,
  add column if not exists effective_payment_closes_at timestamptz;

create index if not exists batches_supplier_status_updated_idx
  on public.batches (supplier_id, status, updated_at desc);
create index if not exists registrations_batch_status_created_idx
  on public.registrations (batch_id, status, created_at desc);

-- A status event is written by the database trigger; clients have no insert,
-- update, or delete policy on this append-only audit table.
create table if not exists public.batch_status_events (
  id uuid primary key default gen_random_uuid(),
  batch_id uuid not null references public.batches (id) on delete cascade,
  from_status public.batch_status,
  to_status public.batch_status not null,
  source text not null,
  actor_id uuid references public.profiles (id),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

alter table public.batch_status_events enable row level security;
drop policy if exists "batch_status_events_supplier_select" on public.batch_status_events;
create policy "batch_status_events_supplier_select" on public.batch_status_events
  for select to authenticated using (
    exists (select 1 from public.batches b where b.id = batch_id and b.supplier_id = auth.uid())
    or public.is_admin()
  );
create index if not exists batch_status_events_batch_created_idx
  on public.batch_status_events (batch_id, created_at desc);

create or replace function public.record_batch_status_event()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    insert into public.batch_status_events (batch_id, from_status, to_status, source, actor_id)
    values (new.id, null, new.status, 'batch_created', auth.uid());
  elsif old.status is distinct from new.status then
    insert into public.batch_status_events (batch_id, from_status, to_status, source, actor_id, metadata)
    values (
      new.id,
      old.status,
      new.status,
      coalesce(new.close_reason, 'status_update'),
      auth.uid(),
      jsonb_build_object('registration_closed_at', new.registration_closed_at)
    );
  end if;
  return new;
end;
$$;

drop trigger if exists batch_status_event_insert on public.batches;
create trigger batch_status_event_insert
  after insert or update of status on public.batches
  for each row execute function public.record_batch_status_event();

-- Commercial fields cannot change after the first registration. Tier rows and
-- location/timeline are guarded by the existing catalog RPC; this trigger is
-- the database backstop for capacity, unit, and payment configuration.
create or replace function public.prevent_supplier_commercial_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if exists (select 1 from public.registrations r where r.batch_id = old.id)
     and (
       new.min_quantity is distinct from old.min_quantity
       or new.capacity_quantity is distinct from old.capacity_quantity
       or new.unit is distinct from old.unit
       or new.payment_window_hours is distinct from old.payment_window_hours
     ) then
    raise exception 'commercial batch fields are locked after the first participant'
      using errcode = '55000';
  end if;
  if new.capacity_quantity is not null and new.capacity_quantity < new.min_quantity then
    raise exception 'capacity quantity cannot be below minimum quantity'
      using errcode = '22023';
  end if;
  return new;
end;
$$;

drop trigger if exists supplier_commercial_lock on public.batches;
create trigger supplier_commercial_lock
  before update on public.batches
  for each row execute function public.prevent_supplier_commercial_change();

create table if not exists public.supplier_ledger_entries (
  id uuid primary key default gen_random_uuid(),
  supplier_id uuid not null references public.profiles (id) on delete cascade,
  registration_id uuid references public.registrations (id) on delete set null,
  payout_id uuid,
  from_bucket text check (from_bucket is null or from_bucket in ('escrow', 'frozen', 'available', 'paid_out', 'refunded')),
  to_bucket text check (to_bucket is null or to_bucket in ('escrow', 'frozen', 'available', 'paid_out', 'refunded')),
  amount numeric(12, 2) not null check (amount > 0),
  entry_type text not null,
  idempotency_key text not null unique,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  check (from_bucket is not null or to_bucket is not null)
);

alter table public.supplier_ledger_entries enable row level security;
create policy "supplier_ledger_entries_supplier_select" on public.supplier_ledger_entries
  for select to authenticated using (supplier_id = auth.uid() or public.is_admin());
create index if not exists supplier_ledger_entries_supplier_created_idx
  on public.supplier_ledger_entries (supplier_id, created_at desc);
create index if not exists supplier_ledger_entries_registration_idx
  on public.supplier_ledger_entries (registration_id, created_at desc);

-- supplier_payouts draw from the Supplier's available ledger bucket.
create table if not exists public.supplier_payouts (
  id uuid primary key default gen_random_uuid(),
  supplier_id uuid not null references public.profiles (id) on delete cascade,
  supplier_bank_account_id uuid references public.supplier_bank_accounts (id),
  amount numeric(12, 2) not null check (amount > 0),
  status text not null default 'requested'
    check (status in ('requested', 'approved', 'transferred', 'rejected')),
  bank_account_snapshot jsonb not null,
  transfer_proof_url text,
  requested_at timestamptz not null default now(),
  approved_at timestamptz,
  transferred_at timestamptz,
  processed_by uuid references public.profiles (id),
  notes text,
  idempotency_key text not null unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.supplier_payouts enable row level security;
create policy "supplier_payouts_supplier_select" on public.supplier_payouts
  for select to authenticated using (supplier_id = auth.uid() or public.is_admin());
create index if not exists supplier_payouts_supplier_status_idx
  on public.supplier_payouts (supplier_id, status, created_at desc);

-- Existing supplier catalog policies allowed direct all-writes. The catalog
-- RPCs remain the write surface; reads stay available to the owner/admin.
drop policy if exists "batches_supplier_all" on public.batches;
drop policy if exists "batches_supplier_approved_all" on public.batches;
drop policy if exists "batches_supplier_capability_all" on public.batches;
create policy "batches_supplier_select_own" on public.batches
  for select to authenticated using (supplier_id = auth.uid() or public.is_admin());

-- Tier and timeline rows are also edited only by the catalog RPCs. Keeping
-- SELECT access for the owner preserves the existing supplier read model while
-- preventing a client from bypassing lifecycle/commercial-field validation.
drop policy if exists "batch_tiers_supplier_capability_all" on public.batch_tiers;
drop policy if exists "batch_tiers_supplier_approved_all" on public.batch_tiers;
drop policy if exists "batch_tiers_supplier_all" on public.batch_tiers;
create policy "batch_tiers_supplier_select_own" on public.batch_tiers
  for select to authenticated using (
    exists (
      select 1 from public.batches b
       where b.id = batch_id and (b.supplier_id = auth.uid() or public.is_admin())
    )
  );

drop policy if exists "batch_timeline_supplier_capability_all" on public.batch_timeline;
drop policy if exists "batch_timeline_supplier_approved_all" on public.batch_timeline;
drop policy if exists "batch_timeline_supplier_all" on public.batch_timeline;
create policy "batch_timeline_supplier_select_own" on public.batch_timeline
  for select to authenticated using (
    exists (
      select 1 from public.batches b
       where b.id = batch_id and (b.supplier_id = auth.uid() or public.is_admin())
    )
  );

-- Bank account changes go through upsert_supplier_bank_account so the
-- one-primary-account invariant cannot be bypassed from the browser.
drop policy if exists "supplier_bank_accounts_capability_all" on public.supplier_bank_accounts;
drop policy if exists "supplier_bank_accounts_own_all" on public.supplier_bank_accounts;
create policy "supplier_bank_accounts_supplier_select" on public.supplier_bank_accounts
  for select to authenticated using (supplier_id = auth.uid() or public.is_admin());

-- Ledger movements are generated from escrow transitions. This keeps payment,
-- pickup, no-show, dispute, and auto-release paths idempotent without making
-- every existing RPC know about the new accounting table.
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
      v_from := case when old.status = 'held' then 'escrow' else old.status::text end; v_to := 'frozen'; v_type := 'escrow_frozen';
    elsif new.status in ('released', 'forfeited') and new.release_destination = 'supplier' then
      v_from := case when old.status = 'held' then 'escrow' else old.status::text end; v_to := 'available'; v_type := case when new.status = 'forfeited' then 'escrow_forfeited' else 'escrow_released' end;
    elsif new.status = 'refunded' then
      v_from := case when old.status = 'held' then 'escrow' else old.status::text end; v_to := 'refunded'; v_type := 'escrow_refunded';
    else
      return new;
    end if;
  else
    return new;
  end if;

  v_key := format('%s:%s:%s', v_type, new.registration_id, coalesce(new.released_at::text, new.created_at::text));
  insert into public.supplier_ledger_entries (
    supplier_id, registration_id, from_bucket, to_bucket, amount, entry_type, idempotency_key
  ) values (
    v_supplier_id, new.registration_id, v_from, v_to, new.amount, v_type, v_key
  ) on conflict (idempotency_key) do nothing;
  return new;
end;
$$;

drop trigger if exists supplier_escrow_ledger_insert on public.escrow_holds;
drop trigger if exists supplier_escrow_ledger_update on public.escrow_holds;
create trigger supplier_escrow_ledger_insert
  after insert on public.escrow_holds
  for each row execute function public.record_supplier_escrow_ledger();
create trigger supplier_escrow_ledger_update
  after update of status, release_destination, released_at on public.escrow_holds
  for each row execute function public.record_supplier_escrow_ledger();

create or replace function public.close_batch_and_issue_invoices(
  p_batch_id uuid,
  p_trigger text,
  p_ip_address text default null,
  p_user_agent text default null
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_batch public.batches%rowtype;
  v_timeline public.batch_timeline%rowtype;
  v_tier public.batch_tiers%rowtype;
  v_total integer;
  v_close_at timestamptz;
  v_payment_close timestamptz;
  v_is_admin boolean := public.is_admin();
  v_is_owner boolean := false;
  v_invoice_count integer := 0;
begin
  if auth.uid() is null then raise exception 'sign in required'; end if;
  if p_trigger not in ('capacity_reached', 'registration_expired', 'supplier_manual') then
    raise exception 'invalid close trigger' using errcode = '22023';
  end if;
  if p_trigger = 'supplier_manual' and not public.is_admin() and not public.is_approved_supplier() then
    raise exception 'active approved supplier required' using errcode = '42501';
  end if;

  select * into v_batch from public.batches where id = p_batch_id for update;
  if not found then raise exception 'batch not found' using errcode = 'P0002'; end if;
  v_is_owner := v_batch.supplier_id = auth.uid();

  if v_batch.status <> 'published' then
    if v_batch.status = 'closed' then
      return jsonb_build_object('closed', true, 'idempotent', true, 'batchId', p_batch_id);
    end if;
    raise exception 'batch is not open' using errcode = '55000';
  end if;

  select * into v_timeline from public.batch_timeline where batch_id = p_batch_id;
  if not found then raise exception 'batch timeline is missing' using errcode = 'P0002'; end if;

  select coalesce(sum(r.quantity), 0)::integer into v_total
    from public.registrations r
   where r.batch_id = p_batch_id and r.status = 'registered';

  if p_trigger = 'supplier_manual' then
    if not (v_is_owner or v_is_admin) then raise exception 'only owning supplier may close batch' using errcode = '42501'; end if;
    if v_total < v_batch.min_quantity then raise exception 'minimum quantity has not been reached' using errcode = '55000'; end if;
    if now() >= v_timeline.registration_closes_at then raise exception 'registration cutoff has passed' using errcode = '55000'; end if;
  elsif p_trigger = 'capacity_reached' then
    if v_batch.capacity_quantity is null or v_total < v_batch.capacity_quantity then
      raise exception 'batch capacity has not been reached' using errcode = '55000';
    end if;
  elsif now() < v_timeline.registration_closes_at then
    raise exception 'registration is still open' using errcode = '55000';
  end if;

  if v_batch.capacity_quantity is not null and v_total > v_batch.capacity_quantity then
    raise exception 'registration volume exceeds capacity' using errcode = '22023';
  end if;

  v_close_at := case when p_trigger = 'registration_expired' then v_timeline.registration_closes_at else now() end;
  v_payment_close := v_close_at + make_interval(hours => v_batch.payment_window_hours);

  select bt.* into v_tier
    from public.batch_tiers bt
   where bt.batch_id = p_batch_id
     and bt.min_volume <= v_total
     and (bt.max_volume is null or v_total <= bt.max_volume)
   order by bt.min_volume desc
   limit 1;
  if not found then
    select bt.* into v_tier from public.batch_tiers bt
     where bt.batch_id = p_batch_id and bt.tier_number = 1;
  end if;
  if not found then raise exception 'batch has no tier 1 price' using errcode = '22023'; end if;

  update public.registrations
     set locked_tier_number = v_tier.tier_number,
         locked_price_per_unit = v_tier.price_per_unit,
         final_amount = round(least(v_tier.price_per_unit * quantity, 9999999999.99), 2),
         status = 'pending_payment',
         updated_at = now()
   where batch_id = p_batch_id and status = 'registered';

  insert into public.payments (registration_id, midtrans_order_id, gross_amount, status)
  select r.id, 'WESUP-' || replace(r.id::text, '-', ''), r.final_amount, 'pending'
    from public.registrations r
   where r.batch_id = p_batch_id and r.status = 'pending_payment' and r.final_amount is not null
  on conflict (registration_id) do update
    set gross_amount = excluded.gross_amount, status = case when status = 'paid' then status else excluded.status end, updated_at = now();

  get diagnostics v_invoice_count = row_count;

  update public.batches
     set status = 'closed', registration_closed_at = v_close_at,
         close_reason = case when v_total = 0 then 'no_registrations' else p_trigger end,
         final_registered_quantity = v_total,
         locked_tier_number = v_tier.tier_number,
         locked_unit_price = v_tier.price_per_unit,
         invoices_issued_at = now(), updated_at = now()
   where id = p_batch_id;

  update public.batch_timeline
     set effective_payment_opens_at = v_close_at,
         effective_payment_closes_at = v_payment_close
   where batch_id = p_batch_id;

  insert into public.notifications (user_id, type, title, message, data)
  select r.umkm_id, 'payment_due', 'Tagihan batch sudah terbit',
         format('Tagihan %s sebesar Rp %s tersedia untuk dibayar.', b.title, to_char(r.final_amount, 'FM999G999G999G990')), 
         jsonb_build_object('registration_id', r.id, 'batch_id', p_batch_id)
    from public.registrations r
    join public.batches b on b.id = r.batch_id
   where r.batch_id = p_batch_id and r.status = 'pending_payment'
     and not exists (
       select 1 from public.notifications n
        where n.user_id = r.umkm_id and n.type = 'payment_due'
          and n.data ->> 'registration_id' = r.id::text
     );

  if v_is_admin then
    insert into public.admin_audit_logs (admin_id, action_type, target_type, target_id, details, ip_address, user_agent)
    values (auth.uid(), 'cut_off_batch', 'batches', p_batch_id,
            jsonb_build_object('trigger', p_trigger, 'total_volume', v_total, 'locked_tier', v_tier.tier_number),
            p_ip_address, p_user_agent);
  end if;

  return jsonb_build_object(
    'closed', true,
    'idempotent', false,
    'batchId', p_batch_id,
    'totalQuantity', v_total,
    'tierNumber', v_tier.tier_number,
    'unitPrice', v_tier.price_per_unit,
    'invoiceCount', v_invoice_count,
    'closedAt', v_close_at,
    'paymentOpensAt', v_close_at,
    'paymentClosesAt', v_payment_close
  );
end;
$$;

create or replace function public.materialize_supplier_batch(p_batch_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_status public.batch_status;
  v_cutoff timestamptz;
  v_capacity integer;
  v_total integer;
begin
  if auth.uid() is null then raise exception 'sign in required'; end if;
  select b.status, b.capacity_quantity, t.registration_closes_at
    into v_status, v_capacity, v_cutoff
    from public.batches b join public.batch_timeline t on t.batch_id = b.id
   where b.id = p_batch_id;
  if not found then raise exception 'batch not found' using errcode = 'P0002'; end if;
  if v_status = 'published' then
    select coalesce(sum(quantity), 0)::integer into v_total
      from public.registrations where batch_id = p_batch_id and status = 'registered';
    if v_capacity is not null and v_total >= v_capacity then
      return public.close_batch_and_issue_invoices(p_batch_id, 'capacity_reached');
    elsif now() >= v_cutoff then
      return public.close_batch_and_issue_invoices(p_batch_id, 'registration_expired');
    end if;
  end if;
  return jsonb_build_object('closed', v_status = 'closed', 'idempotent', true, 'batchId', p_batch_id);
end;
$$;

create or replace function public.mark_supplier_batch_ready(p_batch_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare v_supplier_id uuid; v_status public.batch_status;
begin
  if auth.uid() is null then raise exception 'sign in required'; end if;
  select supplier_id, status into v_supplier_id, v_status from public.batches where id = p_batch_id for update;
  if not found then raise exception 'batch not found' using errcode = 'P0002'; end if;
  if not (v_supplier_id = auth.uid() and public.is_supplier()) and not public.is_admin() then raise exception 'only owning supplier may mark ready' using errcode = '42501'; end if;
  if v_supplier_id = auth.uid() and not public.is_admin() and not public.is_approved_supplier() then raise exception 'active approved supplier required' using errcode = '42501'; end if;
  if v_status <> 'closed' then raise exception 'batch is not closed' using errcode = '55000'; end if;
  update public.batches set ready_at = coalesce(ready_at, now()), updated_at = now() where id = p_batch_id;
end;
$$;

create or replace function public.cancel_supplier_batch(p_batch_id uuid, p_reason text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_batch public.batches%rowtype;
begin
  if auth.uid() is null then raise exception 'sign in required'; end if;
  if nullif(trim(p_reason), '') is null then raise exception 'cancellation reason is required' using errcode = '22023'; end if;
  select * into v_batch from public.batches where id = p_batch_id for update;
  if not found then raise exception 'batch not found' using errcode = 'P0002'; end if;
  if not (v_batch.supplier_id = auth.uid() and public.is_supplier()) and not public.is_admin() then raise exception 'only owning supplier may cancel' using errcode = '42501'; end if;
  if v_batch.supplier_id = auth.uid() and not public.is_admin() and not public.is_approved_supplier() then raise exception 'active approved supplier required' using errcode = '42501'; end if;
  if v_batch.status not in ('published', 'closed') then raise exception 'batch cannot be cancelled in its current state' using errcode = '55000'; end if;
  if exists (select 1 from public.registrations where batch_id = p_batch_id and status = 'picked_up') then raise exception 'batch cannot be cancelled after pickup' using errcode = '55000'; end if;

  update public.batches set status = 'cancelled', cancelled_reason = trim(p_reason), close_reason = 'supplier_cancelled', updated_at = now() where id = p_batch_id;
  update public.payments p set status = case when p.status = 'paid' then 'paid' else 'expired' end, updated_at = now()
   where p.registration_id in (select id from public.registrations where batch_id = p_batch_id) and p.status = 'pending';
  update public.registrations set status = case when status = 'paid' then 'refund_pending' else 'cancelled' end, updated_at = now()
   where batch_id = p_batch_id and status in ('registered', 'pending_payment', 'paid');
  update public.escrow_holds set status = 'frozen' where registration_id in (select id from public.registrations where batch_id = p_batch_id) and status = 'held';
  insert into public.refund_requests (registration_id, batch_id, trigger_type, amount, status)
  select r.id, r.batch_id, 'supplier_cancel', r.final_amount, 'pending'
    from public.registrations r
   where r.batch_id = p_batch_id and r.status = 'refund_pending' and r.final_amount is not null
  on conflict (registration_id) do nothing;
end;
$$;

create or replace function public.request_supplier_payout(p_amount numeric, p_bank_account_id uuid, p_idempotency_key text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_supplier_id uuid := auth.uid();
  v_account public.supplier_bank_accounts%rowtype;
  v_available numeric;
  v_reserved numeric;
  v_id uuid;
begin
  if v_supplier_id is null or not public.is_supplier() or not public.is_approved_supplier() then raise exception 'active approved supplier required' using errcode = '42501'; end if;
  if p_amount is null or p_amount <= 0 or nullif(trim(p_idempotency_key), '') is null then raise exception 'invalid payout request' using errcode = '22023'; end if;
  select * into v_account from public.supplier_bank_accounts where id = p_bank_account_id and supplier_id = v_supplier_id and is_primary is true;
  if not found then raise exception 'primary supplier bank account is required' using errcode = '55000'; end if;
  select coalesce(sum(case when to_bucket = 'available' then amount else 0 end), 0) - coalesce(sum(case when from_bucket = 'available' then amount else 0 end), 0) into v_available from public.supplier_ledger_entries where supplier_id = v_supplier_id;
  select coalesce(sum(amount) filter (where status in ('requested', 'approved')), 0) into v_reserved from public.supplier_payouts where supplier_id = v_supplier_id;
  if p_amount > v_available - v_reserved then raise exception 'insufficient available balance' using errcode = '55000'; end if;
  insert into public.supplier_payouts (supplier_id, supplier_bank_account_id, amount, bank_account_snapshot, idempotency_key)
  values (v_supplier_id, p_bank_account_id, p_amount, jsonb_build_object('bankName', v_account.bank_name, 'accountNumber', v_account.account_number, 'accountHolderName', v_account.account_holder_name), p_idempotency_key)
  on conflict (idempotency_key) do update set updated_at = public.supplier_payouts.updated_at
  returning id into v_id;
  return v_id;
end;
$$;

create or replace function public.complete_supplier_payout(p_payout_id uuid, p_status text, p_transfer_proof_url text default null, p_notes text default null)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare v_payout public.supplier_payouts%rowtype;
begin
  if auth.uid() is null or not public.is_admin() then raise exception 'admin access required' using errcode = '42501'; end if;
  if p_status not in ('approved', 'transferred', 'rejected') then raise exception 'invalid payout status' using errcode = '22023'; end if;
  select * into v_payout from public.supplier_payouts where id = p_payout_id for update;
  if not found then raise exception 'payout not found' using errcode = 'P0002'; end if;
  if p_status = 'transferred' and nullif(trim(coalesce(p_transfer_proof_url, '')), '') is null then raise exception 'transfer proof is required' using errcode = '22023'; end if;
  update public.supplier_payouts set status = p_status, transfer_proof_url = coalesce(p_transfer_proof_url, transfer_proof_url), notes = coalesce(p_notes, notes), processed_by = auth.uid(), approved_at = case when p_status = 'approved' then now() else approved_at end, transferred_at = case when p_status = 'transferred' then now() else transferred_at end, updated_at = now() where id = p_payout_id;
  if p_status = 'transferred' then
    insert into public.supplier_ledger_entries (supplier_id, payout_id, from_bucket, to_bucket, amount, entry_type, idempotency_key)
    values (v_payout.supplier_id, p_payout_id, 'available', 'paid_out', v_payout.amount, 'payout_transferred', 'payout_transferred:' || p_payout_id)
    on conflict (idempotency_key) do nothing;
  end if;
end;
$$;

revoke execute on function public.close_batch_and_issue_invoices(uuid, text, text, text) from public, anon;
grant execute on function public.close_batch_and_issue_invoices(uuid, text, text, text) to authenticated, service_role;
revoke execute on function public.materialize_supplier_batch(uuid) from public, anon;
grant execute on function public.materialize_supplier_batch(uuid) to authenticated, service_role;
revoke execute on function public.mark_supplier_batch_ready(uuid) from public, anon;
grant execute on function public.mark_supplier_batch_ready(uuid) to authenticated;
revoke execute on function public.cancel_supplier_batch(uuid, text) from public, anon;
grant execute on function public.cancel_supplier_batch(uuid, text) to authenticated;
revoke execute on function public.request_supplier_payout(numeric, uuid, text) from public, anon;
grant execute on function public.request_supplier_payout(numeric, uuid, text) to authenticated;
revoke execute on function public.complete_supplier_payout(uuid, text, text, text) from public, anon, authenticated;
grant execute on function public.complete_supplier_payout(uuid, text, text, text) to authenticated, service_role;

-- Lock the batch row while accepting a registration. This is the database
-- backstop for the Redis reservation and makes the final slot race-safe.
create or replace function public.prevent_registration_outside_window() returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_status public.batch_status;
  v_opens_at timestamptz;
  v_closes_at timestamptz;
  v_capacity integer;
  v_committed integer;
begin
  select b.status, t.registration_opens_at, t.registration_closes_at,
         b.capacity_quantity
    into v_status, v_opens_at, v_closes_at, v_capacity
    from public.batches b
    left join public.batch_timeline t on t.batch_id = b.id
   where b.id = new.batch_id
   for update of b;

  if v_status is null then raise exception 'batch does not exist'; end if;
  if v_status <> 'published' then raise exception 'batch is not accepting registrations'; end if;
  if v_opens_at is null or v_closes_at is null then raise exception 'batch timeline is not defined'; end if;
  if now() < v_opens_at or now() >= v_closes_at then raise exception 'registration window is closed'; end if;

  if v_capacity is not null then
    select coalesce(sum(r.quantity), 0)::integer into v_committed
      from public.registrations r
     where r.batch_id = new.batch_id
       and r.status in ('registered', 'pending_payment', 'paid', 'picked_up', 'completed');
    if v_committed + new.quantity > v_capacity then
      raise exception 'batch capacity exceeded' using errcode = 'P0001', detail = v_capacity - v_committed;
    end if;
  end if;
  return new;
end;
$$;

revoke execute on function public.prevent_registration_outside_window() from public, anon, authenticated;

-- V2 catalog wrappers keep all existing validation and ownership checks while
-- adding the hard capacity, unit, and payment-window fields required by the
-- transaction flow. Named arguments make this safe for API clients.
create or replace function public.create_supplier_batch_v2(
  p_title text, p_description text, p_category text, p_min_quantity integer,
  p_capacity_quantity integer, p_unit text, p_payment_window_hours smallint,
  p_pickup_name text, p_pickup_address text, p_latitude numeric, p_longitude numeric,
  p_registration_opens_at timestamptz, p_registration_closes_at timestamptz,
  p_payment_opens_at timestamptz, p_payment_closes_at timestamptz,
  p_estimated_ready_at timestamptz, p_tiers jsonb
) returns uuid
language plpgsql security definer set search_path = public
as $$
declare v_batch_id uuid;
begin
  if p_capacity_quantity is null or p_capacity_quantity <= 0 or p_capacity_quantity < p_min_quantity then
    raise exception 'capacity quantity must be greater than or equal to minimum quantity' using errcode = '22023';
  end if;
  if p_unit not in ('kg', 'gram', 'liter', 'ml', 'pcs', 'pack', 'karung', 'ikat', 'sisir') then
    raise exception 'unit is invalid' using errcode = '22023';
  end if;
  if p_payment_window_hours not in (3, 6, 12, 24) then
    raise exception 'payment window must be 3, 6, 12, or 24 hours' using errcode = '22023';
  end if;

  v_batch_id := public.create_supplier_batch(
    p_title, p_description, p_category, p_min_quantity, p_pickup_name,
    p_pickup_address, p_latitude, p_longitude, p_registration_opens_at,
    p_registration_closes_at, p_payment_opens_at, p_payment_closes_at,
    p_estimated_ready_at, p_tiers
  );
  update public.batches
     set capacity_quantity = p_capacity_quantity,
         unit = p_unit,
         payment_window_hours = p_payment_window_hours
   where id = v_batch_id;
  return v_batch_id;
end;
$$;

create or replace function public.update_supplier_batch_v2(
  p_batch_id uuid, p_title text, p_description text, p_category text,
  p_min_quantity integer, p_capacity_quantity integer, p_unit text,
  p_payment_window_hours smallint, p_product_photo_url text,
  p_pickup_name text, p_pickup_address text, p_latitude numeric, p_longitude numeric,
  p_registration_opens_at timestamptz, p_registration_closes_at timestamptz,
  p_payment_opens_at timestamptz, p_payment_closes_at timestamptz,
  p_estimated_ready_at timestamptz, p_tiers jsonb
) returns void
language plpgsql security definer set search_path = public
as $$
begin
  if p_capacity_quantity is null or p_capacity_quantity <= 0 or p_capacity_quantity < p_min_quantity then
    raise exception 'capacity quantity must be greater than or equal to minimum quantity' using errcode = '22023';
  end if;
  if p_unit not in ('kg', 'gram', 'liter', 'ml', 'pcs', 'pack', 'karung', 'ikat', 'sisir') then
    raise exception 'unit is invalid' using errcode = '22023';
  end if;
  if p_payment_window_hours not in (3, 6, 12, 24) then
    raise exception 'payment window must be 3, 6, 12, or 24 hours' using errcode = '22023';
  end if;
  perform public.update_supplier_batch(
    p_batch_id, p_title, p_description, p_category, p_min_quantity,
    p_product_photo_url, p_pickup_name, p_pickup_address, p_latitude,
    p_longitude, p_registration_opens_at, p_registration_closes_at,
    p_payment_opens_at, p_payment_closes_at, p_estimated_ready_at, p_tiers
  );
  update public.batches
     set capacity_quantity = p_capacity_quantity,
         unit = p_unit,
         payment_window_hours = p_payment_window_hours,
         updated_at = now()
   where id = p_batch_id;
end;
$$;

create or replace function public.update_and_publish_supplier_batch_v2(
  p_batch_id uuid, p_title text, p_description text, p_category text,
  p_min_quantity integer, p_capacity_quantity integer, p_unit text,
  p_payment_window_hours smallint, p_product_photo_url text,
  p_pickup_name text, p_pickup_address text, p_latitude numeric, p_longitude numeric,
  p_registration_opens_at timestamptz, p_registration_closes_at timestamptz,
  p_payment_opens_at timestamptz, p_payment_closes_at timestamptz,
  p_estimated_ready_at timestamptz, p_tiers jsonb
) returns void
language plpgsql security definer set search_path = public
as $$
begin
  perform public.update_supplier_batch_v2(
    p_batch_id, p_title, p_description, p_category, p_min_quantity,
    p_capacity_quantity, p_unit, p_payment_window_hours, p_product_photo_url,
    p_pickup_name, p_pickup_address, p_latitude, p_longitude,
    p_registration_opens_at, p_registration_closes_at, p_payment_opens_at,
    p_payment_closes_at, p_estimated_ready_at, p_tiers
  );
  perform public.publish_supplier_batch(p_batch_id, p_product_photo_url);
end;
$$;

create or replace function public.get_supplier_batch_transaction(p_batch_id uuid)
returns jsonb
language plpgsql stable security definer set search_path = public
as $$
declare
  v_supplier_id uuid;
  v_batch jsonb;
  v_timeline jsonb;
  v_orders jsonb;
  v_summary jsonb;
  v_capabilities jsonb;
begin
  if auth.uid() is null then raise exception 'sign in required' using errcode = '42501'; end if;
  select supplier_id into v_supplier_id from public.batches where id = p_batch_id;
  if not found then raise exception 'batch not found' using errcode = 'P0002'; end if;
  if v_supplier_id <> auth.uid() and not public.is_admin() then
    raise exception 'batch access denied' using errcode = '42501';
  end if;
  if v_supplier_id = auth.uid() and not public.is_approved_supplier() then
    raise exception 'active approved supplier required' using errcode = '42501';
  end if;

  -- Do not call get_supplier_batch here: that catalog read model intentionally
  -- requires the caller to be the owning Supplier, while this transaction
  -- snapshot is also available to Admin for reconciliation/dispute work.
  select jsonb_build_object(
    'id', b.id,
    'supplier_name', coalesce(sp.business_name, p.full_name),
    'title', b.title,
    'description', b.description,
    'category', b.category,
    'min_quantity', b.min_quantity,
    'capacity_quantity', b.capacity_quantity,
    'unit', b.unit,
    'payment_window_hours', b.payment_window_hours,
    'registration_closed_at', b.registration_closed_at,
    'close_reason', b.close_reason,
    'final_registered_quantity', b.final_registered_quantity,
    'locked_tier_number', b.locked_tier_number,
    'locked_unit_price', b.locked_unit_price,
    'invoices_issued_at', b.invoices_issued_at,
    'ready_at', b.ready_at,
    'completed_at', b.completed_at,
    'product_photo_url', b.product_photo_url,
    'pickup_name', b.pickup_name,
    'pickup_address', b.pickup_address,
    'latitude', b.latitude,
    'longitude', b.longitude,
    'status', b.status,
    'registration_opens_at', t.registration_opens_at,
    'registration_closes_at', t.registration_closes_at,
    'payment_opens_at', t.payment_opens_at,
    'payment_closes_at', t.payment_closes_at,
    'effective_payment_opens_at', t.effective_payment_opens_at,
    'effective_payment_closes_at', t.effective_payment_closes_at,
    'estimated_ready_at', t.estimated_ready_at,
    'tiers', coalesce((select jsonb_agg(jsonb_build_object(
      'tier_number', bt.tier_number,
      'min_volume', bt.min_volume,
      'max_volume', bt.max_volume,
      'price_per_unit', bt.price_per_unit
    ) order by bt.tier_number) from public.batch_tiers bt where bt.batch_id = b.id), '[]'::jsonb),
    'registered_quantity', coalesce((select sum(r.quantity) filter (where r.status <> 'cancelled') from public.registrations r where r.batch_id = b.id), 0),
    'participant_count', coalesce((select count(*) filter (where r.status <> 'cancelled') from public.registrations r where r.batch_id = b.id), 0),
    'paid_participant_count', coalesce((select count(*) filter (where r.status in ('paid', 'picked_up', 'completed')) from public.registrations r where r.batch_id = b.id), 0),
    'cancelled_reason', b.cancelled_reason,
    'updated_at', b.updated_at,
    'created_at', b.created_at
  )
    into v_batch
    from public.batches b
    join public.profiles p on p.id = b.supplier_id
    left join public.supplier_profiles sp on sp.user_id = b.supplier_id
    left join public.batch_timeline t on t.batch_id = b.id
   where b.id = p_batch_id;
  select to_jsonb(t) into v_timeline from public.batch_timeline t where t.batch_id = p_batch_id;
  select coalesce(jsonb_agg(jsonb_build_object(
      'registrationId', r.id,
      'umkmId', r.umkm_id,
      'umkmName', coalesce(p.full_name, 'UMKM'),
      'quantity', r.quantity,
      'status', r.status,
      'finalAmount', r.final_amount,
      'lockedTierNumber', r.locked_tier_number,
      'lockedPricePerUnit', r.locked_price_per_unit,
      'createdAt', r.created_at,
      'paymentStatus', pay.status,
      'escrowStatus', eh.status,
      'pickupConfirmedAt', eh.pickup_confirmed_at,
      'autoReleaseAt', eh.auto_release_at
    ) order by r.created_at desc), '[]'::jsonb)
    into v_orders
    from public.registrations r
    left join public.profiles p on p.id = r.umkm_id
    left join public.payments pay on pay.registration_id = r.id
    left join public.escrow_holds eh on eh.registration_id = r.id
   where r.batch_id = p_batch_id;
  select jsonb_build_object(
    'registered', count(*) filter (where r.status = 'registered'),
    'pendingPayment', count(*) filter (where r.status = 'pending_payment'),
    'paid', count(*) filter (where r.status = 'paid'),
    'pickedUp', count(*) filter (where r.status in ('picked_up', 'completed')),
    'failed', count(*) filter (where r.status in ('cancelled', 'no_show')),
    'refund', count(*) filter (where r.status in ('refund_pending', 'refunded')),
    'totalQuantity', coalesce(sum(r.quantity), 0),
    'totalAmount', coalesce(sum(r.final_amount), 0)
  ) into v_summary
  from public.registrations r where r.batch_id = p_batch_id;

  select jsonb_build_object(
    'canEditCommercialFields', v_supplier_id = auth.uid() and b.status in ('draft', 'published') and not exists (select 1 from public.registrations r where r.batch_id = b.id),
    'canCloseBatch', v_supplier_id = auth.uid() and b.status = 'published' and now() < t.registration_closes_at and coalesce((select sum(r.quantity) from public.registrations r where r.batch_id = b.id and r.status = 'registered'), 0) >= b.min_quantity,
    'canCancelBatch', v_supplier_id = auth.uid() and b.status in ('published', 'closed') and not exists (select 1 from public.registrations r where r.batch_id = b.id and r.status in ('picked_up', 'completed')),
    'canMarkReady', v_supplier_id = auth.uid() and b.status = 'closed' and b.ready_at is null,
    'canConfirmPickup', v_supplier_id = auth.uid() and exists (select 1 from public.registrations r where r.batch_id = b.id and r.status = 'paid'),
    'canViewDispute', exists (select 1 from public.disputes d join public.registrations r on r.id = d.registration_id where r.batch_id = b.id),
    'canRequestPayout', v_supplier_id = auth.uid()
  ) into v_capabilities
  from public.batches b
  join public.batch_timeline t on t.batch_id = b.id
 where b.id = p_batch_id;

  return jsonb_build_object(
    'batch', coalesce(v_batch, '{}'::jsonb),
    'timeline', coalesce(v_timeline, '{}'::jsonb),
    'capacityQuantity', (select capacity_quantity from public.batches where id = p_batch_id),
    'paymentWindowHours', (select payment_window_hours from public.batches where id = p_batch_id),
    'registrationClosedAt', (select registration_closed_at from public.batches where id = p_batch_id),
    'closeReason', (select close_reason from public.batches where id = p_batch_id),
    'finalRegisteredQuantity', (select final_registered_quantity from public.batches where id = p_batch_id),
    'lockedTierNumber', (select locked_tier_number from public.batches where id = p_batch_id),
    'lockedUnitPrice', (select locked_unit_price from public.batches where id = p_batch_id),
    'invoicesIssuedAt', (select invoices_issued_at from public.batches where id = p_batch_id),
    'readyAt', (select ready_at from public.batches where id = p_batch_id),
    'completedAt', (select completed_at from public.batches where id = p_batch_id),
    'summary', coalesce(v_summary, '{}'::jsonb),
    'capabilities', coalesce(v_capabilities, '{}'::jsonb),
    'orders', coalesce(v_orders, '[]'::jsonb),
    'serverTime', now()
  );
end;
$$;

revoke execute on function public.create_supplier_batch_v2(text, text, text, integer, integer, text, smallint, text, text, numeric, numeric, timestamptz, timestamptz, timestamptz, timestamptz, timestamptz, jsonb) from public, anon;
grant execute on function public.create_supplier_batch_v2(text, text, text, integer, integer, text, smallint, text, text, numeric, numeric, timestamptz, timestamptz, timestamptz, timestamptz, timestamptz, jsonb) to authenticated;
revoke execute on function public.update_supplier_batch_v2(uuid, text, text, text, integer, integer, text, smallint, text, text, text, numeric, numeric, timestamptz, timestamptz, timestamptz, timestamptz, timestamptz, jsonb) from public, anon;
grant execute on function public.update_supplier_batch_v2(uuid, text, text, text, integer, integer, text, smallint, text, text, text, numeric, numeric, timestamptz, timestamptz, timestamptz, timestamptz, timestamptz, jsonb) to authenticated;
revoke execute on function public.update_and_publish_supplier_batch_v2(uuid, text, text, text, integer, integer, text, smallint, text, text, text, numeric, numeric, timestamptz, timestamptz, timestamptz, timestamptz, timestamptz, jsonb) from public, anon;
grant execute on function public.update_and_publish_supplier_batch_v2(uuid, text, text, text, integer, integer, text, smallint, text, text, text, numeric, numeric, timestamptz, timestamptz, timestamptz, timestamptz, timestamptz, jsonb) to authenticated;
revoke execute on function public.get_supplier_batch_transaction(uuid) from public, anon;
grant execute on function public.get_supplier_batch_transaction(uuid) to authenticated;

create or replace function public.upsert_supplier_bank_account(
  p_bank_account_id uuid,
  p_bank_name text,
  p_account_number text,
  p_account_holder_name text,
  p_is_primary boolean default false
) returns uuid
language plpgsql security definer set search_path = public
as $$
declare v_id uuid := p_bank_account_id;
begin
  if auth.uid() is null or not public.is_supplier() or not public.is_approved_supplier() then raise exception 'active approved supplier required' using errcode = '42501'; end if;
  if nullif(trim(p_bank_name), '') is null or nullif(trim(p_account_number), '') is null or nullif(trim(p_account_holder_name), '') is null then
    raise exception 'bank account fields are required' using errcode = '22023';
  end if;
  if p_is_primary then update public.supplier_bank_accounts set is_primary = false, updated_at = now() where supplier_id = auth.uid() and (v_id is null or id <> v_id); end if;
  if v_id is null then
    insert into public.supplier_bank_accounts (supplier_id, bank_name, account_number, account_holder_name, is_primary)
    values (auth.uid(), trim(p_bank_name), trim(p_account_number), trim(p_account_holder_name), p_is_primary)
    returning id into v_id;
  else
    update public.supplier_bank_accounts
       set bank_name = trim(p_bank_name), account_number = trim(p_account_number), account_holder_name = trim(p_account_holder_name), is_primary = p_is_primary, updated_at = now()
     where id = v_id and supplier_id = auth.uid();
    if not found then raise exception 'bank account not found' using errcode = 'P0002'; end if;
  end if;
  return v_id;
end;
$$;

revoke execute on function public.upsert_supplier_bank_account(uuid, text, text, text, boolean) from public, anon;
grant execute on function public.upsert_supplier_bank_account(uuid, text, text, text, boolean) to authenticated;

create or replace function public.get_supplier_finance()
returns jsonb
language plpgsql stable security definer set search_path = public
as $$
declare v_supplier_id uuid := auth.uid();
begin
  if v_supplier_id is null or not public.is_supplier() or not public.is_approved_supplier() then raise exception 'active approved supplier required' using errcode = '42501'; end if;
  return jsonb_build_object(
    'serverTime', now(),
    'balances', jsonb_build_object(
      'escrow', coalesce((select sum(amount) from public.supplier_ledger_entries where supplier_id = v_supplier_id and to_bucket = 'escrow'), 0),
      'frozen', coalesce((select sum(amount) from public.supplier_ledger_entries where supplier_id = v_supplier_id and to_bucket = 'frozen'), 0),
      'available', coalesce((select sum(case when to_bucket = 'available' then amount else 0 end) - sum(case when from_bucket = 'available' then amount else 0 end) from public.supplier_ledger_entries where supplier_id = v_supplier_id), 0),
      'paidOut', coalesce((select sum(amount) from public.supplier_ledger_entries where supplier_id = v_supplier_id and to_bucket = 'paid_out'), 0)
    ),
    'accounts', coalesce((select jsonb_agg(to_jsonb(a) order by a.is_primary desc, a.created_at desc) from public.supplier_bank_accounts a where a.supplier_id = v_supplier_id), '[]'::jsonb),
    'payouts', coalesce((select jsonb_agg(to_jsonb(p) order by p.created_at desc) from public.supplier_payouts p where p.supplier_id = v_supplier_id), '[]'::jsonb)
  );
end;
$$;

revoke execute on function public.get_supplier_finance() from public, anon;
grant execute on function public.get_supplier_finance() to authenticated;

-- Ownership-gated order reconciler for effective payment deadlines.
create or replace function public.materialize_supplier_order(p_registration_id uuid)
returns public.registration_status
language plpgsql security definer set search_path = public
as $$
declare
  v_batch_id uuid;
  v_umkm_id uuid;
  v_supplier_id uuid;
  v_status public.registration_status;
  v_payment_close timestamptz;
  v_payment_id uuid;
begin
  if auth.uid() is null then raise exception 'sign in required' using errcode = '42501'; end if;
  select r.batch_id, r.umkm_id, b.supplier_id, r.status
    into v_batch_id, v_umkm_id, v_supplier_id, v_status
    from public.registrations r join public.batches b on b.id = r.batch_id
   where r.id = p_registration_id;
  if not found then raise exception 'order not found' using errcode = 'P0002'; end if;
  if auth.uid() <> v_umkm_id and auth.uid() <> v_supplier_id and not public.is_admin() then
    raise exception 'order not found' using errcode = 'P0002';
  end if;

  perform public.materialize_supplier_batch(v_batch_id);
  select t.effective_payment_closes_at, r.status into v_payment_close, v_status
    from public.registrations r join public.batch_timeline t on t.batch_id = r.batch_id
   where r.id = p_registration_id;
  if v_status = 'pending_payment' and v_payment_close is not null and now() >= v_payment_close then
    select id into v_payment_id from public.payments where registration_id = p_registration_id;
    if not exists (select 1 from public.payment_attempts where payment_id = v_payment_id and status = 'pending') then
      update public.payments set status = 'expired', updated_at = now() where id = v_payment_id and status = 'pending';
      update public.registrations set status = 'cancelled', updated_at = now() where id = p_registration_id and status = 'pending_payment';
      if found then update public.umkm_profiles set strike_count = strike_count + 1, updated_at = now() where user_id = v_umkm_id; end if;
    end if;
  end if;
  return public.materialize_umkm_order(p_registration_id);
end;
$$;

revoke execute on function public.materialize_supplier_order(uuid) from public, anon;
grant execute on function public.materialize_supplier_order(uuid) to authenticated, service_role;

-- A settlement can race with a Supplier/Admin cancellation. In that case the
-- money must be acknowledged, but the order must stay on the refund branch;
-- a late webhook must never resurrect a cancelled batch into pickup.
create or replace function public.finalize_payment(
  p_registration_id uuid,
  p_midtrans_transaction_id text,
  p_payload jsonb default '{}'::jsonb
) returns public.registration_status
language plpgsql security definer set search_path = public
as $$
declare
  v_status public.registration_status;
  v_batch_status public.batch_status;
  v_batch_id uuid;
  v_amount numeric;
  v_payment_id uuid;
begin
  select r.status, r.final_amount, r.batch_id, b.status
    into v_status, v_amount, v_batch_id, v_batch_status
    from public.registrations r
    join public.batches b on b.id = r.batch_id
   where r.id = p_registration_id
   for update of r;
  if not found then raise exception 'order not found' using errcode = 'P0002'; end if;

  if v_status in ('no_show', 'completed', 'refunded') then
    return v_status;
  end if;

  select id into v_payment_id from public.payments where registration_id = p_registration_id;
  if v_payment_id is null then raise exception 'payment invoice not found' using errcode = 'P0002'; end if;

  update public.payments
     set status = 'paid',
         midtrans_transaction_id = p_midtrans_transaction_id,
         paid_at = coalesce(paid_at, now()),
         webhook_payload = p_payload,
         reconciled_at = now(),
         updated_at = now()
   where id = v_payment_id and status <> 'refunded';

  if v_batch_status in ('cancelled', 'takedown')
     and v_status in ('registered', 'pending_payment', 'cancelled', 'paid', 'refund_pending') then
    update public.registrations
       set status = 'refund_pending', updated_at = now()
     where id = p_registration_id
       and status in ('registered', 'pending_payment', 'cancelled', 'paid');

    insert into public.escrow_holds (registration_id, amount, status, pickup_confirmed_at, auto_release_at, release_destination)
      values (p_registration_id, coalesce(v_amount, 0), 'held', null, null, 'umkm')
      on conflict (registration_id) do nothing;
    update public.escrow_holds
       set status = 'frozen', release_destination = 'umkm'
     where registration_id = p_registration_id and status in ('held', 'frozen');

    insert into public.refund_requests (registration_id, batch_id, trigger_type, amount, status)
      values (p_registration_id, v_batch_id, 'supplier_cancel', coalesce(v_amount, 0), 'pending')
      on conflict (registration_id) do nothing;

    update public.payment_attempts
       set status = 'paid', provider_transaction_id = p_midtrans_transaction_id, updated_at = now()
     where payment_id = v_payment_id and status = 'pending';
    return 'refund_pending';
  end if;

  if v_status = 'refund_pending' then
    update public.payment_attempts
       set status = 'paid', provider_transaction_id = p_midtrans_transaction_id, updated_at = now()
     where payment_id = v_payment_id and status = 'pending';
    return v_status;
  end if;
  if coalesce(v_amount, 0) <= 0 then raise exception 'registration has no payable amount' using errcode = '22023'; end if;

  update public.registrations
     set status = 'paid', updated_at = now()
   where id = p_registration_id and status in ('registered', 'pending_payment', 'paid');
  insert into public.escrow_holds (registration_id, amount, status, pickup_confirmed_at, auto_release_at)
    values (p_registration_id, coalesce(v_amount, 0), 'held', null, null)
    on conflict (registration_id) do nothing;
  update public.payment_attempts
     set status = 'paid', provider_transaction_id = p_midtrans_transaction_id, updated_at = now()
   where payment_id = v_payment_id and status = 'pending';
  select status into v_status from public.registrations where id = p_registration_id;
  return v_status;
end;
$$;
