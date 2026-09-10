-- Repair profile privacy drift in environments where the original RLS
-- migrations were not applied or were disabled manually.

alter table public.profiles enable row level security;
alter table public.supplier_profiles enable row level security;

revoke select on public.profiles from anon;
revoke select on public.supplier_profiles from anon;

drop policy if exists "profiles_select_own" on public.profiles;
drop policy if exists "profiles_select_admin" on public.profiles;
create policy "profiles_rls_recovery_select_own" on public.profiles
  for select to authenticated
  using (auth.uid() = id);
create policy "profiles_rls_recovery_select_admin" on public.profiles
  for select to authenticated
  using (public.is_admin());

drop policy if exists "supplier_profiles_select_own" on public.supplier_profiles;
drop policy if exists "supplier_profiles_insert_own" on public.supplier_profiles;
drop policy if exists "supplier_profiles_update_own" on public.supplier_profiles;
drop policy if exists "supplier_profiles_admin_all" on public.supplier_profiles;
create policy "supplier_profiles_rls_recovery_select_own" on public.supplier_profiles
  for select to authenticated
  using (user_id = auth.uid());
create policy "supplier_profiles_rls_recovery_insert_own" on public.supplier_profiles
  for insert to authenticated
  with check (user_id = auth.uid());
create policy "supplier_profiles_rls_recovery_update_own" on public.supplier_profiles
  for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());
create policy "supplier_profiles_rls_recovery_admin_all" on public.supplier_profiles
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());
