-- Wesup: allow UMKM location to be captured before the business profile is complete.
-- The function is intentionally callable only by the service role after auth signup.

alter table public.umkm_profiles
  alter column business_name drop not null,
  alter column address drop not null;

create or replace function public.create_umkm_registration(
  p_user_id uuid,
  p_latitude numeric,
  p_longitude numeric
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_role public.user_role;
  v_distance numeric;
begin
  if current_user <> 'service_role' then
    raise exception using errcode = '42501', message = 'service role required';
  end if;

  if p_user_id is null or not exists (
    select 1 from auth.users where id = p_user_id
  ) then
    raise exception 'umkm registration user does not exist';
  end if;

  select role into v_role
  from public.profiles
  where id = p_user_id;
  if v_role is distinct from 'umkm' then
    raise exception using errcode = '42501', message = 'umkm role required';
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
  values (p_user_id, null, null, p_latitude, p_longitude);
end;
$$;

revoke execute on function public.create_umkm_registration(uuid, numeric, numeric)
  from public, anon, authenticated;
grant execute on function public.create_umkm_registration(uuid, numeric, numeric)
  to service_role;
