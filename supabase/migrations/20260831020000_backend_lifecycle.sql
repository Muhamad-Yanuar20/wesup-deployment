-- Wesup migration 0017: Catalog Batch CRUD + input validation + recurring config
-- Covers PRD:
--   * 2.1.2 Volume-Tiered Batch Offering (create/publish/update)
--   * 2.1.4 Recurring Batch Generation (recurring_configs)
--   * 2.1.5 Input Validation (linear timeline, tier monotonic + non-overlap,
--     Bandung geo-bounds)
--   * 2.2.6 Fulfillment prerequisites (batch must exist and be valid)
--
-- Design notes:
--   * Lazy Evaluation: no cron. Batch creation is triggered by the supplier's
--     explicit POST /api/suppliers/batches call.
--   * The linear timeline is enforced in DB both by constraint
--     (batch_timeline_linear_order) and re-validated here for friendly errors.
--   * Tier volume ranges must be monotonic (no inversion) and non-overlapping.
--   * Supplier creation is gated on an approved supplier profile (or an admin).
--   * Batch location is bounded to the Bandung operational region.
--   * Atomic: batch + tiers + timeline insert in one transaction (single function).

alter type public.audit_action add value 'create_batch';
alter type public.audit_action add value 'update_batch';
alter type public.audit_action add value 'delete_batch';

create or replace function public.is_supplier_approved()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1
      from public.supplier_profiles sp
     where sp.user_id = auth.uid()
       and sp.verification_status = 'approved'
  );
$$;

create or replace function public.create_batch(
  p_title text,
  p_description text,
  p_category text,
  p_min_quantity integer,
  p_product_photo_url text,
  p_pickup_address text,
  p_latitude numeric,
  p_longitude numeric,
  p_registration_opens_at timestamptz,
  p_registration_closes_at timestamptz,
  p_payment_opens_at timestamptz,
  p_payment_closes_at timestamptz,
  p_estimated_ready_at timestamptz,
  p_tiers jsonb,
  p_recurring_config_id uuid default null,
  p_ip_address text default null,
  p_user_agent text default null
) returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_batch_id uuid;
  v_tier jsonb;
  v_tier_number integer;
  v_prev_min integer;
  v_prev_max integer;
  v_prev_price numeric;
  v_is_admin boolean;
  v_supplier_id uuid;
  v_now timestamptz := now();
begin
  if auth.uid() is null then
    raise exception 'sign in required';
  end if;
  if p_title is null or trim(p_title) = '' then
    raise exception 'title is required';
  end if;
  if p_category is null or trim(p_category) = '' then
    raise exception 'category is required';
  end if;
  if p_min_quantity is null or p_min_quantity <= 0 then
    raise exception 'min quantity must be positive';
  end if;
  if p_pickup_address is null or trim(p_pickup_address) = '' then
    raise exception 'pickup address is required';
  end if;

  v_is_admin := public.is_admin();
  if not v_is_admin then
    v_supplier_id := auth.uid();
    if not public.is_supplier_approved() then
      raise exception 'only an approved supplier or an admin may create a batch';
    end if;
  else
    v_supplier_id := auth.uid();
  end if;

  -- Linear timeline validation (friendly error before DB constraint fires).
  if not (
    p_registration_opens_at < p_registration_closes_at
    and p_registration_closes_at < p_payment_opens_at
    and p_payment_opens_at < p_payment_closes_at
    and p_payment_closes_at < p_estimated_ready_at
  ) then
    raise exception 'timeline must be linear: open < close < payment open < payment close < ready';
  end if;

  -- Bandung operational geo-bounds (numerical checkbox).
  if p_latitude is null or p_longitude is null then
    raise exception 'latitude and longitude are required';
  end if;
  if p_latitude < -7.1 or p_latitude > -6.5
     or p_longitude < 107.4 or p_longitude > 107.9 then
    raise exception 'location is outside the Bandung operating region';
  end if;

  if p_tiers is null or jsonb_typeof(p_tiers) <> 'array' or jsonb_array_length(p_tiers) < 1 then
    raise exception 'at least one volume tier is required';
  end if;

  insert into public.batches (
    supplier_id, recurring_config_id, title, description, category,
    min_quantity, product_photo_url, pickup_address, latitude, longitude,
    status, created_at, updated_at
  ) values (
    v_supplier_id, p_recurring_config_id, trim(p_title), p_description,
    trim(p_category), p_min_quantity, p_product_photo_url, trim(p_pickup_address),
    p_latitude, p_longitude, 'published', v_now, v_now
  )
  returning id into v_batch_id;

  v_tier_number := 0;
  v_prev_min := 0;
  v_prev_max := 0;
  v_prev_price := 0;

  for v_tier in select * from jsonb_array_elements(p_tiers) loop
    v_tier_number := v_tier_number + 1;

    if (v_tier->>'min_volume') is null or (v_tier->>'price_per_unit') is null then
      raise exception 'each tier requires min_volume and price_per_unit';
    end if;

    -- Tier monotonicity: each tier starts after the previous tier's lower bound.
    if coalesce((v_tier->>'min_volume')::integer, 0) <= v_prev_min then
      raise exception 'tier volume ranges must be strictly increasing';
    end if;

    -- No-overlap: current tier's lower bound must be at least the previous tier's max+1.
    if v_prev_max is not null and v_prev_max > 0
       and coalesce((v_tier->>'min_volume')::integer, 0) <= v_prev_max then
      raise exception 'tier volume ranges must not overlap';
    end if;

    -- No-inversion: price must not increase with higher volume tiers (volume
    -- discounts: higher volume <= same or lower per-unit price).
    if coalesce((v_tier->>'price_per_unit')::numeric, 0) > v_prev_price
       and v_prev_price > 0 then
      raise exception 'tier price must not invert (higher volume cannot cost more per unit)';
    end if;

    insert into public.batch_tiers (
      batch_id, tier_number, min_volume, max_volume, price_per_unit
    ) values (
      v_batch_id,
      v_tier_number,
      (v_tier->>'min_volume')::integer,
      nullif(v_tier->>'max_volume', '')::integer,
      (v_tier->>'price_per_unit')::numeric
    );

    v_prev_min := (v_tier->>'min_volume')::integer;
    v_prev_max := coalesce(nullif(v_tier->>'max_volume', '')::integer, v_prev_min);
    v_prev_price := (v_tier->>'price_per_unit')::numeric;
  end loop;

  insert into public.batch_timeline (
    batch_id, registration_opens_at, registration_closes_at,
    payment_opens_at, payment_closes_at, estimated_ready_at
  ) values (
    v_batch_id, p_registration_opens_at, p_registration_closes_at,
    p_payment_opens_at, p_payment_closes_at, p_estimated_ready_at
  );

  insert into public.admin_audit_logs
    (admin_id, action_type, target_type, target_id, details, ip_address, user_agent)
  values
    (auth.uid(), 'create_batch', 'batches', v_batch_id,
     jsonb_build_object('title', p_title, 'tier_count', v_tier_number),
     p_ip_address, p_user_agent);

  return v_batch_id;
