-- Wesup migration 0007: refunds & reputation
-- Covers PRD modules: Refund Management (2.3.3, 3.5) and
-- Reputation & Penalty (2.2.6, 2.1.6).

-- ============================================================
-- refund_requests: manual full-refund queue processed by Admin
-- Triggered only by takedown, force majeure, or dispute won by UMKM.
-- ============================================================
create table public.refund_requests (
  id uuid primary key default gen_random_uuid(),
  registration_id uuid not null references public.registrations (id),
  batch_id uuid not null references public.batches (id),
  trigger_type public.refund_trigger not null,
  amount numeric(12, 2) not null check (amount > 0),
  status public.refund_status not null default 'pending',
  umkm_bank_account_id uuid references public.umkm_bank_accounts (id),
  admin_id uuid references public.profiles (id),
  admin_notes text,
  transfer_proof_url text,
  requested_at timestamptz not null default now(),
  processed_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now()
);

alter table public.refund_requests enable row level security;

create policy "refund_requests_umkm_select_own" on public.refund_requests
  for select using (
    exists (select 1 from public.registrations r where r.id = registration_id and r.umkm_id = auth.uid())
  );
create policy "refund_requests_admin_all" on public.refund_requests
  for all using (public.is_admin());
create policy "refund_requests_supplier_select" on public.refund_requests
  for select using (
    exists (
      select 1
      from public.registrations r
      join public.batches b on b.id = r.batch_id
      where r.id = registration_id and b.supplier_id = auth.uid()
    )
  );

create index refund_requests_status_idx on public.refund_requests (status);
create index refund_requests_registration_idx on public.refund_requests (registration_id);

-- ============================================================
-- ratings: post-transaction star rating from UMKM to Supplier
-- ============================================================
create table public.ratings (
  id uuid primary key default gen_random_uuid(),
  registration_id uuid not null unique references public.registrations (id),
  umkm_id uuid not null references public.profiles (id),
  supplier_id uuid not null references public.profiles (id),
  score smallint not null check (score between 1 and 5),
  comment text,
  created_at timestamptz not null default now()
);

alter table public.ratings enable row level security;

create policy "ratings_umkm_insert" on public.ratings
  for insert with check (umkm_id = auth.uid());
create policy "ratings_umkm_select_own" on public.ratings
  for select using (umkm_id = auth.uid());
create policy "ratings_public_select" on public.ratings
  for select using (auth.role() = 'authenticated');
create policy "ratings_admin_select" on public.ratings
  for select using (public.is_admin());

create index ratings_supplier_idx on public.ratings (supplier_id);
