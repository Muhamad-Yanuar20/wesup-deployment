-- Additive lifecycle hardening for the UMKM order center.
-- No scheduled jobs are introduced; all materialisation is on-demand.

alter type public.escrow_status add value if not exists 'frozen';

alter table public.batches
  add column if not exists unit text not null default 'pcs';
alter table public.batches
  drop constraint if exists batches_unit_check;
alter table public.batches
  add constraint batches_unit_check
  check (unit in ('kg', 'gram', 'liter', 'ml', 'pcs', 'pack', 'karung', 'ikat', 'sisir'));

alter table public.payment_webhook_logs
  add column if not exists payload_hash text;
create unique index if not exists payment_webhook_logs_payload_hash_unique
  on public.payment_webhook_logs (payload_hash)
  where payload_hash is not null;

alter table public.escrow_holds
  alter column pickup_confirmed_at drop not null;
alter table public.escrow_holds
  alter column auto_release_at drop not null;

alter table public.disputes
  add column if not exists complaint_category text not null default 'cacat';
alter table public.disputes
  drop constraint if exists disputes_complaint_category_check;
alter table public.disputes
  add constraint disputes_complaint_category_check
  check (complaint_category in ('cacat', 'busuk'));

create table if not exists public.payment_attempts (
  id uuid primary key default gen_random_uuid(),
  payment_id uuid not null references public.payments (id) on delete cascade,
  provider_order_id text not null unique,
  provider_transaction_id text unique,
  status public.payment_status not null default 'pending',
  qr_code_url text,
  expires_at timestamptz,
  idempotency_key text not null unique,
  provider_payload jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.payment_attempts enable row level security;
create policy "payment_attempts_umkm_select" on public.payment_attempts
  for select to authenticated using (exists (
    select 1 from public.payments p
    join public.registrations r on r.id = p.registration_id
    where p.id = payment_id and r.umkm_id = auth.uid()
  ));
create policy "payment_attempts_supplier_select" on public.payment_attempts
  for select to authenticated using (exists (
    select 1 from public.payments p
    join public.registrations r on r.id = p.registration_id
    join public.batches b on b.id = r.batch_id
    where p.id = payment_id and b.supplier_id = auth.uid()
  ));
create policy "payment_attempts_admin_select" on public.payment_attempts
  for select to authenticated using (public.is_admin());
create index payment_attempts_payment_idx on public.payment_attempts (payment_id, created_at desc);
create unique index payment_attempts_one_pending on public.payment_attempts (payment_id)
  where status = 'pending';

create table if not exists public.registration_status_events (
  id uuid primary key default gen_random_uuid(),
  registration_id uuid not null references public.registrations (id) on delete cascade,
  from_status public.registration_status,
  to_status public.registration_status not null,
  source text not null,
  actor_id uuid references public.profiles (id),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
alter table public.registration_status_events enable row level security;
create policy "registration_status_events_umkm_select" on public.registration_status_events
  for select to authenticated using (exists (
    select 1 from public.registrations r where r.id = registration_id and r.umkm_id = auth.uid()
  ));
create policy "registration_status_events_supplier_select" on public.registration_status_events
  for select to authenticated using (exists (
    select 1 from public.registrations r join public.batches b on b.id = r.batch_id
    where r.id = registration_id and b.supplier_id = auth.uid()
  ));
create policy "registration_status_events_admin_select" on public.registration_status_events
  for select to authenticated using (public.is_admin());
create index registration_status_events_registration_idx
  on public.registration_status_events (registration_id, created_at desc);

create or replace function public.record_registration_status_event()
returns trigger language plpgsql security definer set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    insert into public.registration_status_events
      (registration_id, from_status, to_status, source, actor_id)
    values (new.id, null, new.status, 'registration_created', auth.uid());
  elsif old.status is distinct from new.status then
    insert into public.registration_status_events
      (registration_id, from_status, to_status, source, actor_id)
    values (new.id, old.status, new.status, 'status_update', auth.uid());
  end if;
  return new;
end;
$$;
drop trigger if exists registration_status_event_insert on public.registrations;
create trigger registration_status_event_insert
  after insert or update of status on public.registrations
  for each row execute function public.record_registration_status_event();

-- Status is no longer directly mutable by an UMKM. RPCs/service-role code are
-- the only writers; read and initial insert remain available to the owner.
drop policy if exists "registrations_umkm_all" on public.registrations;
drop policy if exists "registrations_umkm_role_all" on public.registrations;
create policy "registrations_umkm_select_own" on public.registrations
  for select to authenticated using (umkm_id = auth.uid());
create policy "registrations_umkm_insert_own" on public.registrations
  for insert to authenticated with check (
    umkm_id = auth.uid() and exists (
      select 1 from public.profiles p where p.id = auth.uid() and p.role = 'umkm' and p.status = 'active'
    )
  );

create or replace function public.materialize_umkm_order(p_registration_id uuid)
returns public.registration_status
language plpgsql security definer set search_path = public
as $$
declare
  v_registration public.registrations%rowtype;
  v_timeline public.batch_timeline%rowtype;
  v_payment_id uuid;
  v_dispute_status public.dispute_status;
  v_has_pending_attempt boolean := false;
begin
  select * into v_registration from public.registrations where id = p_registration_id for update;
  if not found or (auth.uid() is not null and v_registration.umkm_id <> auth.uid() and not public.is_admin()) then
    raise exception 'order not found';
  end if;
  select * into v_timeline from public.batch_timeline where batch_id = v_registration.batch_id;
  if v_registration.status = 'registered' and now() >= v_timeline.registration_closes_at then
    if v_registration.final_amount is not null then
      insert into public.payments (registration_id, midtrans_order_id, gross_amount)
      values (p_registration_id, 'WESUP-' || replace(p_registration_id::text, '-', ''), v_registration.final_amount)
      on conflict (registration_id) do nothing;
    end if;
  end if;

  -- Paid orders that pass the twelve-hour pickup tolerance become no-show.
  -- The guarded update makes the strike and escrow forfeiture idempotent.
  if v_registration.status = 'paid'
     and now() >= v_timeline.estimated_ready_at + interval '12 hours' then
    update public.registrations set status = 'no_show', updated_at = now()
      where id = p_registration_id and status = 'paid';
    if found then
      update public.escrow_holds
         set status = 'forfeited', released_at = now(), release_destination = 'supplier'
       where registration_id = p_registration_id
         and status = 'held'
         and pickup_confirmed_at is null;
      update public.umkm_profiles
         set strike_count = strike_count + 1, updated_at = now()
       where user_id = v_registration.umkm_id;
    end if;
  elsif v_registration.status = 'picked_up' then
    -- A resolved UMKM dispute queues a refund; a supplier win or a clean
    -- 24-hour window releases the escrow and completes the order.
    select d.status into v_dispute_status
      from public.disputes d where d.registration_id = p_registration_id;
    if v_dispute_status = 'resolved_umkm' then
      update public.escrow_holds
         set status = 'frozen', release_destination = 'umkm', dispute_id = (
           select id from public.disputes where registration_id = p_registration_id
         )
       where registration_id = p_registration_id and status in ('held', 'frozen');
      update public.registrations set status = 'refund_pending', updated_at = now()
       where id = p_registration_id and status = 'picked_up';
      insert into public.refund_requests (registration_id, batch_id, trigger_type, amount, status)
        values (p_registration_id, v_registration.batch_id, 'dispute_won', v_registration.final_amount, 'pending')
        on conflict (registration_id) do nothing;
    elsif v_dispute_status is null or v_dispute_status = 'resolved_supplier' then
      update public.escrow_holds
         set status = 'released', released_at = now(), release_destination = coalesce(release_destination, 'supplier')
       where registration_id = p_registration_id
         and status = 'held'
         and auto_release_at is not null and auto_release_at <= now()
         and coalesce(release_destination, 'supplier') = 'supplier';
      if found then
        update public.registrations set status = 'completed', updated_at = now()
         where id = p_registration_id and status = 'picked_up';
      end if;
    end if;
  elsif v_registration.status = 'registered' and now() >= coalesce(v_timeline.effective_payment_opens_at, v_timeline.payment_opens_at) then
    if now() < coalesce(v_timeline.effective_payment_closes_at, v_timeline.payment_closes_at) then
      update public.registrations set status = 'pending_payment', updated_at = now()
       where id = p_registration_id and status = 'registered';
      if v_registration.final_amount is not null then
        insert into public.payments (registration_id, midtrans_order_id, gross_amount)
        values (p_registration_id, 'WESUP-' || replace(p_registration_id::text, '-', ''), v_registration.final_amount)
        on conflict (registration_id) do nothing;
      end if;
    else
      update public.registrations set status = 'cancelled', updated_at = now()
       where id = p_registration_id and status = 'registered';
    end if;
  elsif v_registration.status = 'pending_payment' and now() >= coalesce(v_timeline.effective_payment_closes_at, v_timeline.payment_closes_at) then
    select id into v_payment_id from public.payments where registration_id = p_registration_id;
    select exists (
      select 1 from public.payment_attempts
       where payment_id = v_payment_id and status = 'pending'
    ) into v_has_pending_attempt;
    -- A pending provider attempt must be reconciled against Midtrans first;
    -- otherwise a late settlement webhook could be penalized as Hit-and-Run.
    if not v_has_pending_attempt then
      update public.payments set status = 'expired', updated_at = now()
        where id = v_payment_id and status = 'pending';
      update public.registrations set status = 'cancelled', updated_at = now()
        where id = p_registration_id and status = 'pending_payment';
      if found then
        update public.umkm_profiles
           set strike_count = strike_count + 1, updated_at = now()
         where user_id = v_registration.umkm_id;
      end if;
    end if;
  end if;
  select status into v_registration.status from public.registrations where id = p_registration_id;
  return v_registration.status;
end;
$$;

create or replace function public.finalize_payment(
  p_registration_id uuid,
  p_midtrans_transaction_id text,
  p_payload jsonb default '{}'::jsonb
) returns public.registration_status
language plpgsql security definer set search_path = public
as $$
declare
  v_status public.registration_status;
  v_amount numeric;
begin
  select status, final_amount into v_status, v_amount
    from public.registrations where id = p_registration_id for update;
  if v_status is null then raise exception 'order not found'; end if;
  if v_status in ('cancelled', 'no_show', 'completed', 'refunded') then return v_status; end if;
  update public.payments set status = 'paid', midtrans_transaction_id = p_midtrans_transaction_id,
    paid_at = coalesce(paid_at, now()), webhook_payload = p_payload, reconciled_at = now(), updated_at = now()
    where registration_id = p_registration_id and status <> 'refunded';
  if v_status = 'refund_pending' then return v_status; end if;
  if coalesce(v_amount, 0) <= 0 then raise exception 'registration has no payable amount'; end if;
  update public.registrations set status = 'paid', updated_at = now()
    where id = p_registration_id and status in ('registered', 'pending_payment', 'paid');
  insert into public.escrow_holds (registration_id, amount, status, pickup_confirmed_at, auto_release_at)
    values (p_registration_id, coalesce(v_amount, 0), 'held', null, null)
    on conflict (registration_id) do nothing;
  update public.payment_attempts pa
     set status = 'paid', provider_transaction_id = p_midtrans_transaction_id, updated_at = now()
    from public.payments p
   where p.registration_id = p_registration_id
     and pa.payment_id = p.id
     and pa.status = 'pending';
  select status into v_status from public.registrations where id = p_registration_id;
  return v_status;
end;
$$;

create or replace function public.submit_order_complaint(
  p_registration_id uuid,
  p_complaint_category text,
  p_description text,
  p_photo_urls text[]
) returns uuid
language plpgsql security definer set search_path = public
as $$
declare v_dispute_id uuid; v_pickup_confirmed_at timestamptz;
begin
  if auth.uid() is null then raise exception 'sign in required'; end if;
  if p_complaint_category not in ('cacat', 'busuk') then raise exception 'invalid complaint category'; end if;
  select e.pickup_confirmed_at into v_pickup_confirmed_at
    from public.escrow_holds e where e.registration_id = p_registration_id;
  if v_pickup_confirmed_at is null or now() > v_pickup_confirmed_at + interval '24 hours'
     or not exists (select 1 from public.registrations where id = p_registration_id and umkm_id = auth.uid() and status in ('picked_up', 'completed')) then
    raise exception 'complaint window is closed';
  end if;
  if coalesce(array_length(p_photo_urls, 1), 0) < 1 then raise exception 'at least one photo is required'; end if;
  insert into public.disputes (registration_id, umkm_id, supplier_id, complaint_category, description, photo_urls)
    select r.id, r.umkm_id, b.supplier_id, p_complaint_category, coalesce(p_description, ''), to_jsonb(p_photo_urls)
      from public.registrations r join public.batches b on b.id = r.batch_id
     where r.id = p_registration_id
    on conflict (registration_id) do nothing
    returning id into v_dispute_id;
  if v_dispute_id is null then select id into v_dispute_id from public.disputes where registration_id = p_registration_id; end if;
  update public.escrow_holds set status = 'frozen', dispute_id = v_dispute_id where registration_id = p_registration_id and status in ('held', 'frozen');
  return v_dispute_id;
end;
$$;

create or replace function public.submit_order_rating(
  p_registration_id uuid,
  p_score integer,
  p_comment text default null
) returns uuid
language plpgsql security definer set search_path = public
as $$
declare v_rating_id uuid;
begin
  if auth.uid() is null or p_score < 1 or p_score > 5 then raise exception 'invalid rating'; end if;
  insert into public.ratings (registration_id, umkm_id, supplier_id, score, comment)
    select r.id, r.umkm_id, b.supplier_id, p_score, p_comment
      from public.registrations r join public.batches b on b.id = r.batch_id
     where r.id = p_registration_id and r.umkm_id = auth.uid() and r.status in ('picked_up', 'completed')
    returning id into v_rating_id;
  if v_rating_id is null then raise exception 'rating not available or already submitted'; end if;
  return v_rating_id;
end;
$$;

create or replace function public.attach_refund_bank_account(
  p_registration_id uuid,
  p_bank_name text,
  p_account_number text,
  p_account_holder_name text
) returns uuid
language plpgsql security definer set search_path = public
as $$
declare v_account_id uuid; v_refund_id uuid;
begin
  if auth.uid() is null then raise exception 'sign in required'; end if;
  if not exists (select 1 from public.refund_requests rr join public.registrations r on r.id = rr.registration_id where rr.registration_id = p_registration_id and r.umkm_id = auth.uid()) then
    raise exception 'refund is not eligible';
  end if;
  insert into public.umkm_bank_accounts (umkm_id, bank_name, account_number, account_holder_name)
    values (auth.uid(), p_bank_name, p_account_number, p_account_holder_name)
    on conflict (umkm_id, account_number) do update set bank_name = excluded.bank_name, account_holder_name = excluded.account_holder_name, updated_at = now()
    returning id into v_account_id;
  select id into v_refund_id from public.refund_requests where registration_id = p_registration_id;
  update public.refund_requests set umkm_bank_account_id = v_account_id, status = case when status = 'waiting_bank_account' then 'pending' else status end where id = v_refund_id;
  return v_account_id;
end;
$$;

-- The historical pickup RPC accepted the UMKM as a confirmer. Keep the
-- endpoint signature stable, but make the database gate supplier/admin-only
-- so a direct RPC call cannot bypass the route authorization.
create or replace function public.confirm_pickup(
  p_registration_id uuid,
  p_method text,
  p_code text default null,
  p_latitude numeric default null,
  p_longitude numeric default null,
  p_notes text default null,
  p_ip_address text default null,
  p_user_agent text default null
) returns void
language plpgsql security definer set search_path = public
as $$
declare
  v_supplier_id uuid;
  v_status public.registration_status;
begin
  if auth.uid() is null then raise exception 'sign in required'; end if;
  if p_registration_id is null then raise exception 'registration id is required'; end if;
  if p_method not in ('qr', 'pin') then raise exception 'method must be qr or pin'; end if;

  select b.supplier_id, r.status
    into v_supplier_id, v_status
    from public.registrations r
    join public.batches b on b.id = r.batch_id
   where r.id = p_registration_id;
  if not found then raise exception 'registration not found'; end if;
  if not ((auth.uid() = v_supplier_id and public.is_supplier()) or public.is_admin()) then
    raise exception 'only the owning supplier or an admin may confirm pickup';
  end if;
  if v_status <> 'paid' then
    if v_status = 'picked_up' then raise exception 'registration is already picked up'; end if;
    raise exception 'registration is not eligible for pickup (status %s)', v_status;
  end if;
  if p_code is null then raise exception 'code is required'; end if;
  if p_method = 'qr' then
    if not exists (select 1 from public.pickup_codes pc where pc.registration_id = p_registration_id and pc.qr_code_token = p_code and pc.used_at is null) then
      raise exception 'invalid or already-used qr code';
    end if;
  elsif not exists (select 1 from public.pickup_codes pc where pc.registration_id = p_registration_id and pc.pin_code = p_code and pc.used_at is null) then
    raise exception 'invalid or already-used pin';
  end if;

  update public.pickup_codes
     set used_at = now(), used_by_supplier_id = auth.uid()
   where registration_id = p_registration_id and used_at is null;
  insert into public.pickup_events (registration_id, supplier_id, method, latitude, longitude, notes)
    values (p_registration_id, v_supplier_id, p_method, p_latitude, p_longitude, p_notes);
  update public.registrations set status = 'picked_up', updated_at = now()
   where id = p_registration_id and status = 'paid';
  perform public.create_escrow(p_registration_id, now());
end;
$$;

revoke execute on function public.materialize_umkm_order(uuid) from public, anon;
grant execute on function public.materialize_umkm_order(uuid) to authenticated, service_role;
revoke execute on function public.finalize_payment(uuid, text, jsonb) from public, anon, authenticated;
grant execute on function public.finalize_payment(uuid, text, jsonb) to service_role;
revoke execute on function public.submit_order_complaint(uuid, text, text, text[]) from public, anon;
grant execute on function public.submit_order_complaint(uuid, text, text, text[]) to authenticated;
revoke execute on function public.submit_order_rating(uuid, integer, text) from public, anon;
grant execute on function public.submit_order_rating(uuid, integer, text) to authenticated;
revoke execute on function public.attach_refund_bank_account(uuid, text, text, text) from public, anon;
grant execute on function public.attach_refund_bank_account(uuid, text, text, text) to authenticated;
revoke execute on function public.confirm_pickup(uuid, text, text, numeric, numeric, text, text, text) from public, anon;
grant execute on function public.confirm_pickup(uuid, text, text, numeric, numeric, text, text, text) to authenticated;

create index if not exists registrations_umkm_status_created_idx
  on public.registrations (umkm_id, status, created_at desc);
