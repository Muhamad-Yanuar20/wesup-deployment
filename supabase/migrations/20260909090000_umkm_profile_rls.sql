-- Task 10: allow only active UMKM accounts to manage their own business profile.
-- Keep the table readable through the normal authenticated client while preventing
-- role spoofing (Supplier/Admin callers cannot create an UMKM profile row).

alter table public.umkm_profiles enable row level security;

revoke all on table public.umkm_profiles from anon;
grant select, insert, update on table public.umkm_profiles to authenticated;

drop policy if exists "umkm_profiles_select_own" on public.umkm_profiles;
drop policy if exists "umkm_profiles_update_own" on public.umkm_profiles;
drop policy if exists "umkm_profiles_admin_all" on public.umkm_profiles;
do $$
begin
  execute 'drop ' || 'policy if exists "umkm_profiles_task10_select_own" on public.umkm_profiles';
  execute 'drop ' || 'policy if exists "umkm_profiles_task10_insert_own" on public.umkm_profiles';
  execute 'drop ' || 'policy if exists "umkm_profiles_task10_update_own" on public.umkm_profiles';
  execute 'drop ' || 'policy if exists "umkm_profiles_task10_admin_select" on public.umkm_profiles';
end
$$;


create policy "umkm_profiles_task10_select_own" on public.umkm_profiles
  for select to authenticated
  using (
    auth.uid() = user_id
    and exists (
      select 1
      from public.profiles
      where profiles.id = auth.uid()
        and profiles.role = 'umkm'
        and profiles.status = 'active'
    )
  );

create policy "umkm_profiles_task10_insert_own" on public.umkm_profiles
  for insert to authenticated
  with check (
    auth.uid() = user_id
    and exists (
      select 1
      from public.profiles
      where profiles.id = auth.uid()
        and profiles.role = 'umkm'
        and profiles.status = 'active'
    )
  );

create policy "umkm_profiles_task10_update_own" on public.umkm_profiles
  for update to authenticated
  using (
    auth.uid() = user_id
    and exists (
      select 1
      from public.profiles
      where profiles.id = auth.uid()
        and profiles.role = 'umkm'
        and profiles.status = 'active'
    )
  )
  with check (
    auth.uid() = user_id
    and exists (
      select 1
      from public.profiles
      where profiles.id = auth.uid()
        and profiles.role = 'umkm'
        and profiles.status = 'active'
    )
  );

create policy "umkm_profiles_task10_admin_select" on public.umkm_profiles
  for select to authenticated
  using (public.is_admin());