end;
$$;

revoke execute on function public.create_batch(
  text, text, text, integer, text, text, numeric, numeric, timestamptz,
  timestamptz, timestamptz, timestamptz, timestamptz, jsonb, uuid, text, text
) from public, anon;
grant execute on function public.create_batch(
  text, text, text, integer, text, text, numeric, numeric, timestamptz,
  timestamptz, timestamptz, timestamptz, timestamptz, jsonb, uuid, text, text
) to authenticated;

-- update_batch: allowed only while the batch has no committed registrations.
-- Once registrants exist, the batch is immutable (location lock + status).
create or replace function public.update_batch(
  p_batch_id uuid,
  p_title text default null,
  p_description text default null,
  p_category text default null,
  p_product_photo_url text default null,
  p_pickup_address text default null,
  p_latitude numeric default null,
  p_longitude numeric default null,
  p_ip_address text default null,
  p_user_agent text default null
) returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_supplier_id uuid;
  v_is_admin boolean;
  v_reg integer;
begin
  if auth.uid() is null then
    raise exception 'sign in required';
  end if;
  if p_batch_id is null then
    raise exception 'batch id is required';
  end if;

  v_is_admin := public.is_admin();

  select supplier_id into v_supplier_id
    from public.batches
   where id = p_batch_id
     and status in ('draft', 'published');
  if not found then
    raise exception 'batch not found or not editable';
  end if;

  if not v_is_admin and v_supplier_id <> auth.uid() then
    raise exception 'only the owning supplier or an admin may edit this batch';
  end if;

  -- Location lock: once there are registrants, immutable.
  select count(*) into v_reg
    from public.registrations
   where batch_id = p_batch_id
     and status not in ('cancelled', 'refunded', 'refund_pending');
  if v_reg > 0 and (p_latitude is not null or p_longitude is not null or p_pickup_address is not null) then
    raise exception 'location and pickup details are locked once registrants exist';
  end if;

  if p_latitude is not null or p_longitude is not null then
    if coalesce(p_latitude, 0) < -7.1 or coalesce(p_latitude, 0) > -6.5
       or coalesce(p_longitude, 0) < 107.4 or coalesce(p_longitude, 0) > 107.9 then
      raise exception 'location is outside the Bandung operating region';
    end if;
  end if;

  update public.batches
     set title = coalesce(p_title, title),
         description = coalesce(p_description, description),
         category = coalesce(p_category, category),
         product_photo_url = coalesce(p_product_photo_url, product_photo_url),
         pickup_address = coalesce(p_pickup_address, pickup_address),
         latitude = coalesce(p_latitude, latitude),
         longitude = coalesce(p_longitude, longitude),
         updated_at = now()
   where id = p_batch_id;

  insert into public.admin_audit_logs
    (admin_id, action_type, target_type, target_id, details, ip_address, user_agent)
  values
    (auth.uid(), 'update_batch', 'batches', p_batch_id,
     jsonb_build_object('updated', true), p_ip_address, p_user_agent);
