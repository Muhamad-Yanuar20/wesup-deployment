-- Repair UMKM registration for service-role API calls.
-- The service-role RPC must not read auth.users directly: Supabase keeps that
-- schema restricted even when the API request is authenticated as service_role.
-- The auth trigger creates profiles first, and umkm_profiles.user_id has a
-- foreign key to profiles(id), so profiles is the correct authorization anchor.

create or replace function public.create_umkm_registration(
  p_user_id uuid,
  p_latitude numeric,
  p_longitude numeric
)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_role public.user_role;
  v_status public.account_status;
  v_distance numeric;
begin
  if current_user <> 'service_role' then
    raise exception using errcode = '42501', message = 'service role required';
  end if;

  if p_user_id is null then
    raise exception using errcode = '22023', message = 'umkm registration user is required';
  end if;

  select p.role, p.status
    into v_role, v_status
    from public.profiles p
   where p.id = p_user_id;

  if not found then
    raise exception using errcode = 'P0001', message = 'umkm registration profile does not exist';
  end if;

  if v_role is distinct from 'umkm' then
    raise exception using errcode = '42501', message = 'umkm role required';
  end if;

  if v_status is distinct from 'active' then
    raise exception using errcode = '42501', message = 'active umkm account required';
  end if;

  if p_latitude is null or p_longitude is null
     or p_latitude < -90 or p_latitude > 90
     or p_longitude < -180 or p_longitude > 180 then
    raise exception using errcode = '22023', message = 'invalid UMKM coordinates';
  end if;

  v_distance := 6371 * acos(least(1.0, greatest(-1.0,
    sin(radians(-6.914744)) * sin(radians(p_latitude))
    + cos(radians(-6.914744)) * cos(radians(p_latitude))
      * cos(radians(p_longitude) - radians(107.60981))
  )));

  if v_distance > 50 then
    raise exception using errcode = '22023', message = 'UMKM location must be within Bandung';
  end if;

  insert into public.umkm_profiles (user_id, business_name, address, latitude, longitude)
  values (p_user_id, null, null, p_latitude, p_longitude)
  on conflict (user_id) do nothing;
end;
$$;

revoke execute on function public.create_umkm_registration(uuid, numeric, numeric)
  from public, anon, authenticated;
grant execute on function public.create_umkm_registration(uuid, numeric, numeric)
  to service_role;
