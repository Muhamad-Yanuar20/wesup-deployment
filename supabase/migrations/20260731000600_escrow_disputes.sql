-- Wesup migration 0006: escrow & resolution
-- Covers PRD module 7 (Escrow & Resolution): 24h fund hold, dispute
-- arbitration by Admin, and no-show forfeiture.

-- ============================================================
-- disputes: quality complaints with photo evidence
-- ============================================================
create table public.disputes (
  id uuid primary key default gen_random_uuid(),
  registration_id uuid not null unique references public.registrations (id),
  umkm_id uuid not null references public.profiles (id),
  supplier_id uuid not null references public.profiles (id),
  description text not null,
  photo_urls jsonb not null default '[]'::jsonb,
  status public.dispute_status not null default 'pending',
  admin_id uuid references public.profiles (id),
  admin_notes text,
  decided_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.disputes enable row level security;

create policy "disputes_umkm_insert" on public.disputes
  for insert with check (umkm_id = auth.uid());
create policy "disputes_umkm_select_own" on public.disputes
  for select using (umkm_id = auth.uid());
create policy "disputes_supplier_select" on public.disputes
  for select using (supplier_id = auth.uid());
create policy "disputes_admin_all" on public.disputes
  for all using (public.is_admin());

create index disputes_status_idx on public.disputes (status);
create index disputes_registration_idx on public.disputes (registration_id);

-- ============================================================
-- escrow_holds: 24h fund hold starting at pickup confirmation
-- ============================================================
create table public.escrow_holds (
  id uuid primary key default gen_random_uuid(),
  registration_id uuid not null unique references public.registrations (id) on delete cascade,
  amount numeric(12, 2) not null check (amount > 0),
  status public.escrow_status not null default 'held',
  pickup_confirmed_at timestamptz not null,
  auto_release_at timestamptz not null,
  released_at timestamptz,
  release_destination text check (release_destination in ('supplier', 'umkm')),
  dispute_id uuid references public.disputes (id),
  created_at timestamptz not null default now()
);

alter table public.escrow_holds enable row level security;

create policy "escrow_holds_admin_all" on public.escrow_holds
  for all using (public.is_admin());
create policy "escrow_holds_umkm_select_own" on public.escrow_holds
  for select using (
    exists (select 1 from public.registrations r where r.id = registration_id and r.umkm_id = auth.uid())
  );
create policy "escrow_holds_supplier_select" on public.escrow_holds
  for select using (
    exists (
      select 1
      from public.registrations r
      join public.batches b on b.id = r.batch_id
      where r.id = registration_id and b.supplier_id = auth.uid()
    )
  );

create index escrow_holds_status_idx on public.escrow_holds (status);

-- ============================================================
-- dispute_evidence: additional photo attachments per dispute
-- ============================================================
create table public.dispute_evidence (
  id uuid primary key default gen_random_uuid(),
  dispute_id uuid not null references public.disputes (id) on delete cascade,
  uploaded_by uuid not null references public.profiles (id),
  file_url text not null,
  description text,
  created_at timestamptz not null default now()
);

alter table public.dispute_evidence enable row level security;

create policy "dispute_evidence_uploader_all" on public.dispute_evidence
  for all using (uploaded_by = auth.uid());
create policy "dispute_evidence_admin_all" on public.dispute_evidence
  for all using (public.is_admin());
