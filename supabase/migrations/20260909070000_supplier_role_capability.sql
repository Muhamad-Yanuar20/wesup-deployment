-- Supplier identity is permanent; operational access is granted only after approval.
-- Existing supplier_profiles rows are backfilled before the approval trigger is removed.

update public.profiles p
   set role = 'supplier',
       updated_at = now()
 where p.role <> 'supplier'
   and exists (
     select 1
       from public.supplier_profiles sp
      where sp.user_id = p.id
   );

drop trigger if exists promote_supplier_on_approval on public.supplier_profiles;
drop function if exists public.promote_supplier_on_approval();

create or replace function public.is_approved_supplier()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
      from public.profiles p
      join public.supplier_profiles sp on sp.user_id = p.id
     where p.id = auth.uid()
       and p.role = 'supplier'
       and p.status = 'active'
       and sp.verification_status = 'approved'
  );
$$;

-- Keep the legacy helper available to RPCs, but make it an operational capability
-- check so pending/rejected suppliers cannot use old pickup functions.
create or replace function public.is_supplier()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
      from public.profiles p
      join public.supplier_profiles sp on sp.user_id = p.id
     where p.id = auth.uid()
       and p.role = 'supplier'
       and p.status = 'active'
       and sp.verification_status = 'approved'
  );
$$;
create or replace function public.catalog_supplier_approved()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.is_approved_supplier();
$$;

-- Replace ownership-only policies with approved-supplier capability policies.
drop policy if exists "recurring_configs_own_all" on public.recurring_configs;
create policy "recurring_configs_supplier_capability_all" on public.recurring_configs
  for all to authenticated
  using (supplier_id = auth.uid() and public.is_approved_supplier())
  with check (supplier_id = auth.uid() and public.is_approved_supplier());

drop policy if exists "batches_supplier_all" on public.batches;
drop policy if exists "batches_supplier_approved_all" on public.batches;
create policy "batches_supplier_capability_all" on public.batches
  for all to authenticated
  using (supplier_id = auth.uid() and public.is_approved_supplier())
  with check (supplier_id = auth.uid() and public.is_approved_supplier());

drop policy if exists "batch_tiers_supplier_all" on public.batch_tiers;
drop policy if exists "batch_tiers_supplier_approved_all" on public.batch_tiers;
create policy "batch_tiers_supplier_capability_all" on public.batch_tiers
  for all to authenticated
  using (
    public.is_approved_supplier()
    and exists (
      select 1 from public.batches b
       where b.id = batch_id and b.supplier_id = auth.uid()
    )
  )
  with check (
    public.is_approved_supplier()
    and exists (
      select 1 from public.batches b
       where b.id = batch_id and b.supplier_id = auth.uid()
    )
  );

drop policy if exists "batch_timeline_supplier_all" on public.batch_timeline;
drop policy if exists "batch_timeline_supplier_approved_all" on public.batch_timeline;
create policy "batch_timeline_supplier_capability_all" on public.batch_timeline
  for all to authenticated
  using (
    public.is_approved_supplier()
    and exists (
      select 1 from public.batches b
       where b.id = batch_id and b.supplier_id = auth.uid()
    )
  )
  with check (
    public.is_approved_supplier()
    and exists (
      select 1 from public.batches b
       where b.id = batch_id and b.supplier_id = auth.uid()
    )
  );

drop policy if exists "supplier_bank_accounts_own_all" on public.supplier_bank_accounts;
create policy "supplier_bank_accounts_capability_all" on public.supplier_bank_accounts
  for all to authenticated
  using (supplier_id = auth.uid() and public.is_approved_supplier())
  with check (supplier_id = auth.uid() and public.is_approved_supplier());

drop policy if exists "registrations_umkm_all" on public.registrations;
create policy "registrations_umkm_role_all" on public.registrations
  for all to authenticated
  using (
    umkm_id = auth.uid()
    and exists (
      select 1 from public.profiles p
       where p.id = auth.uid() and p.role = 'umkm' and p.status = 'active'
    )
  )
  with check (
    umkm_id = auth.uid()
    and exists (
      select 1 from public.profiles p
       where p.id = auth.uid() and p.role = 'umkm' and p.status = 'active'
    )
  );

