-- Wesup migration 0004: payment
-- Covers PRD module 5 (Payment): QRIS invoices via Midtrans, webhook
-- listener reconciliation, and payment window enforcement.

-- ============================================================
-- payments: one QRIS invoice per registration
-- ============================================================
create table public.payments (
  id uuid primary key default gen_random_uuid(),
  registration_id uuid not null unique references public.registrations (id),
  midtrans_order_id text not null unique,
  midtrans_transaction_id text,
  gross_amount numeric(12, 2) not null check (gross_amount > 0),
  status public.payment_status not null default 'pending',
  qr_code_url text,
  qr_code_expires_at timestamptz,
  paid_at timestamptz,
  webhook_payload jsonb,
  reconciled_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.payments enable row level security;

create policy "payments_umkm_select_own" on public.payments
  for select using (
    exists (select 1 from public.registrations r where r.id = registration_id and r.umkm_id = auth.uid())
  );
create policy "payments_supplier_select" on public.payments
  for select using (
    exists (
      select 1
      from public.registrations r
      join public.batches b on b.id = r.batch_id
      where r.id = registration_id and b.supplier_id = auth.uid()
    )
  );
create policy "payments_admin_select" on public.payments
  for select using (public.is_admin());

create index payments_status_idx on public.payments (status);
create index payments_registration_idx on public.payments (registration_id);

-- ============================================================
-- payment_webhook_logs: append-only record of Midtrans callbacks
-- ============================================================
create table public.payment_webhook_logs (
  id uuid primary key default gen_random_uuid(),
  payment_id uuid not null references public.payments (id) on delete cascade,
  event_type text not null,
  payload jsonb not null,
  status text not null default 'received',
  error_message text,
  created_at timestamptz not null default now()
);

alter table public.payment_webhook_logs enable row level security;

create policy "payment_webhook_logs_admin_select" on public.payment_webhook_logs
  for select using (public.is_admin());
