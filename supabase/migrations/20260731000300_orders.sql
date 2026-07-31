-- Wesup migration 0003: order & batch processing
-- Covers PRD module 4 (Order & Batch Processing): registrations with
-- location consent audit trail and the persistent counter mirror.

-- ============================================================
-- registrations: UMKM joins a batch with explicit location consent
-- ============================================================
create table public.registrations (
  id uuid primary key default gen_random_uuid(),
  batch_id uuid not null references public.batches (id),
  umkm_id uuid not null references public.profiles (id),
  quantity integer not null check (quantity > 0),
  consented_at timestamptz not null,
  consent_latitude numeric(10, 7),
  consent_longitude numeric(10, 7),
  status public.registration_status not null default 'registered',
  locked_tier_number integer,
  locked_price_per_unit numeric(12, 2),
  final_amount numeric(12, 2),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (batch_id, umkm_id)
);

alter table public.registrations enable row level security;

create policy "registrations_umkm_all" on public.registrations
  for all using (umkm_id = auth.uid());
create policy "registrations_supplier_select" on public.registrations
  for select using (
    exists (select 1 from public.batches b where b.id = batch_id and b.supplier_id = auth.uid())
  );
create policy "registrations_admin_select" on public.registrations
  for select using (public.is_admin());

create index registrations_batch_idx on public.registrations (batch_id);
create index registrations_umkm_idx on public.registrations (umkm_id);
create index registrations_status_idx on public.registrations (status);

-- ============================================================
-- registration_counters: persistent mirror of the Redis atomic
-- counter. Redis INCR is the runtime source of truth; this table
-- enables recovery and reconciliation (PRD 3.2).
-- ============================================================
create table public.registration_counters (
  batch_id uuid primary key references public.batches (id) on delete cascade,
  current_count integer not null default 0 check (current_count >= 0),
  updated_at timestamptz not null default now()
);

alter table public.registration_counters enable row level security;

create policy "registration_counters_select_authenticated" on public.registration_counters
  for select using (auth.role() = 'authenticated');
create policy "registration_counters_admin_all" on public.registration_counters
  for all using (public.is_admin());