drop policy if exists "registrations_supplier_select" on public.registrations;
create policy "registrations_supplier_capability_select" on public.registrations
  for select to authenticated
  using (
    public.is_approved_supplier()
    and exists (
      select 1 from public.batches b
       where b.id = batch_id and b.supplier_id = auth.uid()
    )
  );

drop policy if exists "pickup_codes_supplier_select" on public.pickup_codes;
create policy "pickup_codes_supplier_capability_select" on public.pickup_codes
  for select to authenticated
  using (
    public.is_approved_supplier()
    and exists (
      select 1
        from public.registrations r
        join public.batches b on b.id = r.batch_id
       where r.id = registration_id and b.supplier_id = auth.uid()
    )
  );

drop policy if exists "pickup_events_supplier_insert" on public.pickup_events;
create policy "pickup_events_supplier_capability_insert" on public.pickup_events
  for insert to authenticated
  with check (
    public.is_approved_supplier()
    and supplier_id = auth.uid()
    and exists (
      select 1
        from public.registrations r
        join public.batches b on b.id = r.batch_id
       where r.id = registration_id and b.supplier_id = auth.uid()
    )
  );

drop policy if exists "pickup_events_supplier_select" on public.pickup_events;
create policy "pickup_events_supplier_capability_select" on public.pickup_events
  for select to authenticated
  using (
    public.is_approved_supplier()
    and exists (
      select 1
        from public.registrations r
        join public.batches b on b.id = r.batch_id
       where r.id = registration_id and b.supplier_id = auth.uid()
    )
  );

drop policy if exists "disputes_supplier_select" on public.disputes;
create policy "disputes_supplier_capability_select" on public.disputes
  for select to authenticated
  using (public.is_approved_supplier() and supplier_id = auth.uid());

drop policy if exists "escrow_holds_supplier_select" on public.escrow_holds;
create policy "escrow_holds_supplier_capability_select" on public.escrow_holds
  for select to authenticated
  using (
    public.is_approved_supplier()
    and exists (
      select 1
        from public.registrations r
        join public.batches b on b.id = r.batch_id
       where r.id = registration_id and b.supplier_id = auth.uid()
    )
  );

drop policy if exists "refund_requests_supplier_select" on public.refund_requests;
create policy "refund_requests_supplier_capability_select" on public.refund_requests
  for select to authenticated
  using (
    public.is_approved_supplier()
    and exists (
      select 1
        from public.registrations r
        join public.batches b on b.id = r.batch_id
       where r.id = registration_id and b.supplier_id = auth.uid()
    )
  );

drop policy if exists "payments_supplier_select" on public.payments;
create policy "payments_supplier_capability_select" on public.payments
  for select to authenticated
  using (
    public.is_approved_supplier()
    and exists (
      select 1
        from public.registrations r
        join public.batches b on b.id = r.batch_id
       where r.id = registration_id and b.supplier_id = auth.uid()
    )
  );

-- The order RPC is security-definer, so it needs the same capability check as RLS.
create or replace function public.list_batch_orders(p_batch_id uuid)
returns table (
  registration_id uuid,
  umkm_name text,
  quantity integer,
  status public.registration_status,
  final_amount numeric,
  lock_tier integer,
  created_at timestamptz
)
language sql
security definer
set search_path = public
stable
as $$
  select r.id, p.full_name, r.quantity, r.status, r.final_amount,
         r.locked_tier_number, r.created_at
    from public.registrations r
    join public.profiles p on p.id = r.umkm_id
   where r.batch_id = p_batch_id
     and (
       (public.is_approved_supplier() and exists (
         select 1 from public.batches b
          where b.id = p_batch_id and b.supplier_id = auth.uid()
       ))
       or public.is_admin()
     )
   order by r.created_at;
$$;

revoke execute on function public.is_approved_supplier() from public, anon;
grant execute on function public.is_approved_supplier() to authenticated;
revoke execute on function public.is_supplier() from public, anon;
grant execute on function public.is_supplier() to authenticated;
revoke execute on function public.catalog_supplier_approved() from public, anon;
grant execute on function public.catalog_supplier_approved() to authenticated;
