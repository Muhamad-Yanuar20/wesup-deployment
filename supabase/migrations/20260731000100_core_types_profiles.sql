-- Wesup migration 0001: core types, profiles, IAM tables
-- Covers PRD module 1 (Identity & Access Management) and cross-cutting role types.

-- ============================================================
-- Enums
-- ============================================================
create type public.user_role as enum ('supplier', 'umkm', 'admin');
create type public.account_status as enum ('active', 'suspended_temporary', 'suspended_permanent', 'banned');
create type public.verification_status as enum ('pending', 'approved', 'rejected');
create type public.batch_status as enum ('draft', 'published', 'closed', 'cancelled', 'takedown', 'completed');
create type public.registration_status as enum ('registered', 'pending_payment', 'paid', 'picked_up', 'completed', 'no_show', 'cancelled', 'refund_pending', 'refunded');
create type public.payment_status as enum ('pending', 'paid', 'expired', 'failed', 'refunded');
create type public.escrow_status as enum ('held', 'released', 'refunded', 'forfeited');
create type public.dispute_status as enum ('pending', 'under_review', 'resolved_supplier', 'resolved_umkm');
create type public.refund_trigger as enum ('takedown', 'force_majeure', 'dispute_won');
create type public.refund_status as enum ('pending', 'waiting_bank_account', 'processing', 'completed', 'failed');
create type public.notification_type as enum ('payment_due', 'payment_success', 'pickup_ready', 'dispute', 'refund', 'suspension', 'referral', 'batch_update');
create type public.audit_action as enum ('verify_supplier', 'reject_supplier', 'takedown_batch', 'resolve_dispute', 'approve_refund', 'complete_refund', 'suspend_user', 'ban_user', 'unban_user');

-- ============================================================
-- profiles: one row per auth.users account
-- ============================================================
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  role public.user_role not null default 'umkm',
  status public.account_status not null default 'active',
  full_name text not null,
  phone text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

create policy "profiles_select_own" on public.profiles
  for select using (auth.uid() = id);
create policy "profiles_update_own" on public.profiles
  for update using (auth.uid() = id);
create policy "profiles_select_admin" on public.profiles
  for select using (public.is_admin());

-- ============================================================
-- Role helper functions (used by RLS policies)
-- ============================================================
create or replace function public.is_admin() returns boolean
  language sql stable security definer as $$
  select exists (select 1 from public.profiles where id = auth.uid() and role = 'admin');
$$;

create or replace function public.is_supplier() returns boolean
  language sql stable security definer as $$
  select exists (select 1 from public.profiles where id = auth.uid() and role = 'supplier');
$$;

-- ============================================================
-- Auto-create a profile row on new auth.users signup
-- ============================================================
create or replace function public.handle_new_user() returns trigger
  language plpgsql security definer as $$
begin
  insert into public.profiles (id, full_name, phone, role)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name', ''),
    new.phone,
    coalesce((new.raw_user_meta_data ->> 'role')::public.user_role, 'umkm')
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ============================================================
-- supplier_profiles: KYC data verified physically by Admin
-- ============================================================
create table public.supplier_profiles (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  business_name text not null,
  address text not null,
  latitude numeric(10, 7) not null,
  longitude numeric(10, 7) not null,
  business_photo_url text,
  ktp_photo_url text not null,
  nik text not null unique,
  verification_status public.verification_status not null default 'pending',
  verification_notes text,
  verified_by uuid references public.profiles (id),
  verified_at timestamptz,
  is_location_locked boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.supplier_profiles enable row level security;

create policy "supplier_profiles_select_own" on public.supplier_profiles
  for select using (user_id = auth.uid());
create policy "supplier_profiles_insert_own" on public.supplier_profiles
  for insert with check (user_id = auth.uid());
create policy "supplier_profiles_update_own" on public.supplier_profiles
  for update using (user_id = auth.uid());
create policy "supplier_profiles_admin_all" on public.supplier_profiles
  for all using (public.is_admin());

-- ============================================================
-- supplier_bank_accounts: disbursement setup for escrow payout
-- ============================================================
create table public.supplier_bank_accounts (
  id uuid primary key default gen_random_uuid(),
  supplier_id uuid not null references public.profiles (id) on delete cascade,
  bank_name text not null,
  account_number text not null,
  account_holder_name text not null,
  is_primary boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (supplier_id, account_number)
);

alter table public.supplier_bank_accounts enable row level security;

create policy "supplier_bank_accounts_own_all" on public.supplier_bank_accounts
  for all using (supplier_id = auth.uid());
create policy "supplier_bank_accounts_admin_select" on public.supplier_bank_accounts
  for select using (public.is_admin());

-- ============================================================
-- umkm_bank_accounts: manual refund destination for UMKM
-- ============================================================
create table public.umkm_bank_accounts (
  id uuid primary key default gen_random_uuid(),
  umkm_id uuid not null references public.profiles (id) on delete cascade,
  bank_name text not null,
  account_number text not null,
  account_holder_name text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (umkm_id, account_number)
);

alter table public.umkm_bank_accounts enable row level security;

create policy "umkm_bank_accounts_own_all" on public.umkm_bank_accounts
  for all using (umkm_id = auth.uid());
create policy "umkm_bank_accounts_admin_select" on public.umkm_bank_accounts
  for select using (public.is_admin());

-- ============================================================
-- umkm_profiles: consumer profile, penalties, suspension window
-- ============================================================
create table public.umkm_profiles (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  business_name text not null,
  address text not null,
  latitude numeric(10, 7) not null,
  longitude numeric(10, 7) not null,
  strike_count integer not null default 0 check (strike_count >= 0),
  suspended_until timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.umkm_profiles enable row level security;

create policy "umkm_profiles_select_own" on public.umkm_profiles
  for select using (user_id = auth.uid());
create policy "umkm_profiles_update_own" on public.umkm_profiles
  for update using (user_id = auth.uid());
create policy "umkm_profiles_admin_all" on public.umkm_profiles
  for all using (public.is_admin());
