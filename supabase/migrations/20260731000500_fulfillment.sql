-- Wesup migration 0005: fulfillment & pickup
-- Covers PRD module 6 (Fulfillment & Pickup): QR code + 4-digit PIN
-- handover validation at the supplier pickup point.

-- ============================================================
-- pickup_codes: QR token + PIN fallback, issued only after payment
-- ============================================================
create table public.pickup_codes (
  id uuid primary key default gen_random_uuid(),
  registration_id uuid not null unique references public.registrations (id) on delete cascade,
  qr_code_token text not null unique,
  pin_code text not null check (pin_code ~ '^[0-9]{4}$'),
  generated_at timestamptz not null default now(),
  used_at timestamptz,
  used_by_supplier_id uuid references public.profiles (id)
);

alter table public.pickup_codes enable row level security;

create policy "pickup_codes_umkm_select_own" on public.pickup_codes
  for select using (
    exists (select 1 from public.registrations r where r.id = registration_id and r.umkm_id = auth.uid())
  );
create policy "pickup_codes_supplier_select" on public.pickup_codes
  for select using (
    exists (
      select 1
      from public.registrations r
      join public.batches b on b.id = r.batch_id
      where r.id = registration_id and b.supplier_id = auth.uid()
    )
  );
create policy "pickup_codes_admin_select" on public.pickup_codes
  for select using (public.is_admin());

-- ============================================================
-- pickup_events: physical handover log (QR scan or PIN entry)
-- The first event for a registration starts the 24h escrow timer.
-- ============================================================
create table public.pickup_events (
  id uuid primary key default gen_random_uuid(),
  registration_id uuid not null references public.registrations (id) on delete cascade,
  supplier_id uuid not null references public.profiles (id),
  method text not null check (method in ('qr', 'pin')),
  latitude numeric(10, 7),
  longitude numeric(10, 7),
  notes text,
  created_at timestamptz not null default now()
);

alter table public.pickup_events enable row level security;

create policy "pickup_events_supplier_insert" on public.pickup_events
  for insert with check (supplier_id = auth.uid());
create policy "pickup_events_supplier_select" on public.pickup_events
  for select using (
    exists (
      select 1
      from public.registrations r
      join public.batches b on b.id = r.batch_id
      where r.id = registration_id and b.supplier_id = auth.uid()
    )
  );
create policy "pickup_events_umkm_select_own" on public.pickup_events
  for select using (
    exists (select 1 from public.registrations r where r.id = registration_id and r.umkm_id = auth.uid())
  );
create policy "pickup_events_admin_select" on public.pickup_events
  for select using (public.is_admin());