end;
$$;

revoke execute on function public.update_batch(uuid, text, text, text, text, text, numeric, numeric, text, text) from public, anon;
grant execute on function public.update_batch(uuid, text, text, text, text, text, numeric, numeric, text, text) to authenticated;

-- delete_batch: hard-delete only when there are no registrants at all; if
-- registrants exist, route the caller to cancel_batch (soft cancellation).
create or replace function public.delete_batch(
  p_batch_id uuid,
  p_ip_address text default null,
  p_user_agent text default null
) returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_supplier_id uuid;
  v_is_admin boolean;
  v_reg integer;
begin
  if auth.uid() is null then
    raise exception 'sign in required';
  end if;
  if p_batch_id is null then
    raise exception 'batch id is required';
  end if;

  v_is_admin := public.is_admin();

  select supplier_id into v_supplier_id
    from public.batches
   where id = p_batch_id;
  if not found then
    raise exception 'batch not found';
  end if;
  if not v_is_admin and v_supplier_id <> auth.uid() then
    raise exception 'only the owning supplier or an admin may delete this batch';
  end if;

  select count(*) into v_reg
    from public.registrations
   where batch_id = p_batch_id;
  if v_reg > 0 then
    raise exception 'batch has registrants; cancel instead of delete';
  end if;

  delete from public.batches where id = p_batch_id;

  insert into public.admin_audit_logs
    (admin_id, action_type, target_type, target_id, details, ip_address, user_agent)
  values
    (auth.uid(), 'delete_batch', 'batches', p_batch_id,
     jsonb_build_object('deleted', true), p_ip_address, p_user_agent);
end;
$$;

revoke execute on function public.delete_batch(uuid, text, text) from public, anon;
grant execute on function public.delete_batch(uuid, text, text) to authenticated;

-- list_own_batches: a supplier (or admin) lists their batches with tiers and
-- timeline denormalised for the dashboard.
create or replace function public.list_own_batches()
returns table (
  id uuid,
  title text,
  category text,
  status public.batch_status,
  min_quantity integer,
  pickup_address text,
  latitude numeric,
  longitude numeric,
  registration_opens_at timestamptz,
  registration_closes_at timestamptz,
  payment_opens_at timestamptz,
  payment_closes_at timestamptz,
  estimated_ready_at timestamptz,
  tiers jsonb,
  created_at timestamptz
)
language sql
security definer
set search_path = public
stable
as $$
  select
    b.id, b.title, b.category, b.status, b.min_quantity,
    b.pickup_address, b.latitude, b.longitude,
    t.registration_opens_at, t.registration_closes_at,
    t.payment_opens_at, t.payment_closes_at, t.estimated_ready_at,
    coalesce((
      select jsonb_agg(jsonb_build_object(
        'tier_number', bt.tier_number,
        'min_volume', bt.min_volume,
        'max_volume', bt.max_volume,
        'price_per_unit', bt.price_per_unit
      ) order by bt.tier_number)
      from public.batch_tiers bt
      where bt.batch_id = b.id
    ), '[]'::jsonb) as tiers,
    b.created_at
    from public.batches b
    left join public.batch_timeline t on t.batch_id = b.id
   where b.supplier_id = auth.uid()
      or public.is_admin()
   order by b.created_at desc;
$$;

revoke execute on function public.list_own_batches() from public, anon;
grant execute on function public.list_own_batches() to authenticated;

-- create_recurring_config: a supplier schedules recurring batch generation.
-- Lazy Evaluation: batches are only generated on-demand (the reconcile call or
-- an explicit generation RPC), never by a DB timer.
create or replace function public.create_recurring_config(
  p_name text default null,
  p_interval_days integer default 7,
  p_days_of_week smallint[] default '{}'::smallint[]
) returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
begin
  if auth.uid() is null then
    raise exception 'sign in required';
  end if;
  if not public.is_supplier_approved() and not public.is_admin() then
    raise exception 'only an approved supplier or an admin may create a recurring config';
  end if;
  if p_interval_days is null or p_interval_days <= 0 then
    raise exception 'interval days must be positive';
  end if;

  insert into public.recurring_configs (
    supplier_id, name, interval_days, days_of_week, is_active
  ) values (
    auth.uid(), p_name, p_interval_days, p_days_of_week, true
  )
  returning id into v_id;

  return v_id;
end;
$$;

revoke execute on function public.create_recurring_config(text, integer, smallint[]) from public, anon;
grant execute on function public.create_recurring_config(text, integer, smallint[]) to authenticated;
