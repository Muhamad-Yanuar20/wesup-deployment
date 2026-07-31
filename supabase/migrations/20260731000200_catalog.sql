-- Wesup migration 0002: catalog & campaign
-- Covers PRD module 2 (Catalog & Campaign): batches, tiers, timelines, recurring posts.

-- ============================================================
-- recurring_configs: auto-repost schedule for supplier batches
-- ============================================================
create table public.recurring_configs (
  id uuid primary key default gen_random_uuid(),
  supplier_id uuid not null references public.profiles (id) on delete cascade,
  name text,
  interval_days integer not null check (interval_days > 0),
  days_of_week smallint[] not null default '{}',
  is_active boolean not null default true,
  last_generated_at timestamptz,
  next_generation_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.recurring_configs enable row level security;

create policy "recurring_configs_own_all" on public.recurring_configs
  for all using (supplier_id = auth.uid());
create policy "recurring_configs_admin_select" on public.recurring_configs
  for select using (public.is_admin());

-- ============================================================
-- batches: core offer entity published to the marketplace
-- ============================================================
create table public.batches (
  id uuid primary key default gen_random_uuid(),
  supplier_id uuid not null references public.profiles (id),
  recurring_config_id uuid references public.recurring_configs (id) on delete set null,
  title text not null,
  description text,
  category text not null,
  min_quantity integer not null check (min_quantity > 0),
  product_photo_url text,
  pickup_address text not null,
  latitude numeric(10, 7) not null,
  longitude numeric(10, 7) not null,
  status public.batch_status not null default 'draft',
  takedown_reason text,
  takedown_by uuid references public.profiles (id),
  takedown_at timestamptz,
  cancelled_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.batches enable row level security;

create policy "batches_supplier_all" on public.batches
  for all using (supplier_id = auth.uid());
create policy "batches_umkm_select" on public.batches
  for select using (status = 'published' or status = 'closed');
create policy "batches_admin_all" on public.batches
  for all using (public.is_admin());

create index batches_supplier_status_idx on public.batches (supplier_id, status);
create index batches_category_status_idx on public.batches (category, status);
create index batches_location_idx on public.batches (latitude, longitude);

-- ============================================================
-- batch_tiers: volume-based discount tiers (Tier 1 = base price)
-- Cross-tier rules (decreasing price, non-overlapping ranges) are
-- enforced by the API Gatekeeper at creation time (PRD 3.6).
-- ============================================================
create table public.batch_tiers (
  id uuid primary key default gen_random_uuid(),
  batch_id uuid not null references public.batches (id) on delete cascade,
  tier_number integer not null,
  min_volume integer not null check (min_volume > 0),
  max_volume integer check (max_volume >= min_volume),
  price_per_unit numeric(12, 2) not null check (price_per_unit > 0),
  created_at timestamptz not null default now(),
  unique (batch_id, tier_number)
);

alter table public.batch_tiers enable row level security;

create policy "batch_tiers_supplier_all" on public.batch_tiers
  for all using (
    exists (select 1 from public.batches b where b.id = batch_id and b.supplier_id = auth.uid())
  );
create policy "batch_tiers_umkm_select" on public.batch_tiers
  for select using (
    exists (select 1 from public.batches b where b.id = batch_id and (b.status = 'published' or b.status = 'closed'))
  );
create policy "batch_tiers_admin_all" on public.batch_tiers
  for all using (public.is_admin());

create index batch_tiers_batch_idx on public.batch_tiers (batch_id);

-- ============================================================
-- batch_timeline: absolute timestamps (opens < closes < pay_opens < pay_closes < ready)
-- ============================================================
create table public.batch_timeline (
  batch_id uuid primary key references public.batches (id) on delete cascade,
  registration_opens_at timestamptz not null,
  registration_closes_at timestamptz not null,
  payment_opens_at timestamptz not null,
  payment_closes_at timestamptz not null,
  estimated_ready_at timestamptz not null,
  created_at timestamptz not null default now(),
  constraint batch_timeline_linear_order check (
    registration_opens_at < registration_closes_at
    and registration_closes_at < payment_opens_at
    and payment_opens_at < payment_closes_at
    and payment_closes_at < estimated_ready_at
  )
);

alter table public.batch_timeline enable row level security;

create policy "batch_timeline_supplier_all" on public.batch_timeline
  for all using (
    exists (select 1 from public.batches b where b.id = batch_id and b.supplier_id = auth.uid())
  );
create policy "batch_timeline_umkm_select" on public.batch_timeline
  for select using (
    exists (select 1 from public.batches b where b.id = batch_id and (b.status = 'published' or b.status = 'closed'))
  );
create policy "batch_timeline_admin_all" on public.batch_timeline
  for all using (public.is_admin());
