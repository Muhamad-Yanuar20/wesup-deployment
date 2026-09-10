-- Repair migration for environments where the UMKM registration/profile
-- migrations were not applied in order or their grants/policies drifted.
-- This migration is intentionally idempotent and does not fabricate location
-- data for legacy accounts.

alter table public.umkm_profiles
  alter column business_name drop not null,
  alter column address drop not null;

alter table public.umkm_profiles enable row level security;

revoke all on table public.umkm_profiles from anon;
grant select, insert, update on table public.umkm_profiles to authenticated;

do $$
begin
  execute 'drop ' || 'policy if exists "umkm_profiles_select_own" on public.umkm_profiles';
  execute 'drop ' || 'policy if exists "umkm_profiles_update_own" on public.umkm_profiles';
  execute 'drop ' || 'policy if exists "umkm_profiles_admin_all" on public.umkm_profiles';
  execute 'drop ' || 'policy if exists "umkm_profiles_task10_select_own" on public.umkm_profiles';
  execute 'drop ' || 'policy if exists "umkm_profiles_task10_insert_own" on public.umkm_profiles';
  execute 'drop ' || 'policy if exists "umkm_profiles_task10_update_own" on public.umkm_profiles';
  execute 'drop ' || 'policy if exists "umkm_profiles_task10_admin_select" on public.umkm_profiles';
  execute 'drop ' || 'policy if exists "umkm_profiles_recovery_select_own" on public.umkm_profiles';
  execute 'drop ' || 'policy if exists "umkm_profiles_recovery_insert_own" on public.umkm_profiles';
  execute 'drop ' || 'policy if exists "umkm_profiles_recovery_update_own" on public.umkm_profiles';
  execute 'drop ' || 'policy if exists "umkm_profiles_recovery_admin_all" on public.umkm_profiles';
end
$$;
create policy "umkm_profiles_recovery_select_own" on public.umkm_profiles
  for select to authenticated
  using (
    (select auth.uid()) = user_id
    and exists (
      select 1
      from public.profiles p
      where p.id = (select auth.uid())
        and p.role = 'umkm'
        and p.status = 'active'
    )
  );

create policy "umkm_profiles_recovery_insert_own" on public.umkm_profiles
  for insert to authenticated
  with check (
    (select auth.uid()) = user_id
    and exists (
      select 1
      from public.profiles p
      where p.id = (select auth.uid())
        and p.role = 'umkm'
        and p.status = 'active'
    )
  );

create policy "umkm_profiles_recovery_update_own" on public.umkm_profiles
  for update to authenticated
  using (
    (select auth.uid()) = user_id
    and exists (
      select 1
      from public.profiles p
      where p.id = (select auth.uid())
        and p.role = 'umkm'
        and p.status = 'active'
    )
  )
  with check (
    (select auth.uid()) = user_id
    and exists (
      select 1
      from public.profiles p
      where p.id = (select auth.uid())
        and p.role = 'umkm'
        and p.status = 'active'
    )
  );

create policy "umkm_profiles_recovery_admin_all" on public.umkm_profiles
  for all to authenticated
  using ((select public.is_admin()))
  with check ((select public.is_admin()));

-- The auth trigger is the only place allowed to create a public profile at
-- signup. Role is deliberately fixed to UMKM; user metadata is not trusted for
-- authorization decisions.
create or replace function public.handle_new_user() returns trigger
  language plpgsql
  security definer
  set search_path = ''
as $$
begin
  insert into public.profiles (id, full_name, phone, email, role)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name', ''),
    coalesce(new.phone, new.raw_user_meta_data ->> 'phone'),
    lower(btrim(new.email)),
    'umkm'
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

revoke execute on function public.handle_new_user() from public, anon, authenticated;

do $$
begin
  if not exists (
    select 1
    from pg_trigger
    where tgname = 'on_auth_user_created'
      and tgrelid = 'auth.users'::regclass
      and not tgisinternal
  ) then
    create trigger on_auth_user_created
      after insert on auth.users
      for each row execute function public.handle_new_user();
  end if;
end;
$$;

-- This function is invoked through the service-role client. It remains
-- invoker-security so it cannot become an accidental RLS bypass for another
-- database role; the explicit current_user guard is a second boundary.
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

  select p.role into v_role
  from public.profiles p
  where p.id = p_user_id;

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
  values (p_user_id, null, null, p_latitude, p_longitude)
  on conflict (user_id) do nothing;
end;
$$;

revoke execute on function public.create_umkm_registration(uuid, numeric, numeric)
  from public, anon, authenticated;
grant execute on function public.create_umkm_registration(uuid, numeric, numeric)
  to service_role;


