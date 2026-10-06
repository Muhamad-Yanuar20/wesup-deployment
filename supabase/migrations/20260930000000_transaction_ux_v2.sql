-- New offers opt in. Never reinterpret deadlines of existing transactions.
alter table public.batches add column transaction_policy_version smallint not null default 1 check (transaction_policy_version in (1,2));
alter table public.batch_timeline add column pickup_ends_at timestamptz;
alter table public.registrations add column cancellation_reason text;
alter table public.registrations add column consent_terms jsonb;
alter table public.registrations add column payment_penalty_exempt boolean not null default false;

alter table public.batch_timeline drop constraint batch_timeline_linear_order;
alter table public.batch_timeline add constraint batch_timeline_linear_order check (
  registration_opens_at < registration_closes_at and registration_closes_at <= payment_opens_at
  and payment_opens_at < payment_closes_at and payment_closes_at < estimated_ready_at
  and (pickup_ends_at is null or pickup_ends_at > estimated_ready_at)
);

create table public.supplier_offer_drafts (
  id uuid primary key default gen_random_uuid(), supplier_id uuid not null references public.profiles(id),
  payload jsonb not null default '{}', step smallint not null default 1 check (step between 1 and 4),
  revision integer not null default 1, published_batch_id uuid references public.batches(id),
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
alter table public.supplier_offer_drafts enable row level security;
create policy supplier_offer_drafts_read on public.supplier_offer_drafts for select to authenticated using (supplier_id = auth.uid());
-- Writes go through RPCs, including compare-and-swap to prevent stale-tab loss.
create function public.save_supplier_offer_draft(p_id uuid, p_payload jsonb, p_step smallint, p_revision integer default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare d public.supplier_offer_drafts%rowtype;
begin
  if not exists(select 1 from public.profiles where id=auth.uid() and role='supplier' and status='active') then raise exception 'supplier required' using errcode='42501'; end if;
  if jsonb_typeof(p_payload) <> 'object' or octet_length(p_payload::text) > 100000 or p_step not between 1 and 4 then raise exception 'invalid draft' using errcode='22023'; end if;
  select * into d from public.supplier_offer_drafts where id=p_id for update;
  if found then
    if d.supplier_id <> auth.uid() then raise exception 'draft not found' using errcode='42501'; end if;
    if d.published_batch_id is not null then return to_jsonb(d); end if;
    if p_revision is distinct from d.revision then raise exception 'draft changed in another tab' using errcode='40001'; end if;
    update public.supplier_offer_drafts set payload=p_payload,step=p_step,revision=revision+1,updated_at=now() where id=d.id returning * into d;
  else
    insert into public.supplier_offer_drafts(id,supplier_id,payload,step) values(coalesce(p_id,gen_random_uuid()),auth.uid(),p_payload,p_step) returning * into d;
  end if;
  return to_jsonb(d);
end; $$;

create table public.pickup_replacements (
  id uuid primary key default gen_random_uuid(), batch_id uuid not null references public.batches(id),
  revision integer not null, starts_at timestamptz not null, ends_at timestamptz not null,
  ready_at timestamptz, reason text not null, created_at timestamptz not null default now(), unique(batch_id,revision)
);
alter table public.pickup_replacements enable row level security;
create policy pickup_replacements_read on public.pickup_replacements for select to authenticated using (
  exists(select 1 from public.batches b where b.id=batch_id and b.supplier_id=auth.uid())
  or exists(select 1 from public.registrations r where r.batch_id=pickup_replacements.batch_id and r.umkm_id=auth.uid()) or public.is_admin()
);
alter table public.registrations add column accepted_pickup_revision uuid references public.pickup_replacements(id);
create table public.pickup_replacement_decisions (
  registration_id uuid not null references public.registrations(id), replacement_id uuid not null references public.pickup_replacements(id),
  decision text not null check (decision in ('wait','refund')), decided_at timestamptz not null default now(), primary key(registration_id,replacement_id)
);
alter table public.pickup_replacement_decisions enable row level security;
create policy pickup_decisions_read on public.pickup_replacement_decisions for select to authenticated using (
  exists(select 1 from public.registrations r join public.batches b on b.id=r.batch_id where r.id=registration_id and (r.umkm_id=auth.uid() or b.supplier_id=auth.uid())) or public.is_admin()
);

create function public.assert_pickup_window(p_start timestamptz,p_end timestamptz) returns void
language plpgsql immutable set search_path=public as $$
begin
  if p_start is null or p_end is null or p_end-p_start not between interval '4 hours' and interval '12 hours'
    or (p_start at time zone 'Asia/Jakarta')::date <> (p_end at time zone 'Asia/Jakarta')::date
    or (p_start at time zone 'Asia/Jakarta')::time < time '06:00'
    or (p_end at time zone 'Asia/Jakarta')::time > time '22:00' then
    raise exception 'pickup must be 4-12 hours between 06:00 and 22:00 WIB' using errcode='22023';
  end if;
end; $$;

create function public.publish_supplier_offer(p_draft_id uuid,p_revision integer,p_photo_url text)
returns uuid language plpgsql security definer set search_path=public as $$
declare d public.supplier_offer_drafts%rowtype; p jsonb; s jsonb; tier jsonb; tiers jsonb := '[]';
  batch uuid; opens timestamptz; cutoff timestamptz; ready timestamptz; ends timestamptz; days integer; capacity integer; idx integer:=0;
begin
  if not public.is_approved_supplier() then raise exception 'approved supplier required' using errcode='42501'; end if;
  select * into d from public.supplier_offer_drafts where id=p_draft_id and supplier_id=auth.uid() for update;
  if not found then raise exception 'draft not found' using errcode='P0002'; end if;
  if d.published_batch_id is not null then return d.published_batch_id; end if;
  if d.revision <> p_revision then raise exception 'draft changed in another tab' using errcode='40001'; end if;
  if not exists(select 1 from storage.objects o where o.bucket_id='wesup-public' and p_photo_url = regexp_replace(p_photo_url,'/storage/v1/object/public/wesup-public/.*$','/storage/v1/object/public/wesup-public/') || o.name and (o.name ~ ('^products/'||d.id::text||'/[^/]+\.webp$') or exists(select 1 from public.batches bx where bx.supplier_id=auth.uid() and bx.product_photo_url=p_photo_url))) then raise exception 'owned product photo required' using errcode='22023'; end if;
  p:=d.payload; s:=p->'schedule'; days:=(s->>'collectionDays')::integer;
  if days is null or days not in (1,2,3,7) then raise exception 'invalid collection duration' using errcode='22023'; end if;
  if s->>'openingMode'='immediate' then opens:=clock_timestamp();
  elsif s->>'openingMode'='scheduled' then opens:=(s->>'scheduledOpensAt')::timestamptz; if opens<=now() then raise exception 'scheduled opening must be future' using errcode='22023'; end if;
  else raise exception 'invalid opening mode' using errcode='22023'; end if;
  cutoff:=opens+make_interval(days=>days); ready:=(s->>'pickupStartsAt')::timestamptz; ends:=(s->>'pickupEndsAt')::timestamptz;
  perform public.assert_pickup_window(ready,ends);
  capacity:=(p->>'capacityQuantity')::integer;
  if ready<=cutoff+interval '24 hours' or capacity is null or capacity<1
    or nullif(trim(p->>'title'),'') is null or nullif(trim(p->>'description'),'') is null
    or nullif(trim(p->>'pickupName'),'') is null or nullif(trim(p->>'pickupAddress'),'') is null
    or p_photo_url is null or p_photo_url !~ '^https?://' then raise exception 'offer incomplete or invalid schedule' using errcode='22023'; end if;
  if p->>'unit' is null or p->>'unit' not in ('kg','gram','liter','ml','pcs','pack','karung','ikat','sisir') then raise exception 'invalid unit' using errcode='22023'; end if;
  if p->>'category' is null or p->>'category' not in ('Sayur & Buah','Daging & Ikan','Makanan Siap Saji','Kerajinan','Jasa') then raise exception 'invalid category' using errcode='22023'; end if;
  if (p->>'pickupLatitude') is null or (p->>'pickupLongitude') is null or 6371 * acos(least(1.0, greatest(-1.0, sin(radians(-6.914744)) * sin(radians((p->>'pickupLatitude')::numeric)) + cos(radians(-6.914744)) * cos(radians((p->>'pickupLatitude')::numeric)) * cos(radians((p->>'pickupLongitude')::numeric) - radians(107.60981))))) > 50 then raise exception 'pickup outside Bandung' using errcode='22023'; end if;
  for tier in select value from jsonb_array_elements(p->'tiers') loop
    idx:=idx+1;
    tiers:=tiers||jsonb_build_array(jsonb_build_object('tier_number',idx,'min_volume',(tier->>'minimumQuantity')::integer,
      'max_volume',case when idx<jsonb_array_length(p->'tiers') then ((p->'tiers'->idx)->>'minimumQuantity')::integer-1 else null end,
      'price_per_unit',(tier->>'pricePerUnit')::numeric));
    if (tier->>'minimumQuantity')::integer>capacity then raise exception 'discount threshold exceeds capacity' using errcode='22023'; end if;
  end loop;
  perform public.validate_catalog_tiers(tiers);
  if (tiers->0->>'min_volume')::integer<>1 then raise exception 'base price starts at one unit' using errcode='22023'; end if;
  insert into public.batches(supplier_id,title,description,category,min_quantity,capacity_quantity,unit,payment_window_hours,
    product_photo_url,pickup_name,pickup_address,latitude,longitude,status,transaction_policy_version)
  values(auth.uid(),trim(p->>'title'),trim(p->>'description'),p->>'category',
    ((tiers->(jsonb_array_length(tiers)-1))->>'min_volume')::integer,capacity,p->>'unit',24,
    p_photo_url,trim(p->>'pickupName'),trim(p->>'pickupAddress'),(p->>'pickupLatitude')::numeric,(p->>'pickupLongitude')::numeric,'published',2) returning id into batch;
  insert into public.batch_timeline(batch_id,registration_opens_at,registration_closes_at,payment_opens_at,payment_closes_at,estimated_ready_at,pickup_ends_at)
    values(batch,opens,cutoff,cutoff,cutoff+interval '24 hours',ready,ends);
  insert into public.batch_tiers(batch_id,tier_number,min_volume,max_volume,price_per_unit)
    select batch,t.tier_number,t.min_volume,t.max_volume,t.price_per_unit from jsonb_to_recordset(tiers) t(tier_number integer,min_volume integer,max_volume integer,price_per_unit numeric);
  update public.supplier_offer_drafts set published_batch_id=batch,updated_at=now() where id=d.id;
  return batch;
end; $$;

create function public.join_batch_v2(p_batch_id uuid,p_quantity integer,p_terms jsonb,p_consent_lat numeric default null,p_consent_lng numeric default null)
returns jsonb language plpgsql security definer set search_path=public as $$
declare b public.batches%rowtype; t public.batch_timeline%rowtype; r public.registrations%rowtype; total integer;
begin
  if not exists(select 1 from public.profiles where id=auth.uid() and role='umkm' and status='active') then raise exception 'active UMKM required' using errcode='42501'; end if;
  if not exists(select 1 from public.umkm_profiles where user_id=auth.uid() and nullif(trim(business_name),'') is not null and nullif(trim(address),'') is not null and latitude is not null and longitude is not null) then raise exception 'complete profile required' using errcode='22023'; end if;
  select * into b from public.batches where id=p_batch_id for update;
  select * into t from public.batch_timeline where batch_id=b.id;
  if b.transaction_policy_version<>2 or b.status<>'published' or clock_timestamp()<t.registration_opens_at or clock_timestamp()>=t.registration_closes_at then raise exception 'registration closed' using errcode='55000'; end if;
  if p_quantity is null or p_quantity<=0 or p_terms->>'accepted' is distinct from 'true' then raise exception 'quantity and explicit consent required' using errcode='22023'; end if;
  select * into r from public.registrations where batch_id=b.id and umkm_id=auth.uid() for update;
  if found and not (r.status='cancelled' and r.cancellation_reason='buyer_withdrawal') then
    return jsonb_build_object('registrationId',r.id,'quantity',r.quantity,'idempotent',true);
  end if;
  -- Compare the reviewed summary inside the same row lock as the reservation.
  if (p_terms->>'maximumUnitPrice')::numeric is distinct from (select price_per_unit from public.batch_tiers where batch_id=b.id and tier_number=1)
    or p_terms->>'unit' is distinct from b.unit or p_terms->>'pickupAddress' is distinct from b.pickup_address
    or (p_terms->>'paymentOpensAt')::timestamptz is distinct from t.payment_opens_at
    or (p_terms->>'paymentClosesAt')::timestamptz is distinct from t.payment_closes_at
    or (p_terms->>'pickupStartsAt')::timestamptz is distinct from t.estimated_ready_at
    or (p_terms->>'pickupEndsAt')::timestamptz is distinct from t.pickup_ends_at then
    raise exception 'offer changed; review the latest summary and consent again' using errcode='23514';
  end if;
  select coalesce(sum(quantity),0) into total from public.registrations where batch_id=b.id and status='registered';
  if total+p_quantity>b.capacity_quantity then raise exception 'capacity exceeded' using errcode='P0001',detail=(b.capacity_quantity-total)::text; end if;
  perform set_config('wesup.transaction_v2_write','true',true);
  if r.id is null then
    insert into public.registrations(batch_id,umkm_id,quantity,status,consented_at,consent_latitude,consent_longitude,consent_terms)
    values(b.id,auth.uid(),p_quantity,'registered',clock_timestamp(),p_consent_lat,p_consent_lng,
      jsonb_build_object('accepted',true,'policyVersion',2,'paymentOpensAt',t.payment_opens_at,'paymentClosesAt',t.payment_closes_at,'pickupStartsAt',t.estimated_ready_at,'pickupEndsAt',t.pickup_ends_at,'pickupAddress',b.pickup_address,'maximumUnitPrice',(select price_per_unit from public.batch_tiers where batch_id=b.id and tier_number=1))) returning * into r;
  else
    update public.registrations set quantity=p_quantity,status='registered',cancellation_reason=null,consented_at=clock_timestamp(),consent_latitude=p_consent_lat,consent_longitude=p_consent_lng,
      consent_terms=jsonb_build_object('accepted',true,'policyVersion',2,'paymentOpensAt',t.payment_opens_at,'paymentClosesAt',t.payment_closes_at,'pickupStartsAt',t.estimated_ready_at,'pickupEndsAt',t.pickup_ends_at,'pickupAddress',b.pickup_address,'maximumUnitPrice',(select price_per_unit from public.batch_tiers where batch_id=b.id and tier_number=1)),updated_at=clock_timestamp() where id=r.id returning * into r;
  end if;
  return jsonb_build_object('registrationId',r.id,'quantity',r.quantity,'count',total+p_quantity,'idempotent',false);
end; $$;

create function public.withdraw_batch_registration(p_registration_id uuid) returns jsonb
language plpgsql security definer set search_path=public as $$
declare b public.batches%rowtype; r public.registrations%rowtype; cutoff timestamptz;
begin
  select bx.* into b from public.batches bx join public.registrations rx on rx.batch_id=bx.id where rx.id=p_registration_id for update of bx;
  select * into r from public.registrations where id=p_registration_id and umkm_id=auth.uid() for update;
  if not found or not exists(select 1 from public.profiles where id=auth.uid() and role='umkm' and status='active') then raise exception 'order not found' using errcode='42501'; end if;
  if r.status='cancelled' and r.cancellation_reason='buyer_withdrawal' then return jsonb_build_object('withdrawn',true,'idempotent',true,'quantity',0,'batchId',b.id); end if;
  select registration_closes_at into cutoff from public.batch_timeline where batch_id=b.id;
  if b.transaction_policy_version<>2 or b.status<>'published' or clock_timestamp()>=cutoff or r.status<>'registered' then raise exception 'withdrawal cutoff passed' using errcode='55000'; end if;
  perform set_config('wesup.transaction_v2_write','true',true);
  update public.registrations set status='cancelled',cancellation_reason='buyer_withdrawal',updated_at=clock_timestamp() where id=r.id;
  return jsonb_build_object('withdrawn',true,'idempotent',false,'quantity',r.quantity,'batchId',b.id);
end; $$;

-- Refund entitlement is recorded separately from completion of the bank transfer.
create function public.queue_delayed_supplier_refund(p_registration_id uuid) returns void
language plpgsql security definer set search_path=public as $$
declare r public.registrations%rowtype;
begin
  select * into r from public.registrations where id=p_registration_id for update;
  if r.status<>'paid' then return; end if;
  update public.registrations set status='refund_pending',cancellation_reason='supplier_late',updated_at=clock_timestamp() where id=r.id;
  update public.escrow_holds set status='frozen',release_destination='umkm' where registration_id=r.id and status='held';
  insert into public.refund_requests(registration_id,batch_id,trigger_type,amount,status)
    values(r.id,r.batch_id,'force_majeure',r.final_amount,'pending') on conflict(registration_id) do nothing;
  insert into public.notifications(user_id,type,title,message,data) values(r.umkm_id,'refund','Pengembalian dana penuh diproses','Supplier terlambat. Pesanan tidak dikenai penalti.',jsonb_build_object('registration_id',r.id,'reason','supplier_late'));
end; $$;

create function public.propose_pickup_replacement(p_batch_id uuid,p_start timestamptz,p_end timestamptz,p_reason text) returns uuid
language plpgsql security definer set search_path=public as $$
declare b public.batches%rowtype; starts timestamptz; ready timestamptz; proposal_id uuid; rev integer;
begin
  select * into b from public.batches where public.batches.id=p_batch_id for update;
  if b.supplier_id is distinct from auth.uid() or not public.is_approved_supplier() then raise exception 'owning supplier required' using errcode='42501'; end if;
  if b.transaction_policy_version<>2 or b.status<>'closed' then raise exception 'batch not eligible' using errcode='55000'; end if;
  select estimated_ready_at into starts from public.batch_timeline where batch_id=b.id; ready:=b.ready_at;
  select pr.starts_at,pr.ready_at into starts,ready from public.pickup_replacements pr where batch_id=b.id order by revision desc limit 1;
  if not found then select estimated_ready_at,b.ready_at into starts,ready from public.batch_timeline where batch_id=b.id; end if;
  if clock_timestamp()<starts or (ready is not null and ready<=starts) then raise exception 'supplier is not delayed' using errcode='55000'; end if;
  perform public.assert_pickup_window(p_start,p_end);
  if p_start<=clock_timestamp() or nullif(trim(p_reason),'') is null then raise exception 'future schedule and reason required' using errcode='22023'; end if;
  select coalesce(max(revision),0)+1 into rev from public.pickup_replacements where batch_id=b.id;
  insert into public.pickup_replacements(batch_id,revision,starts_at,ends_at,reason) values(b.id,rev,p_start,p_end,trim(p_reason)) returning pickup_replacements.id into proposal_id;
  insert into public.notifications(user_id,type,title,message,data)
    select umkm_id,'batch_update','Pilih jadwal baru atau pengembalian dana','Jadwal baru hanya berlaku setelah Anda menyetujuinya.',jsonb_build_object('registration_id',r.id,'replacement_id',proposal_id)
    from public.registrations r where r.batch_id=b.id and r.status='paid';
  return proposal_id;
end; $$;

create function public.decide_pickup_replacement(p_registration_id uuid,p_replacement_id uuid,p_decision text) returns void
language plpgsql security definer set search_path=public as $$
declare r public.registrations%rowtype; b public.batches%rowtype; pr public.pickup_replacements%rowtype; starts timestamptz; ends timestamptz; ready timestamptz;
begin
  select bx.* into b from public.batches bx join public.registrations rx on rx.batch_id=bx.id where rx.id=p_registration_id for update of bx;
  select * into r from public.registrations where id=p_registration_id and umkm_id=auth.uid() for update;
  if not found then raise exception 'order not found' using errcode='42501'; end if;
  if p_decision='refund' and r.status='refund_pending' then return; end if;
  if p_decision='wait' and r.status='paid' and r.accepted_pickup_revision=p_replacement_id then return; end if;
  if r.status<>'paid' or b.transaction_policy_version<>2 or p_decision not in ('wait','refund') then raise exception 'order not eligible' using errcode='55000'; end if;
  select estimated_ready_at,pickup_ends_at,b.ready_at into starts,ends,ready from public.batch_timeline where batch_id=b.id;
  if r.accepted_pickup_revision is not null then select starts_at,ends_at,ready_at into starts,ends,ready from public.pickup_replacements where id=r.accepted_pickup_revision; end if;
  if clock_timestamp()<starts or (ready is not null and ready<=starts) then raise exception 'supplier is not delayed' using errcode='55000'; end if;
  if p_decision='refund' or clock_timestamp()>=ends then perform public.queue_delayed_supplier_refund(r.id); return; end if;
  select * into pr from public.pickup_replacements where id=p_replacement_id and batch_id=b.id;
  if not found or pr.starts_at<=clock_timestamp() or pr.revision<>(select max(revision) from public.pickup_replacements where batch_id=b.id) then raise exception 'replacement unavailable' using errcode='55000'; end if;
  insert into public.pickup_replacement_decisions(registration_id,replacement_id,decision) values(r.id,pr.id,'wait') on conflict do nothing;
  update public.registrations set accepted_pickup_revision=pr.id,updated_at=clock_timestamp() where id=r.id;
end; $$;

-- Internal helpers are not callable by clients. Grant only the ownership-gated entry points.
revoke all on function public.queue_delayed_supplier_refund(uuid) from public,anon,authenticated;
revoke all on function public.assert_pickup_window(timestamptz,timestamptz) from public,anon,authenticated;
revoke all on function public.save_supplier_offer_draft(uuid,jsonb,smallint,integer) from public,anon;
revoke all on function public.publish_supplier_offer(uuid,integer,text) from public,anon;
revoke all on function public.join_batch_v2(uuid,integer,jsonb,numeric,numeric) from public,anon;
revoke all on function public.withdraw_batch_registration(uuid) from public,anon;
revoke all on function public.propose_pickup_replacement(uuid,timestamptz,timestamptz,text) from public,anon;
revoke all on function public.decide_pickup_replacement(uuid,uuid,text) from public,anon;
grant execute on function public.save_supplier_offer_draft(uuid,jsonb,smallint,integer),public.publish_supplier_offer(uuid,integer,text),public.join_batch_v2(uuid,integer,jsonb,numeric,numeric),public.withdraw_batch_registration(uuid),public.propose_pickup_replacement(uuid,timestamptz,timestamptz,text),public.decide_pickup_replacement(uuid,uuid,text) to authenticated;

create or replace function public.materialize_supplier_batch(p_batch_id uuid) returns jsonb
language plpgsql security definer set search_path=public as $$
declare b public.batches%rowtype; t public.batch_timeline%rowtype; total integer; r record;
begin
  if auth.uid() is null then raise exception 'sign in required' using errcode='42501'; end if;
  select * into b from public.batches where id=p_batch_id for update;
  if not found then raise exception 'batch not found' using errcode='P0002'; end if;
  select * into t from public.batch_timeline where batch_id=b.id;
  if b.status='published' then
    select coalesce(sum(quantity),0) into total from public.registrations where batch_id=b.id and status='registered';
    if b.transaction_policy_version=1 and b.capacity_quantity is not null and total>=b.capacity_quantity then
      return public.close_batch_and_issue_invoices(b.id,'capacity_reached');
    elsif now()>=t.registration_closes_at then
      perform public.close_batch_and_issue_invoices(b.id,'registration_expired');
    end if;
  end if;
  if b.transaction_policy_version=2 then
    for r in select id from public.registrations where batch_id=b.id and (umkm_id=auth.uid() or b.supplier_id=auth.uid() or public.is_admin()) loop
      perform public.materialize_umkm_order(r.id);
    end loop;
    if (clock_timestamp()>=t.payment_closes_at or (clock_timestamp()>=t.registration_closes_at and not exists(select 1 from public.registrations where batch_id=b.id and status<>'cancelled'))) and not exists(select 1 from public.registrations where batch_id=b.id and status in ('registered','pending_payment','paid','picked_up','refund_pending')) then
      update public.batches set status='completed',close_reason=case when not exists(select 1 from public.registrations where batch_id=b.id and status<>'cancelled') then 'no_participants' else 'no_payments_or_fulfilled' end,completed_at=coalesce(completed_at,now()),updated_at=now() where id=b.id and status='closed';
    end if;
  end if;
  return jsonb_build_object('closed',(select status<>'published' from public.batches where id=b.id),'idempotent',true,'batchId',b.id);
end; $$;

create or replace function public.mark_supplier_batch_ready(p_batch_id uuid) returns void
language plpgsql security definer set search_path=public as $$
declare b public.batches%rowtype; replacement uuid;
begin
  select * into b from public.batches where id=p_batch_id for update;
  if not found then raise exception 'batch not found' using errcode='P0002'; end if;
  if not ((b.supplier_id=auth.uid() and public.is_approved_supplier()) or public.is_admin()) then raise exception 'owning supplier required' using errcode='42501'; end if;
  if b.status<>'closed' then raise exception 'batch is not closed' using errcode='55000'; end if;
  if b.transaction_policy_version=2 and not exists(select 1 from public.registrations where batch_id=b.id and status='paid') then raise exception 'no paid orders to prepare' using errcode='55000'; end if;
  select id into replacement from public.pickup_replacements where batch_id=b.id order by revision desc limit 1;
  if replacement is not null then update public.pickup_replacements set ready_at=coalesce(ready_at,now()) where id=replacement;
  else update public.batches set ready_at=coalesce(ready_at,now()),updated_at=now() where id=b.id; end if;
  insert into public.notifications(user_id,type,title,message,data)
    select umkm_id,'pickup_ready','Barang telah disiapkan','Datang sesuai periode pengambilan yang Anda setujui.',jsonb_build_object('registration_id',r.id,'replacement_id',replacement)
    from public.registrations r where r.batch_id=b.id and r.status='paid' and not exists(
      select 1 from public.notifications n where n.user_id=r.umkm_id and n.type='pickup_ready' and n.data->>'registration_id'=r.id::text and coalesce(n.data->>'replacement_id','')=coalesce(replacement::text,''));
end; $$;

create function public.get_offer_context(p_batch_id uuid) returns jsonb
language plpgsql stable security definer set search_path=public as $$
declare b public.batches%rowtype; t public.batch_timeline%rowtype;
begin
  select * into b from public.batches where id=p_batch_id;
  if not found or not (b.status='published' or b.supplier_id=auth.uid() or public.is_admin() or exists(select 1 from public.registrations where batch_id=b.id and umkm_id=auth.uid())) then return null; end if;
  select * into t from public.batch_timeline where batch_id=b.id;
  return jsonb_build_object('transaction_policy_version',b.transaction_policy_version,'commercial_locked',exists(select 1 from public.registrations where batch_id=b.id),'ready_at',b.ready_at,'capacity_quantity',b.capacity_quantity,'unit',b.unit,
    'payment_opens_at',t.payment_opens_at,'payment_closes_at',t.payment_closes_at,'estimated_ready_at',t.estimated_ready_at,'pickup_ends_at',t.pickup_ends_at,
    'replacements',coalesce((select jsonb_agg(to_jsonb(pr) order by revision desc) from public.pickup_replacements pr where batch_id=b.id),'[]'::jsonb),
    'pickup_actions',case when b.supplier_id=auth.uid() or public.is_admin() then coalesce((select jsonb_agg(jsonb_build_object('registration_id',r.id,'can_confirm',r.status='paid' and now()>=case when pr.id is null then t.estimated_ready_at else pr.starts_at end and now()<case when pr.id is null then t.pickup_ends_at else pr.ends_at end and case when pr.id is null then b.ready_at<=t.estimated_ready_at else pr.ready_at<=pr.starts_at end)) from public.registrations r left join public.pickup_replacements pr on pr.id=r.accepted_pickup_revision where r.batch_id=b.id),'[]'::jsonb) else '[]'::jsonb end);
end; $$;
revoke all on function public.get_offer_context(uuid) from public;
grant execute on function public.get_offer_context(uuid) to anon,authenticated;

create function public.get_registration_volume_v2(p_batch_id uuid) returns jsonb
language plpgsql stable security definer set search_path=public as $$
begin
  if not exists(select 1 from public.batches where id=p_batch_id and (status='published' or supplier_id=auth.uid())) then raise exception 'batch unavailable' using errcode='42501'; end if;
  return jsonb_build_object('quantity',(select coalesce(sum(quantity),0) from public.registrations where batch_id=p_batch_id and status='registered'),
    'registered',exists(select 1 from public.registrations where batch_id=p_batch_id and umkm_id=auth.uid() and status='registered'),
    'registrationId',(select id from public.registrations where batch_id=p_batch_id and umkm_id=auth.uid()));
end; $$;
create function public.get_registration_context_v2(p_registration_id uuid) returns jsonb
language sql stable security definer set search_path=public as $$
  select jsonb_build_object('batchId',batch_id) from public.registrations where id=p_registration_id and umkm_id=auth.uid();
$$;
revoke all on function public.get_registration_volume_v2(uuid),public.get_registration_context_v2(uuid) from public,anon;
grant execute on function public.get_registration_volume_v2(uuid),public.get_registration_context_v2(uuid) to authenticated;

-- Prevent direct browser writes from bypassing consent, cutoff or exemption checks.
create function public.guard_versioned_registration() returns trigger language plpgsql set search_path=public as $$
begin
  if current_user in ('authenticated','anon') and exists(select 1 from public.batches where id=new.batch_id and transaction_policy_version=2) then
    raise exception 'use the ownership-gated transaction endpoints' using errcode='42501';
  end if;
  return new;
end; $$;
create trigger versioned_registration_gate before insert or update on public.registrations for each row execute function public.guard_versioned_registration();

-- A withdrawn participant still locks the promises they previously accepted.
create function public.enforce_offer_commitments() returns trigger language plpgsql set search_path=public as $$
begin
 if old.transaction_policy_version=2 then
  if new.transaction_policy_version<>old.transaction_policy_version then raise exception 'transaction policy is immutable' using errcode='55000'; end if;
  if exists(select 1 from public.registrations where batch_id=old.id) and
    (new.min_quantity,new.capacity_quantity,new.unit,new.payment_window_hours,new.pickup_name,new.pickup_address,new.latitude,new.longitude) is distinct from
    (old.min_quantity,old.capacity_quantity,old.unit,old.payment_window_hours,old.pickup_name,old.pickup_address,old.latitude,old.longitude) then raise exception 'commercial promises are locked after first participant' using errcode='55000'; end if;
 end if;
 return new;
end; $$;
create trigger versioned_offer_commitments before update on public.batches for each row execute function public.enforce_offer_commitments();
create function public.enforce_offer_timeline() returns trigger language plpgsql set search_path=public as $$
begin
 if exists(select 1 from public.batches where id=old.batch_id and transaction_policy_version=2) and exists(select 1 from public.registrations where batch_id=old.batch_id) and
  (new.registration_opens_at,new.registration_closes_at,new.payment_opens_at,new.payment_closes_at,new.estimated_ready_at,new.pickup_ends_at) is distinct from
  (old.registration_opens_at,old.registration_closes_at,old.payment_opens_at,old.payment_closes_at,old.estimated_ready_at,old.pickup_ends_at) then raise exception 'promised schedule is locked after first participant' using errcode='55000'; end if;
 return new;
end; $$;
create trigger versioned_timeline_gate before update on public.batch_timeline for each row execute function public.enforce_offer_timeline();
create function public.enforce_offer_tiers() returns trigger language plpgsql set search_path=public as $$
declare batch uuid;
begin
 batch:=case when tg_op='DELETE' then old.batch_id else new.batch_id end;
 if exists(select 1 from public.batches where id=batch and transaction_policy_version=2) and exists(select 1 from public.registrations where batch_id=batch) then raise exception 'prices are locked after first participant' using errcode='55000'; end if;
 if tg_op='DELETE' then return old; else return new; end if;
end; $$;
create trigger versioned_tier_gate before insert or update or delete on public.batch_tiers for each row execute function public.enforce_offer_tiers();

create function public.update_offer_content_v2(p_batch_id uuid,p_payload jsonb,p_photo_url text) returns void
language plpgsql security definer set search_path=public as $$
declare b public.batches%rowtype; p jsonb:=p_payload; tiers jsonb; existing jsonb; locked boolean;
begin
 select * into b from public.batches where id=p_batch_id for update;
 if not found or b.supplier_id is distinct from auth.uid() or not public.is_approved_supplier() then raise exception 'owning supplier required' using errcode='42501'; end if;
 if b.transaction_policy_version<>2 or b.status<>'published' then raise exception 'offer cannot be edited' using errcode='55000'; end if;
 if nullif(trim(p->>'title'),'') is null or nullif(trim(p->>'description'),'') is null or p->>'category' is null or p->>'unit' is null or p->>'category' not in ('Sayur & Buah','Daging & Ikan','Makanan Siap Saji','Kerajinan','Jasa') or p->>'unit' not in ('kg','gram','liter','ml','pcs','pack','karung','ikat','sisir') then raise exception 'invalid product' using errcode='22023'; end if;
 if p->>'capacityQuantity' is null or (p->>'capacityQuantity')::integer<1 or nullif(trim(p->>'pickupName'),'') is null or nullif(trim(p->>'pickupAddress'),'') is null or p->>'pickupLatitude' is null or p->>'pickupLongitude' is null then raise exception 'invalid location or capacity' using errcode='22023'; end if;
 if 6371 * acos(least(1.0,greatest(-1.0,sin(radians(-6.914744))*sin(radians((p->>'pickupLatitude')::numeric))+cos(radians(-6.914744))*cos(radians((p->>'pickupLatitude')::numeric))*cos(radians((p->>'pickupLongitude')::numeric)-radians(107.60981)))))>50 then raise exception 'pickup outside Bandung' using errcode='22023'; end if;
 select jsonb_agg(jsonb_build_object('tier_number',n::integer,'min_volume',(value->>'minimumQuantity')::integer,'max_volume',case when n<jsonb_array_length(p->'tiers') then (p->'tiers'->n::integer->>'minimumQuantity')::integer-1 else null end,'price_per_unit',(value->>'pricePerUnit')::numeric) order by n) into tiers from jsonb_array_elements(p->'tiers') with ordinality t(value,n);
 perform public.validate_catalog_tiers(tiers);
 if (tiers->0->>'min_volume')::integer<>1 or exists(select 1 from jsonb_array_elements(tiers) t where (t->>'min_volume')::integer>(p->>'capacityQuantity')::integer) then raise exception 'invalid discount threshold' using errcode='22023'; end if;
 if p_photo_url is distinct from b.product_photo_url and not exists(select 1 from storage.objects o where o.bucket_id='wesup-public' and o.name ~ ('^products/'||b.id::text||'/[^/]+\.webp$') and p_photo_url=regexp_replace(p_photo_url,'/storage/v1/object/public/wesup-public/.*$','/storage/v1/object/public/wesup-public/')||o.name) then raise exception 'owned photo required' using errcode='22023'; end if;
 select jsonb_agg(jsonb_build_object('tier_number',tier_number,'min_volume',min_volume,'max_volume',max_volume,'price_per_unit',price_per_unit) order by tier_number) into existing from public.batch_tiers where batch_id=b.id;
 locked:=exists(select 1 from public.registrations where batch_id=b.id);
 if locked and tiers is distinct from existing then raise exception 'prices are locked after first participant' using errcode='55000'; end if;
 update public.batches set title=trim(p->>'title'),description=trim(p->>'description'),category=p->>'category',unit=p->>'unit',capacity_quantity=(p->>'capacityQuantity')::integer,min_quantity=(tiers->(jsonb_array_length(tiers)-1)->>'min_volume')::integer,pickup_name=trim(p->>'pickupName'),pickup_address=trim(p->>'pickupAddress'),latitude=(p->>'pickupLatitude')::numeric,longitude=(p->>'pickupLongitude')::numeric,product_photo_url=coalesce(p_photo_url,b.product_photo_url),updated_at=now() where id=b.id;
 if not locked then
  delete from public.batch_tiers where batch_id=b.id;
  insert into public.batch_tiers(batch_id,tier_number,min_volume,max_volume,price_per_unit) select b.id,t.tier_number,t.min_volume,t.max_volume,t.price_per_unit from jsonb_to_recordset(tiers) t(tier_number integer,min_volume integer,max_volume integer,price_per_unit numeric);
 end if;
end; $$;
revoke all on function public.update_offer_content_v2(uuid,jsonb,text) from public,anon;
grant execute on function public.update_offer_content_v2(uuid,jsonb,text) to authenticated;

create table public.transaction_support_requests (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references public.profiles(id),
  registration_id uuid references public.registrations(id), batch_id uuid references public.batches(id),
  message text not null check (length(message) between 10 and 2000),
  status text not null default 'pending' check (status in ('pending','resolved')), created_at timestamptz not null default now(),
  resolution_note text, resolved_by uuid references public.profiles(id), resolved_at timestamptz
);
alter table public.transaction_support_requests enable row level security;
create policy transaction_support_read on public.transaction_support_requests for select to authenticated using (user_id=auth.uid() or public.is_admin());
create function public.request_transaction_support(p_registration_id uuid,p_batch_id uuid,p_message text) returns uuid
language plpgsql security definer set search_path=public as $$
declare result uuid;
begin
  if auth.uid() is null then raise exception 'sign in required' using errcode='42501'; end if;
  if p_registration_id is not null and not exists(select 1 from public.registrations where id=p_registration_id and umkm_id=auth.uid()) then raise exception 'order not found' using errcode='42501'; end if;
  if p_batch_id is not null and not exists(select 1 from public.batches where id=p_batch_id and supplier_id=auth.uid()) then raise exception 'batch not found' using errcode='42501'; end if;
  if p_registration_id is null and p_batch_id is null then raise exception 'transaction required' using errcode='22023'; end if;
  insert into public.transaction_support_requests(user_id,registration_id,batch_id,message) values(auth.uid(),p_registration_id,p_batch_id,trim(p_message)) returning id into result;
  insert into public.notifications(user_id,type,title,message,data) select id,'batch_update','Bantuan transaksi diperlukan','Pengguna mengajukan bantuan atau keberatan penalti.',jsonb_build_object('support_request_id',result,'registration_id',p_registration_id,'batch_id',p_batch_id) from public.profiles where role='admin';
  return result;
end; $$;
revoke all on function public.request_transaction_support(uuid,uuid,text) from public,anon;
grant execute on function public.request_transaction_support(uuid,uuid,text) to authenticated;

create function public.resolve_transaction_support(p_request_id uuid,p_note text,p_exempt_payment boolean default false,p_restore_access boolean default false) returns void
language plpgsql security definer set search_path=public as $$
declare support public.transaction_support_requests%rowtype; r public.registrations%rowtype; strikes integer;
begin
 if not public.is_admin() then raise exception 'admin required' using errcode='42501'; end if;
 if length(trim(p_note))<10 then raise exception 'verified resolution note required' using errcode='22023'; end if;
 select * into support from public.transaction_support_requests where id=p_request_id for update;
 if not found then raise exception 'request not found' using errcode='P0002'; end if;
 if support.status='resolved' then return; end if;
 if p_exempt_payment then
  select * into r from public.registrations where id=support.registration_id for update;
  if not found then raise exception 'payment order required' using errcode='22023'; end if;
  if not r.payment_penalty_exempt and r.cancellation_reason='payment_deadline' then
   update public.umkm_profiles set strike_count=greatest(0,strike_count-1),updated_at=now() where user_id=r.umkm_id returning strike_count into strikes;
  else select strike_count into strikes from public.umkm_profiles where user_id=r.umkm_id; end if;
  update public.registrations set payment_penalty_exempt=true,cancellation_reason=case when cancellation_reason='payment_deadline' then 'verified_disruption' else cancellation_reason end where id=r.id;
  -- Restoring access is a separate, explicit Admin decision; bans are preserved.
  if p_restore_access then
   if coalesce(strikes,0)<2 then
    update public.profiles set status='active',updated_at=now() where id=r.umkm_id and status in ('suspended_temporary','suspended_permanent');
    update public.umkm_profiles set suspended_until=null where user_id=r.umkm_id;
   elsif strikes=2 then
    update public.profiles set status='suspended_temporary',updated_at=now() where id=r.umkm_id and status='suspended_permanent';
    update public.umkm_profiles set suspended_until=coalesce(suspended_until,now()+interval '7 days') where user_id=r.umkm_id;
   end if;
  end if;
 end if;
 update public.transaction_support_requests set status='resolved',resolution_note=trim(p_note),resolved_by=auth.uid(),resolved_at=now() where id=support.id;
 insert into public.notifications(user_id,type,title,message,data) values(support.user_id,'batch_update','Bantuan transaksi sudah ditinjau',trim(p_note),jsonb_build_object('registration_id',support.registration_id,'batch_id',support.batch_id,'support_request_id',support.id,'payment_penalty_exempt',p_exempt_payment));
end; $$;
revoke all on function public.resolve_transaction_support(uuid,text,boolean,boolean) from public,anon;
grant execute on function public.resolve_transaction_support(uuid,text,boolean,boolean) to authenticated;
grant select on public.supplier_offer_drafts,public.pickup_replacements,public.pickup_replacement_decisions,public.transaction_support_requests to authenticated;


create or replace function public.close_batch_and_issue_invoices(
  p_batch_id uuid,
  p_trigger text,
  p_ip_address text default null,
  p_user_agent text default null
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_batch public.batches%rowtype;
  v_timeline public.batch_timeline%rowtype;
  v_tier public.batch_tiers%rowtype;
  v_total integer;
  v_close_at timestamptz;
  v_payment_close timestamptz;
  v_is_admin boolean := public.is_admin();
  v_is_owner boolean := false;
  v_invoice_count integer := 0;
begin
  if auth.uid() is null then raise exception 'sign in required'; end if;
  if p_trigger not in ('capacity_reached', 'registration_expired', 'supplier_manual') then
    raise exception 'invalid close trigger' using errcode = '22023';
  end if;
  if p_trigger = 'supplier_manual' and not public.is_admin() and not public.is_approved_supplier() then
    raise exception 'active approved supplier required' using errcode = '42501';
  end if;

  select * into v_batch from public.batches where id = p_batch_id for update;
  if not found then raise exception 'batch not found' using errcode = 'P0002'; end if;
  v_is_owner := v_batch.supplier_id = auth.uid();

  if v_batch.status <> 'published' then
    if v_batch.status = 'closed' then
      return jsonb_build_object('closed', true, 'idempotent', true, 'batchId', p_batch_id);
    end if;
    raise exception 'batch is not open' using errcode = '55000';
  end if;

  select * into v_timeline from public.batch_timeline where batch_id = p_batch_id;
  if not found then raise exception 'batch timeline is missing' using errcode = 'P0002'; end if;

  select coalesce(sum(r.quantity), 0)::integer into v_total
    from public.registrations r
   where r.batch_id = p_batch_id and r.status = 'registered';

  if v_batch.transaction_policy_version = 2 and p_trigger <> 'registration_expired' then
    raise exception 'payment schedule cannot be advanced' using errcode='55000';
  end if;
  if p_trigger = 'supplier_manual' then
    if not (v_is_owner or v_is_admin) then raise exception 'only owning supplier may close batch' using errcode = '42501'; end if;
    if v_total < v_batch.min_quantity then raise exception 'minimum quantity has not been reached' using errcode = '55000'; end if;
    if now() >= v_timeline.registration_closes_at then raise exception 'registration cutoff has passed' using errcode = '55000'; end if;
  elsif p_trigger = 'capacity_reached' then
    if v_batch.capacity_quantity is null or v_total < v_batch.capacity_quantity then
      raise exception 'batch capacity has not been reached' using errcode = '55000';
    end if;
  elsif now() < v_timeline.registration_closes_at then
    raise exception 'registration is still open' using errcode = '55000';
  end if;

  if v_batch.capacity_quantity is not null and v_total > v_batch.capacity_quantity then
    raise exception 'registration volume exceeds capacity' using errcode = '22023';
  end if;

  if v_batch.transaction_policy_version = 2 then
    if p_trigger <> 'registration_expired' or now() < v_timeline.registration_closes_at then
      raise exception 'payment schedule cannot be advanced' using errcode='55000';
    end if;
  end if;
  v_close_at := case when p_trigger = 'registration_expired' then v_timeline.registration_closes_at else now() end;
  v_payment_close := v_close_at + make_interval(hours => v_batch.payment_window_hours);

  select bt.* into v_tier
    from public.batch_tiers bt
   where bt.batch_id = p_batch_id
     and bt.min_volume <= v_total
     and (bt.max_volume is null or v_total <= bt.max_volume)
   order by bt.min_volume desc
   limit 1;
  if not found then
    select bt.* into v_tier from public.batch_tiers bt
     where bt.batch_id = p_batch_id and bt.tier_number = 1;
  end if;
  if not found then raise exception 'batch has no tier 1 price' using errcode = '22023'; end if;

  update public.registrations
     set locked_tier_number = v_tier.tier_number,
         locked_price_per_unit = v_tier.price_per_unit,
         final_amount = round(least(v_tier.price_per_unit * quantity, 9999999999.99), 2),
         status = 'pending_payment',
         updated_at = now()
   where batch_id = p_batch_id and status = 'registered';

  insert into public.payments as existing (registration_id, midtrans_order_id, gross_amount, status)
  select r.id, 'WESUP-' || replace(r.id::text, '-', ''), r.final_amount, 'pending'
    from public.registrations r
   where r.batch_id = p_batch_id and r.status = 'pending_payment' and r.final_amount is not null
  on conflict (registration_id) do update
    set gross_amount = excluded.gross_amount,
        status = case
          when existing.status = 'paid' then existing.status
          else excluded.status
        end,
        updated_at = now();

  get diagnostics v_invoice_count = row_count;

  update public.batches
     set status = 'closed', registration_closed_at = v_close_at,
         close_reason = case when v_total = 0 then 'no_registrations' else p_trigger end,
         final_registered_quantity = v_total,
         locked_tier_number = v_tier.tier_number,
         locked_unit_price = v_tier.price_per_unit,
         invoices_issued_at = now(), updated_at = now()
   where id = p_batch_id;

  update public.batch_timeline
     set effective_payment_opens_at = v_close_at,
         effective_payment_closes_at = v_payment_close
   where batch_id = p_batch_id;

  insert into public.notifications (user_id, type, title, message, data)
  select r.umkm_id, 'payment_due', 'Tagihan batch sudah terbit',
         format('Tagihan %s sebesar Rp %s tersedia untuk dibayar.', b.title, to_char(r.final_amount, 'FM999G999G999G990')),
         jsonb_build_object('registration_id', r.id, 'batch_id', p_batch_id)
    from public.registrations r
    join public.batches b on b.id = r.batch_id
   where r.batch_id = p_batch_id and r.status = 'pending_payment'
     and not exists (
       select 1 from public.notifications n
        where n.user_id = r.umkm_id and n.type = 'payment_due'
          and n.data ->> 'registration_id' = r.id::text
     );

  if v_is_admin then
    insert into public.admin_audit_logs (admin_id, action_type, target_type, target_id, details, ip_address, user_agent)
    values (auth.uid(), 'cut_off_batch', 'batches', p_batch_id,
            jsonb_build_object('trigger', p_trigger, 'total_volume', v_total, 'locked_tier', v_tier.tier_number),
            p_ip_address, p_user_agent);
  end if;

  return jsonb_build_object(
    'closed', true,
    'idempotent', false,
    'batchId', p_batch_id,
    'totalQuantity', v_total,
    'tierNumber', v_tier.tier_number,
    'unitPrice', v_tier.price_per_unit,
    'invoiceCount', v_invoice_count,
    'closedAt', v_close_at,
    'paymentOpensAt', v_close_at,
    'paymentClosesAt', v_payment_close
  );
end;
$$;

create or replace function public.materialize_umkm_order(p_registration_id uuid)
returns public.registration_status
language plpgsql security definer set search_path = public
as $$
declare
  v_registration public.registrations%rowtype;
  v_timeline public.batch_timeline%rowtype;
  v_payment_id uuid;
  v_dispute_status public.dispute_status;
  v_has_pending_attempt boolean := false;
  v_batch public.batches%rowtype;
  v_start timestamptz; v_end timestamptz; v_ready timestamptz;
begin
  select * into v_registration from public.registrations where id = p_registration_id for update;
  if not found or (auth.uid() is not null and v_registration.umkm_id <> auth.uid() and not public.is_admin() and not exists(select 1 from public.batches where id=v_registration.batch_id and supplier_id=auth.uid())) then
    raise exception 'order not found';
  end if;
  select * into v_batch from public.batches where id=v_registration.batch_id;
  select * into v_timeline from public.batch_timeline where batch_id = v_registration.batch_id;
  if v_registration.status = 'registered' and now() >= v_timeline.registration_closes_at then
    if v_registration.final_amount is not null then
      insert into public.payments (registration_id, midtrans_order_id, gross_amount)
      values (p_registration_id, 'WESUP-' || replace(p_registration_id::text, '-', ''), v_registration.final_amount)
      on conflict (registration_id) do nothing;
    end if;
  end if;

  if v_batch.transaction_policy_version=2 and v_registration.status='paid' then
    v_start:=v_timeline.estimated_ready_at; v_end:=v_timeline.pickup_ends_at; v_ready:=v_batch.ready_at;
    if v_registration.accepted_pickup_revision is not null then
      select starts_at,ends_at,ready_at into v_start,v_end,v_ready from public.pickup_replacements where id=v_registration.accepted_pickup_revision;
    end if;
    if now()>=v_end then
      if v_ready is null or v_ready>v_start then perform public.queue_delayed_supplier_refund(p_registration_id);
      else
        update public.registrations set status='no_show',cancellation_reason='pickup_deadline',updated_at=now() where id=p_registration_id and status='paid';
        update public.escrow_holds set status='forfeited',released_at=now(),release_destination='supplier' where registration_id=p_registration_id and status='held' and pickup_confirmed_at is null;
      end if;
    end if;
    return (select status from public.registrations where id=p_registration_id);
  end if;

  -- Paid orders that pass the twelve-hour pickup tolerance become no-show.
  -- The escrow forfeiture is idempotent. No-Show does NOT count toward the
  -- Hit-and-Run ladder: it carries its own 100% forfeiture sanction.
  if v_registration.status = 'paid'
     and now() >= v_timeline.estimated_ready_at + interval '12 hours' then
    update public.registrations set status = 'no_show', updated_at = now()
      where id = p_registration_id and status = 'paid';
    if found then
      update public.escrow_holds
         set status = 'forfeited', released_at = now(), release_destination = 'supplier'
       where registration_id = p_registration_id
         and status = 'held'
         and pickup_confirmed_at is null;
    end if;
  elsif v_registration.status = 'picked_up' then
    select d.status into v_dispute_status
      from public.disputes d where d.registration_id = p_registration_id;
    if v_dispute_status = 'resolved_umkm' then
      update public.escrow_holds
         set status = 'frozen', release_destination = 'umkm', dispute_id = (
           select id from public.disputes where registration_id = p_registration_id
         )
       where registration_id = p_registration_id and status in ('held', 'frozen');
      update public.registrations set status = 'refund_pending', updated_at = now()
       where id = p_registration_id and status = 'picked_up';
      insert into public.refund_requests (registration_id, batch_id, trigger_type, amount, status)
        values (p_registration_id, v_registration.batch_id, 'dispute_won', v_registration.final_amount, 'pending')
        on conflict (registration_id) do nothing;
    elsif v_dispute_status is null or v_dispute_status = 'resolved_supplier' then
      update public.escrow_holds
         set status = 'released', released_at = now(), release_destination = coalesce(release_destination, 'supplier')
       where registration_id = p_registration_id
         and status = 'held'
         and auto_release_at is not null and auto_release_at <= now()
         and coalesce(release_destination, 'supplier') = 'supplier';
      if found then
        update public.registrations set status = 'completed', updated_at = now()
         where id = p_registration_id and status = 'picked_up';
      end if;
    end if;
  elsif v_registration.status = 'registered' and now() >= coalesce(v_timeline.effective_payment_opens_at, v_timeline.payment_opens_at) then
    if now() < coalesce(v_timeline.effective_payment_closes_at, v_timeline.payment_closes_at) then
      update public.registrations set status = 'pending_payment', updated_at = now()
       where id = p_registration_id and status = 'registered';
      if v_registration.final_amount is not null then
        insert into public.payments (registration_id, midtrans_order_id, gross_amount)
        values (p_registration_id, 'WESUP-' || replace(p_registration_id::text, '-', ''), v_registration.final_amount)
        on conflict (registration_id) do nothing;
      end if;
    else
      update public.registrations set status = 'cancelled', updated_at = now()
       where id = p_registration_id and status = 'registered';
    end if;
  elsif v_registration.status = 'pending_payment' and now() >= coalesce(v_timeline.effective_payment_closes_at, v_timeline.payment_closes_at) then
    select id into v_payment_id from public.payments where registration_id = p_registration_id;
    select exists (
      select 1 from public.payment_attempts
       where payment_id = v_payment_id and status = 'pending'
    ) into v_has_pending_attempt;
    -- A pending provider attempt must be reconciled against Midtrans first;
    -- otherwise a late settlement webhook could be penalized as Hit-and-Run.
    if not v_has_pending_attempt then
      update public.payments set status = 'expired', updated_at = now()
        where id = v_payment_id and status = 'pending';
      update public.registrations set status = 'cancelled',cancellation_reason=case when v_batch.transaction_policy_version=2 then case when v_registration.payment_penalty_exempt then 'verified_disruption' else 'payment_deadline' end else cancellation_reason end, updated_at = now()
        where id = p_registration_id and status = 'pending_payment';
      if found then
        if not v_registration.payment_penalty_exempt then
        update public.umkm_profiles
           set strike_count = strike_count + 1, updated_at = now()
         where user_id = v_registration.umkm_id;
        perform public.apply_hit_and_run_escalation(
          v_registration.umkm_id,
          coalesce(v_timeline.effective_payment_closes_at, v_timeline.payment_closes_at),
          p_registration_id
        );
        end if;
      end if;
    end if;
  end if;
  select status into v_registration.status from public.registrations where id = p_registration_id;
  return v_registration.status;
end;
$$;

create or replace function public.materialize_supplier_order(p_registration_id uuid)
returns public.registration_status
language plpgsql security definer set search_path = public
as $$
declare
  v_batch_id uuid;
  v_umkm_id uuid;
  v_supplier_id uuid;
  v_status public.registration_status;
  v_payment_close timestamptz;
  v_payment_id uuid;
begin
  if auth.uid() is null then raise exception 'sign in required' using errcode = '42501'; end if;
  select r.batch_id, r.umkm_id, b.supplier_id, r.status
    into v_batch_id, v_umkm_id, v_supplier_id, v_status
    from public.registrations r join public.batches b on b.id = r.batch_id
   where r.id = p_registration_id;
  if not found then raise exception 'order not found' using errcode = 'P0002'; end if;
  if auth.uid() <> v_umkm_id and auth.uid() <> v_supplier_id and not public.is_admin() then
    raise exception 'order not found' using errcode = 'P0002';
  end if;

  perform public.materialize_supplier_batch(v_batch_id);
  select coalesce(t.effective_payment_closes_at, t.payment_closes_at), r.status into v_payment_close, v_status
    from public.registrations r join public.batch_timeline t on t.batch_id = r.batch_id
   where r.id = p_registration_id;
  if v_status = 'pending_payment' and not exists(select 1 from public.batches where id=v_batch_id and transaction_policy_version=2) and v_payment_close is not null and now() >= v_payment_close then
    select id into v_payment_id from public.payments where registration_id = p_registration_id;
    if not exists (select 1 from public.payment_attempts where payment_id = v_payment_id and status = 'pending') then
      update public.payments set status = 'expired', updated_at = now() where id = v_payment_id and status = 'pending';
      update public.registrations set status = 'cancelled', updated_at = now() where id = p_registration_id and status = 'pending_payment';
      if found then
        update public.umkm_profiles set strike_count = strike_count + 1, updated_at = now() where user_id = v_umkm_id;
        perform public.apply_hit_and_run_escalation(v_umkm_id, v_payment_close, p_registration_id);
      end if;
    end if;
  end if;
  return public.materialize_umkm_order(p_registration_id);
end;
$$;

create or replace function public.confirm_pickup(
  p_registration_id uuid,
  p_method text,
  p_code text default null,
  p_latitude numeric default null,
  p_longitude numeric default null,
  p_notes text default null,
  p_ip_address text default null,
  p_user_agent text default null
) returns void
language plpgsql security definer set search_path = public
as $$
declare
  v_supplier_id uuid;
  v_status public.registration_status;
  v_policy smallint; v_start timestamptz; v_end timestamptz; v_ready timestamptz; v_accepted uuid;
begin
  if auth.uid() is null then raise exception 'sign in required'; end if;
  if p_registration_id is null then raise exception 'registration id is required'; end if;
  if p_method not in ('qr', 'pin') then raise exception 'method must be qr or pin'; end if;

  select b.supplier_id, r.status
    into v_supplier_id, v_status
    from public.registrations r
    join public.batches b on b.id = r.batch_id
   where r.id = p_registration_id for update of r,b;
  if not found then raise exception 'registration not found'; end if;
  if not ((auth.uid() = v_supplier_id and public.is_supplier()) or public.is_admin()) then
    raise exception 'only the owning supplier or an admin may confirm pickup';
  end if;
  select b.transaction_policy_version,t.estimated_ready_at,t.pickup_ends_at,b.ready_at,r.accepted_pickup_revision
    into v_policy,v_start,v_end,v_ready,v_accepted from public.registrations r join public.batches b on b.id=r.batch_id join public.batch_timeline t on t.batch_id=b.id where r.id=p_registration_id;
  if v_policy=2 then
    if v_accepted is not null then select starts_at,ends_at,ready_at into v_start,v_end,v_ready from public.pickup_replacements where id=v_accepted; end if;
    if clock_timestamp()<v_start or clock_timestamp()>=v_end or v_ready is null or v_ready>v_start then raise exception 'registration is not eligible for pickup: supplier readiness or accepted window missing' using errcode='55000'; end if;
  end if;
  if v_status <> 'paid' then
    if v_status = 'picked_up' then raise exception 'registration is already picked up'; end if;
    raise exception 'registration is not eligible for pickup (status %s)', v_status;
  end if;
  if p_code is null then raise exception 'code is required'; end if;
  if p_method = 'qr' then
    if not exists (select 1 from public.pickup_codes pc where pc.registration_id = p_registration_id and pc.qr_code_token = p_code and pc.used_at is null) then
      raise exception 'invalid or already-used qr code';
    end if;
  elsif not exists (select 1 from public.pickup_codes pc where pc.registration_id = p_registration_id and pc.pin_code = p_code and pc.used_at is null) then
    raise exception 'invalid or already-used pin';
  end if;

  update public.pickup_codes
     set used_at = now(), used_by_supplier_id = auth.uid()
   where registration_id = p_registration_id and used_at is null;
  insert into public.pickup_events (registration_id, supplier_id, method, latitude, longitude, notes)
    values (p_registration_id, v_supplier_id, p_method, p_latitude, p_longitude, p_notes);
  update public.registrations set status = 'picked_up', updated_at = now()
   where id = p_registration_id and status = 'paid';
  perform public.create_escrow(p_registration_id, now());
end;
$$;


create or replace function public.cancel_supplier_batch(p_batch_id uuid, p_reason text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_batch public.batches%rowtype;
begin
  if auth.uid() is null then raise exception 'sign in required'; end if;
  if nullif(trim(p_reason), '') is null then raise exception 'cancellation reason is required' using errcode = '22023'; end if;
  select * into v_batch from public.batches where id = p_batch_id for update;
  if not found then raise exception 'batch not found' using errcode = 'P0002'; end if;
  if not (v_batch.supplier_id = auth.uid() and public.is_supplier()) and not public.is_admin() then raise exception 'only owning supplier may cancel' using errcode = '42501'; end if;
  if v_batch.supplier_id = auth.uid() and not public.is_admin() and not public.is_approved_supplier() then raise exception 'active approved supplier required' using errcode = '42501'; end if;
  if v_batch.status not in ('published', 'closed') then raise exception 'batch cannot be cancelled in its current state' using errcode = '55000'; end if;
  if v_batch.transaction_policy_version=1 and exists (select 1 from public.registrations where batch_id = p_batch_id and status in ('picked_up','completed')) then raise exception 'batch cannot be cancelled after pickup' using errcode = '55000'; end if;

  update public.batches set status = 'cancelled', cancelled_reason = trim(p_reason), close_reason = 'supplier_cancelled', updated_at = now() where id = p_batch_id;
  update public.payments p set status = 'expired'::public.payment_status, updated_at = now()
   where p.registration_id in (select id from public.registrations where batch_id = p_batch_id) and p.status = 'pending';
  update public.registrations set status = case when status = 'paid' then 'refund_pending'::public.registration_status else 'cancelled'::public.registration_status end, cancellation_reason='supplier_cancelled', updated_at = now()
   where batch_id = p_batch_id and status in ('registered', 'pending_payment', 'paid');
  update public.escrow_holds set status = 'frozen' where registration_id in (select id from public.registrations where batch_id = p_batch_id and status = 'refund_pending') and status = 'held';
  update public.registrations set cancellation_reason='supplier_cancel' where batch_id=p_batch_id and status in ('cancelled','refund_pending');
  insert into public.refund_requests (registration_id, batch_id, trigger_type, amount, status)
  select r.id, r.batch_id, 'supplier_cancel', r.final_amount, 'pending'
    from public.registrations r
   where r.batch_id = p_batch_id and r.status = 'refund_pending' and r.final_amount is not null
  on conflict (registration_id) do nothing;
end;
$$;

-- A draft owns its image before publication creates the batch.
create function public.storage_is_offer_supplier(p_name text) returns boolean language sql stable security definer set search_path=public as $$
 select exists(select 1 from public.supplier_offer_drafts d where d.supplier_id=auth.uid() and p_name ~ ('^products/'||d.id::text||'/[^/]+\.webp$')) and public.is_approved_supplier();
$$;
revoke all on function public.storage_is_offer_supplier(text) from public,anon;
grant execute on function public.storage_is_offer_supplier(text) to authenticated;
create policy storage_objects_offer_insert on storage.objects for insert to authenticated with check(bucket_id='wesup-public' and public.storage_is_offer_supplier(name));
create policy storage_objects_offer_delete on storage.objects for delete to authenticated using(bucket_id='wesup-public' and public.storage_is_offer_supplier(name));

create or replace function public.reconcile_batch_payment_window(p_batch_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_status public.batch_status;
  v_supplier_id uuid;
  v_payment_close timestamptz;
  v_payment_close_fallback timestamptz;
  v_close timestamptz;
  v_payment_id uuid;
  v_reg record;
  v_pstatus public.account_status;
  v_suspuntil timestamptz;
  v_processed integer := 0;
  v_warned integer := 0;
  v_suspended integer := 0;
  v_permanent integer := 0;
begin
  if auth.uid() is null then
    raise exception 'sign in required' using errcode = '42501';
  end if;
  select b.status, b.supplier_id, t.payment_closes_at, t.effective_payment_closes_at
    into v_status, v_supplier_id, v_payment_close_fallback, v_payment_close
    from public.batches b
    join public.batch_timeline t on t.batch_id = b.id
   where b.id = p_batch_id;
  if not found then
    raise exception 'batch not found' using errcode = 'P0002';
  end if;
  if not ((v_supplier_id = auth.uid() and public.is_supplier()) or public.is_admin()) then
    raise exception 'not allowed' using errcode = '42501';
  end if;

  v_close := coalesce(v_payment_close, v_payment_close_fallback);
  if v_close is null then
    return jsonb_build_object('processed', false, 'batchId', p_batch_id, 'reason', 'payment window has no closing timestamp');
  end if;
  if now() < v_close then
    return jsonb_build_object('processed', false, 'batchId', p_batch_id, 'reason', 'payment window still open');
  end if;

  for v_reg in
    select r.id, r.umkm_id, r.payment_penalty_exempt
      from public.registrations r
     where r.batch_id = p_batch_id
       and r.status = 'pending_payment'
  loop
    select id into v_payment_id
      from public.payments
     where registration_id = v_reg.id;
    -- A pending provider attempt must be reconciled against Midtrans first;
    -- otherwise a late settlement webhook could be penalized as Hit-and-Run.
    if not exists (
      select 1 from public.payment_attempts
       where payment_id = v_payment_id and status = 'pending'
    ) then
      update public.payments
         set status = 'expired', updated_at = now()
       where id = v_payment_id and status = 'pending';
      update public.registrations
         set status = 'cancelled', cancellation_reason = case when (select transaction_policy_version from public.batches where id=p_batch_id)=2 then case when v_reg.payment_penalty_exempt then 'verified_disruption' else 'payment_deadline' end else cancellation_reason end, updated_at = now()
       where id = v_reg.id and status = 'pending_payment';
      if found and not v_reg.payment_penalty_exempt then
        update public.umkm_profiles
           set strike_count = strike_count + 1, updated_at = now()
         where user_id = v_reg.umkm_id;
        v_processed := v_processed + 1;
        perform public.apply_hit_and_run_escalation(v_reg.umkm_id, v_close, v_reg.id);
        -- Classify the tier reached by this escalation run, so the returned
        -- summary reflects exactly this sweep (not unrelated past sanctions).
        select p.status, u.suspended_until into v_pstatus, v_suspuntil
          from public.profiles p
          join public.umkm_profiles u on u.user_id = p.id
         where p.id = v_reg.umkm_id;
        if v_pstatus = 'suspended_permanent' then
          v_permanent := v_permanent + 1;
        elsif v_pstatus = 'suspended_temporary' or v_suspuntil is not null then
          v_suspended := v_suspended + 1;
        else
          v_warned := v_warned + 1;
        end if;
      end if;
    end if;
  end loop;

  return jsonb_build_object(
    'processed', true,
    'batchId', p_batch_id,
    'paymentWindowClosedAt', v_close,
    'swept', v_processed,
    'escalated', jsonb_build_object('warned', v_warned, 'suspended', v_suspended, 'permanent', v_permanent)
  );
end;
$$;

revoke execute on function public.reconcile_batch_payment_window(uuid) from public, anon;
grant execute on function public.reconcile_batch_payment_window(uuid) to authenticated, service_role;
create function public.assert_order_pickup_ready(p_registration_id uuid) returns void language plpgsql security definer set search_path=public as $$
declare policy smallint; starts timestamptz; ends timestamptz; ready timestamptz; accepted uuid;
begin
 select b.transaction_policy_version,t.estimated_ready_at,t.pickup_ends_at,b.ready_at,r.accepted_pickup_revision into policy,starts,ends,ready,accepted from public.registrations r join public.batches b on b.id=r.batch_id join public.batch_timeline t on t.batch_id=b.id where r.id=p_registration_id;
 if policy=2 then
  if accepted is not null then select starts_at,ends_at,ready_at into starts,ends,ready from public.pickup_replacements where id=accepted; end if;
  if clock_timestamp()<starts or clock_timestamp()>=ends or ready is null or ready>starts then raise exception 'registration is not eligible for pickup: supplier readiness or accepted window missing' using errcode='55000'; end if;
 end if;
end; $$;
revoke all on function public.assert_order_pickup_ready(uuid) from public,anon,authenticated;
create or replace function public.generate_pickup_code(
  p_registration_id uuid,
  p_ip_address text default null,
  p_user_agent text default null
) returns table (
  qr_code_token text,
  pin_code text
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_umkm_id uuid;
  v_is_supplier boolean;
  v_is_umkm boolean;
begin
  if auth.uid() is null then
    raise exception 'sign in required';
  end if;
  if p_registration_id is null then
    raise exception 'registration id is required';
  end if;

  -- The code may be requested by the UMKM owner OR the owning supplier / admin.
  select r.umkm_id into v_umkm_id
    from public.registrations r
   where r.id = p_registration_id;
  if not found then
    raise exception 'registration not found';
  end if;

  v_is_umkm := (auth.uid() = v_umkm_id);
  v_is_supplier := public.is_supplier()
    and exists (
      select 1
        from public.registrations r
        join public.batches b on b.id = r.batch_id
       where r.id = p_registration_id
         and b.supplier_id = auth.uid()
    );

  if not v_is_umkm and not v_is_supplier and not public.is_admin() then
    raise exception 'only the UMKM owner, owning supplier, or an admin may generate a pickup code';
  end if;

  -- Payment gate: code only when the registration is settled (status = 'paid').
  -- Payment integration itself is out of scope; the paid flag is the gate.
  if not exists (
    select 1 from public.registrations r
     where r.id = p_registration_id
       and r.status = 'paid'
  ) then
    raise exception 'pickup code is only available after payment is settled';
  end if;

  perform public.assert_order_pickup_ready(p_registration_id);
  -- Idempotent: return existing code if present.
  if exists (
    select 1 from public.pickup_codes pc
     where pc.registration_id = p_registration_id
  ) then
    return query
      select pc.qr_code_token, pc.pin_code
        from public.pickup_codes pc
       where pc.registration_id = p_registration_id;
    return;
  end if;

  insert into public.pickup_codes (registration_id, qr_code_token, pin_code)
  values (
    p_registration_id,
    encode(gen_random_bytes(18), 'hex'),
    lpad(floor(random() * 10000)::int::text, 4, '0')
  )
  on conflict (registration_id) do nothing;
  return query select pc.qr_code_token,pc.pin_code from public.pickup_codes pc where pc.registration_id=p_registration_id;
end;
$$;

-- Existing integrations may still call the original cutoff entry point.
-- Preserve legacy behavior but put every v2 caller through the same authority.
alter function public.cut_off_batch(uuid,text,text) rename to cut_off_batch_legacy_v1;
revoke all on function public.cut_off_batch_legacy_v1(uuid,text,text) from public,anon,authenticated;
create function public.cut_off_batch(p_batch_id uuid,p_ip_address text default null,p_user_agent text default null)
returns void language plpgsql security definer set search_path=public as $$
begin
 if (select transaction_policy_version from public.batches where id=p_batch_id)=2 then
  perform public.close_batch_and_issue_invoices(p_batch_id,'registration_expired');
 else
  perform public.cut_off_batch_legacy_v1(p_batch_id,p_ip_address,p_user_agent);
 end if;
end; $$;
revoke all on function public.cut_off_batch(uuid,text,text) from public,anon;
grant execute on function public.cut_off_batch(uuid,text,text) to authenticated,service_role;

-- New browser-created offers must use the atomic v2 publication contract.
-- Service-role imports and already-created legacy offers keep their old rules.
do $$ declare factory regprocedure; begin
 for factory in select oid::regprocedure from pg_proc where pronamespace='public'::regnamespace and proname in ('create_supplier_batch','create_supplier_batch_v2') loop
  execute format('revoke execute on function %s from public,anon,authenticated',factory);
  execute format('grant execute on function %s to service_role',factory);
 end loop;
end; $$;
create function public.guard_direct_offer_creation() returns trigger language plpgsql set search_path=public as $$
begin
 if current_user in ('authenticated','anon') then raise exception 'use atomic offer publication' using errcode='42501'; end if;
 return new;
end; $$;
revoke all on function public.guard_direct_offer_creation() from public,anon,authenticated;
create trigger direct_offer_creation_gate before insert on public.batches for each row execute function public.guard_direct_offer_creation();
