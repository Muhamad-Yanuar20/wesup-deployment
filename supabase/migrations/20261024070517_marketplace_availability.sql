begin;
-- Availability is evaluated at read time, without materializing transactions.
create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

create or replace function private.marketplace_availability(p_batch_id uuid default null)
returns table (
  id uuid, batch_status text, registration_opens_at timestamptz,
  registration_closes_at timestamptz, capacity_quantity integer,
  registered_quantity bigint, can_register boolean, unavailable_reason text,
  remaining_quantity bigint, server_time timestamptz
)
language sql stable set search_path = public as $$
  with snapshot as (
    select b.id, b.status::text as batch_status, b.registration_closed_at, b.close_reason,
      t.registration_opens_at, coalesce(b.registration_closed_at, t.registration_closes_at) as registration_closes_at,
      coalesce(b.capacity_quantity, case when limits.unbounded then null else limits.maximum end) as capacity_quantity,
      coalesce(b.final_registered_quantity, volumes.registered_quantity, 0)::bigint as registered_quantity,
      coalesce(volumes.occupied_quantity, 0)::bigint as occupied_quantity,
      limits.has_tiers, statement_timestamp() as server_time
    from public.batches b
    left join public.batch_timeline t on t.batch_id = b.id
    left join lateral (
      select count(*) > 0 as has_tiers, bool_or(bt.max_volume is null) as unbounded, max(bt.max_volume) as maximum
      from public.batch_tiers bt where bt.batch_id = b.id
    ) limits on true
    left join lateral (
      select sum(r.quantity) filter (where r.status in ('registered', 'pending_payment')) as registered_quantity,
        sum(r.quantity) filter (where
          (b.transaction_policy_version = 2 and r.status = 'registered') or
          (b.transaction_policy_version <> 2 and r.status in ('registered', 'pending_payment', 'paid', 'picked_up', 'completed'))
        ) as occupied_quantity
      from public.registrations r where r.batch_id = b.id
    ) volumes on true
    where b.status in ('published', 'closed', 'completed') and (p_batch_id is null or b.id = p_batch_id)
  ), evaluated as (
    select s.*, case
      when s.batch_status <> 'published' or s.registration_closed_at is not null then
        case when s.close_reason = 'capacity_reached' then 'full'
             when s.close_reason in ('registration_expired', 'no_registrations') then 'expired' else 'closed' end
      when not s.has_tiers or s.registration_opens_at is null or s.registration_closes_at is null then 'closed'
      when s.server_time < s.registration_opens_at then 'not_open'
      when s.server_time >= s.registration_closes_at then 'expired'
      when s.capacity_quantity is not null and s.occupied_quantity >= s.capacity_quantity then 'full'
      else null end as reason
    from snapshot s
  )
  select e.id, e.batch_status, e.registration_opens_at, e.registration_closes_at,
    e.capacity_quantity, e.registered_quantity, e.reason is null, e.reason,
    case when e.capacity_quantity is null then null else greatest(0, e.capacity_quantity::bigint - e.occupied_quantity) end,
    e.server_time
  from evaluated e;
$$;
revoke all on function private.marketplace_availability(uuid) from public, anon, authenticated;

-- Return metadata is additive; replace the two RPCs atomically and restore grants.
drop function public.search_batches(text, text[], numeric, numeric, numeric, numeric, numeric, integer, integer);
drop function public.get_marketplace_batch(uuid, numeric, numeric);

