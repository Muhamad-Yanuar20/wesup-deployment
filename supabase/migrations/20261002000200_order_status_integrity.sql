-- Guard every registration UPDATE, including direct owner SQL. No business data is modified.
create table public.order_status_recoveries (
  incident_id text not null,
  registration_id uuid not null references public.registrations(id),
  event_id uuid not null references public.registration_status_events(id),
  target_status public.registration_status not null,
  expected_updated_at timestamptz,
  request_id uuid not null,
  state text not null default 'prepared' check(state in ('prepared','restored')),
  evidence jsonb not null default '{}'::jsonb,
  restored_at timestamptz,
  primary key(incident_id,registration_id)
);
alter table public.order_status_recoveries enable row level security;
revoke all on public.order_status_recoveries from public,anon,authenticated,service_role;

create or replace function public.guard_registration_status_integrity()
returns trigger language plpgsql security definer set search_path=public as $$
declare
  v_incident text := nullif(current_setting('app.recovery_incident',true),'');
  v_recovery public.order_status_recoveries%rowtype;
  v_allowed boolean := false;
begin
  if old.status is not distinct from new.status then return new; end if;
  if v_incident is not null and old.status='cancelled' then
    select * into v_recovery from public.order_status_recoveries
      where incident_id=v_incident and registration_id=old.id and state='prepared'
      and target_status=new.status for update;
    if found and old.updated_at is not distinct from v_recovery.expected_updated_at
      and exists(select 1 from public.registration_status_events e where e.id=v_recovery.event_id
        and e.registration_id=old.id and e.from_status=new.status and e.to_status='cancelled'
        and e.source='status_update' and e.actor_id is null
        and e.created_at>='2026-10-02 07:45:42+00' and e.created_at<'2026-10-02 07:45:43+00') then
      update public.order_status_recoveries set state='restored',restored_at=clock_timestamp()
       where incident_id=v_incident and registration_id=old.id;
      return new;
    end if;
    raise exception 'incident recovery authorization does not match current order' using errcode='55000';
  end if;
  v_allowed := case old.status
    when 'registered' then new.status in ('pending_payment','paid','cancelled','refund_pending')
    when 'pending_payment' then new.status in ('paid','cancelled','refund_pending')
    when 'paid' then new.status in ('picked_up','no_show','refund_pending')
    when 'picked_up' then new.status in ('completed','refund_pending')
    when 'refund_pending' then new.status='refunded'
    when 'cancelled' then new.status='refund_pending' or
      (new.status='registered' and old.cancellation_reason='buyer_withdrawal'
       and exists(select 1 from public.batches b join public.batch_timeline t on t.batch_id=b.id
        where b.id=old.batch_id and b.status='published' and clock_timestamp()<t.registration_closes_at))
    else false end;
  if not coalesce(v_allowed,false) then
    raise exception 'invalid registration status transition: % -> %',old.status,new.status using errcode='55000';
  end if;
  return new;
end;
$$;
revoke all on function public.guard_registration_status_integrity() from public,anon,authenticated,service_role;
create trigger registration_status_integrity_guard before update of status on public.registrations
for each row execute function public.guard_registration_status_integrity();

-- RPCs run as their definer and keep their ownership checks. The legacy registration
-- Route Handler still needs INSERT and SELECT; direct status mutation is unnecessary.
revoke update,delete,truncate,trigger,references on public.registrations from anon,authenticated,service_role;
revoke insert on public.registrations from anon;

-- Provision a login separately and grant membership; do not use database-owner
-- credentials for routine inspection. This role cannot mutate business records.
do $$begin
  if not exists(select 1 from pg_roles where rolname='wesup_operations_readonly') then
    create role wesup_operations_readonly nologin;
  end if;
end$$;
grant usage on schema public to wesup_operations_readonly;
grant select on public.registration_status_events,public.order_status_recoveries to wesup_operations_readonly;
grant select(id,batch_id,status,quantity,final_amount,locked_price_per_unit,cancellation_reason,updated_at) on public.registrations to wesup_operations_readonly;
grant select(id,status) on public.batches to wesup_operations_readonly;
grant select on public.batch_timeline to wesup_operations_readonly;
grant select(id,registration_id,status,gross_amount,paid_at) on public.payments to wesup_operations_readonly;
grant select(id,registration_id,status,amount,pickup_confirmed_at,auto_release_at,release_destination) on public.escrow_holds to wesup_operations_readonly;
create policy operations_readonly on public.registrations for select to wesup_operations_readonly using(true);
create policy operations_readonly on public.batches for select to wesup_operations_readonly using(true);
create policy operations_readonly on public.batch_timeline for select to wesup_operations_readonly using(true);
create policy operations_readonly on public.payments for select to wesup_operations_readonly using(true);
create policy operations_readonly on public.escrow_holds for select to wesup_operations_readonly using(true);
create policy operations_readonly on public.registration_status_events for select to wesup_operations_readonly using(true);
create policy operations_readonly on public.order_status_recoveries for select to wesup_operations_readonly using(true);

create or replace function public.record_registration_status_event()
returns trigger language plpgsql security definer set search_path=public as $$
declare
  v_operation text := nullif(current_setting('app.operation',true),'');
  v_context text;
  v_rpc text;
begin
  get diagnostics v_context = pg_context;
  select m[1] into v_rpc from regexp_matches(v_context,'PL/pgSQL function ([a-zA-Z_][a-zA-Z_0-9]*)\(', 'g') m
    where m[1]<>'record_registration_status_event' limit 1;
  v_operation := coalesce(v_operation,v_rpc);
  if tg_op='INSERT' or old.status is distinct from new.status then
    insert into public.registration_status_events(registration_id,from_status,to_status,source,actor_id,metadata)
    values(new.id,case when tg_op='INSERT' then null else old.status end,new.status,
      coalesce(v_operation,case when tg_op='INSERT' then 'registration_created'
       when new.status='cancelled' then 'cancellation:'||coalesce(new.cancellation_reason,'unknown') else 'status_update' end),auth.uid(),
      jsonb_strip_nulls(jsonb_build_object('reason',new.cancellation_reason,'operation',v_operation,
       'request_id',coalesce(nullif(current_setting('app.request_id',true),''),'dbtx:'||txid_current()::text),
       'rpc',v_rpc,
       'database_session_role',session_user,'database_request_role',nullif(current_setting('role',true),'none'),
       'incident_id',nullif(current_setting('app.recovery_incident',true),''))));
  end if;
  return new;
end;
$$;
revoke all on function public.record_registration_status_event() from public,anon,authenticated,service_role;
