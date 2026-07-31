-- Wesup migration 0008: notifications & admin audit
-- Covers PRD modules: Notification (2.4.5) and Admin Audit Log (2.3.6).

-- ============================================================
-- notifications: in-app notification center (WhatsApp fallback)
-- ============================================================
create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  type public.notification_type not null,
  title text not null,
  message text not null,
  data jsonb,
  read_at timestamptz,
  sent_via_whatsapp boolean not null default false,
  whatsapp_status text,
  created_at timestamptz not null default now()
);

alter table public.notifications enable row level security;

create policy "notifications_own_select" on public.notifications
  for select using (user_id = auth.uid());
create policy "notifications_own_update" on public.notifications
  for update using (user_id = auth.uid());
create policy "notifications_admin_select" on public.notifications
  for select using (public.is_admin());

create index notifications_user_read_idx on public.notifications (user_id, read_at);

-- ============================================================
-- admin_audit_logs: append-only trail of critical admin actions
-- Writes happen via the service role; UPDATE/DELETE are blocked
-- by trigger and by the absence of update/delete RLS policies.
-- ============================================================
create table public.admin_audit_logs (
  id uuid primary key default gen_random_uuid(),
  admin_id uuid not null references public.profiles (id),
  action_type public.audit_action not null,
  target_type text not null,
  target_id uuid not null,
  details jsonb,
  ip_address text,
  user_agent text,
  created_at timestamptz not null default now()
);

alter table public.admin_audit_logs enable row level security;
alter table public.admin_audit_logs force row level security;

create policy "admin_audit_logs_admin_select" on public.admin_audit_logs
  for select using (public.is_admin());
create policy "admin_audit_logs_admin_insert" on public.admin_audit_logs
  for insert with check (admin_id = auth.uid());

create index admin_audit_logs_admin_created_idx on public.admin_audit_logs (admin_id, created_at);

-- ============================================================
-- Append-only enforcement: reject any UPDATE/DELETE attempt
-- ============================================================
create or replace function public.prevent_admin_audit_logs_mutation() returns trigger
  language plpgsql as $$
begin
  raise exception 'admin_audit_logs is append-only: updates and deletes are forbidden';
end;
$$;

create trigger admin_audit_logs_immutable
  before update or delete on public.admin_audit_logs
  for each row execute function public.prevent_admin_audit_logs_mutation();