create function public.get_marketplace_batch(
  p_batch_id uuid,
  p_lat numeric default null,
  p_lng numeric default null
)
returns table (
  id uuid,
  supplier_name text,
  title text,
  description text,
  category text,
  min_quantity integer,
  product_photo_url text,
  pickup_address text,
  latitude numeric,
  longitude numeric,
  tiers jsonb,
  registered_quantity bigint,
  current_price_per_unit numeric,
  registration_closes_at timestamptz,
  distance_km numeric,
  total_count bigint,
  batch_status text, registration_opens_at timestamptz, capacity_quantity integer,
  can_register boolean, unavailable_reason text, remaining_quantity bigint, server_time timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  with visible as (
    select b.id,
           coalesce(sp.business_name, p.full_name) as supplier_name,
           b.title,
           b.description,
           b.category,
           b.min_quantity,
           b.product_photo_url,
           b.pickup_address,
           b.latitude,
           b.longitude,
           coalesce(t.tiers, '[]'::jsonb) as tiers_json,
           a.registered_quantity::bigint as registered_quantity,
           coalesce(
             (
               select bt.price_per_unit
                 from public.batch_tiers bt
                where bt.batch_id = b.id
                  and bt.min_volume <= a.registered_quantity
                order by bt.min_volume desc, bt.tier_number desc
                limit 1
             ),
             (
               select bt.price_per_unit
                 from public.batch_tiers bt
                where bt.batch_id = b.id
                order by bt.tier_number
                limit 1
             )
           ) as current_price_per_unit,
           a.registration_closes_at,
           a.batch_status, a.registration_opens_at, a.capacity_quantity, a.can_register, a.unavailable_reason, a.remaining_quantity, a.server_time,
           case
             when p_lat is null or p_lng is null then null::numeric
             else round(
               (6371 * acos(least(1.0, greatest(-1.0,
                 sin(radians(p_lat)) * sin(radians(b.latitude))
                 + cos(radians(p_lat)) * cos(radians(b.latitude))
                   * cos(radians(b.longitude) - radians(p_lng))
               ))))::numeric
             , 2)
           end as distance_km
      from public.batches b
      join public.profiles p on p.id = b.supplier_id
      left join public.supplier_profiles sp on sp.user_id = b.supplier_id
      join private.marketplace_availability(p_batch_id) a on a.id = b.id
      left join lateral (
        select jsonb_agg(
                 jsonb_build_object(
                   'tier_number', bt.tier_number,
                   'min_volume', bt.min_volume,
                   'max_volume', bt.max_volume,
                   'price_per_unit', bt.price_per_unit
                 )
                 order by bt.tier_number
               ) as tiers
          from public.batch_tiers bt
         where bt.batch_id = b.id
      ) t on true
     where b.id = p_batch_id
       and b.status in ('published', 'closed', 'completed')
  )
  select v.id,
         v.supplier_name,
         v.title,
         v.description,
         v.category,
         v.min_quantity,
         v.product_photo_url,
         v.pickup_address,
         v.latitude,
         v.longitude,
         v.tiers_json as tiers,
         v.registered_quantity,
         v.current_price_per_unit,
         v.registration_closes_at,
         v.distance_km,
         count(*) over () as total_count,
         v.batch_status, v.registration_opens_at, v.capacity_quantity, v.can_register, v.unavailable_reason, v.remaining_quantity, v.server_time
    from visible v;
$$;

create function public.search_batches(
  p_query text default null,
  p_categories text[] default null,
  p_lat numeric default null,
  p_lng numeric default null,
  p_radius_km numeric default null,
  p_min_price numeric default null,
  p_max_price numeric default null,
  p_limit integer default 12,
  p_offset integer default 0
)
returns table (
  id uuid,
  supplier_name text,
  title text,
  description text,
  category text,
  min_quantity integer,
  product_photo_url text,
  pickup_address text,
  latitude numeric,
  longitude numeric,
  tiers jsonb,
  registered_quantity bigint,
  current_price_per_unit numeric,
  registration_closes_at timestamptz,
  distance_km numeric,
  total_count bigint,
  batch_status text, registration_opens_at timestamptz, capacity_quantity integer,
  can_register boolean, unavailable_reason text, remaining_quantity bigint, server_time timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  with base as (
    select b.id,
           coalesce(sp.business_name, p.full_name) as supplier_name,
           b.title,
           b.description,
           b.category,
           b.min_quantity,
           b.product_photo_url,
           b.pickup_address,
           b.latitude,
           b.longitude,
           b.created_at,
           coalesce(t.tiers, '[]'::jsonb) as tiers_json,
           a.registered_quantity::bigint as registered_quantity,
           coalesce(
             (
               select bt.price_per_unit
                 from public.batch_tiers bt
                where bt.batch_id = b.id
                  and bt.min_volume <= a.registered_quantity
                order by bt.min_volume desc, bt.tier_number desc
                limit 1
             ),
             (
               select bt.price_per_unit
                 from public.batch_tiers bt
                where bt.batch_id = b.id
                order by bt.tier_number
                limit 1
             )
           ) as current_price_per_unit,
           a.registration_closes_at,
           a.batch_status, a.registration_opens_at, a.capacity_quantity, a.can_register, a.unavailable_reason, a.remaining_quantity, a.server_time,
           case
             when p_lat is null or p_lng is null then null::numeric
             else round(
               (6371 * acos(least(1.0, greatest(-1.0,
                 sin(radians(p_lat)) * sin(radians(b.latitude))
                 + cos(radians(p_lat)) * cos(radians(b.latitude))
                   * cos(radians(b.longitude) - radians(p_lng))
               ))))::numeric
             , 2)
           end as distance_km
      from public.batches b
      join public.profiles p on p.id = b.supplier_id
      left join public.supplier_profiles sp on sp.user_id = b.supplier_id
      join private.marketplace_availability(null) a on a.id = b.id
      left join lateral (
        select jsonb_agg(
                 jsonb_build_object(
                   'tier_number', bt.tier_number,
                   'min_volume', bt.min_volume,
                   'max_volume', bt.max_volume,
                   'price_per_unit', bt.price_per_unit
                 )
                 order by bt.tier_number
               ) as tiers
          from public.batch_tiers bt
         where bt.batch_id = b.id
      ) t on true
     where b.status = 'published' and a.can_register
       and (p_query is null or p_query = ''
            or b.title ilike '%' || p_query || '%'
            or b.description ilike '%' || p_query || '%'
            or coalesce(sp.business_name, p.full_name) ilike '%' || p_query || '%')
       and (p_categories is null
            or array_length(p_categories, 1) is null
            or b.category = any (p_categories))
       and (p_lat is null or p_lng is null or p_radius_km is null
            or (
              b.latitude between p_lat - (p_radius_km / 111.045)
                            and p_lat + (p_radius_km / 111.045)
              and b.longitude between
                    p_lng - (p_radius_km / (111.045 * greatest(0.01, cos(radians(p_lat)))))
                and p_lng + (p_radius_km / (111.045 * greatest(0.01, cos(radians(p_lat)))))
            ))
  ),
  filtered as (
    select b.*
      from base b
     where (p_lat is null or p_lng is null or p_radius_km is null
            or b.distance_km is null or b.distance_km <= p_radius_km)
       and (p_min_price is null or b.current_price_per_unit >= p_min_price)
       and (p_max_price is null or b.current_price_per_unit <= p_max_price)
  )
  select f.id,
         f.supplier_name,
         f.title,
         f.description,
         f.category,
         f.min_quantity,
         f.product_photo_url,
         f.pickup_address,
         f.latitude,
         f.longitude,
         f.tiers_json as tiers,
         f.registered_quantity,
         f.current_price_per_unit,
         f.registration_closes_at,
         f.distance_km,
         count(*) over () as total_count,
         f.batch_status, f.registration_opens_at, f.capacity_quantity, f.can_register, f.unavailable_reason, f.remaining_quantity, f.server_time
    from filtered f
   order by f.distance_km asc nulls last, f.created_at desc
   limit least(greatest(coalesce(p_limit, 12), 1), 50)
   offset greatest(coalesce(p_offset, 0), 0);
$$;

revoke execute on function public.get_marketplace_batch(uuid, numeric, numeric)
  from public, anon, authenticated;
grant execute on function public.get_marketplace_batch(uuid, numeric, numeric)
  to anon, authenticated;

revoke execute on function public.search_batches(text, pg_catalog._text, numeric, numeric, numeric, numeric, numeric, integer, integer)
  from public, anon, authenticated;
grant execute on function public.search_batches(text, pg_catalog._text, numeric, numeric, numeric, numeric, numeric, integer, integer)
  to anon, authenticated;

notify pgrst, 'reload schema';

commit;
