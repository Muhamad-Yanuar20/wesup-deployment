-- Independent manual-opening target; historical offers are deliberately not backfilled.
alter table public.batches add column early_payment_minimum_quantity integer
  check (early_payment_minimum_quantity is null or (capacity_quantity is not null and early_payment_minimum_quantity > 0 and early_payment_minimum_quantity <= capacity_quantity));

create table public.early_payment_proposals (
  id uuid primary key default gen_random_uuid(),
  batch_id uuid not null references public.batches(id) on delete cascade,
  revision integer not null check (revision > 0),
  minimum_quantity integer not null check (minimum_quantity > 0),
  terms jsonb not null,
  created_by uuid not null references public.profiles(id),
  status text not null default 'pending' check (status in ('pending','rejected','cancelled','expired','closed')),
  created_at timestamptz not null default clock_timestamp(),
  unique(batch_id, revision)
);
create unique index early_payment_one_pending on public.early_payment_proposals(batch_id) where status='pending';
create table public.early_payment_decisions (
  proposal_id uuid not null references public.early_payment_proposals(id) on delete cascade,
  registration_id uuid not null references public.registrations(id) on delete cascade,
  decision text not null check (decision in ('accepted','rejected')),
  terms jsonb not null,
  consented_at timestamptz not null default clock_timestamp(),
  primary key(proposal_id,registration_id)
);
alter table public.early_payment_proposals enable row level security;
alter table public.early_payment_decisions enable row level security;
create policy early_proposal_read on public.early_payment_proposals for select to authenticated using (
  exists(select 1 from public.batches b where b.id=batch_id and b.supplier_id=auth.uid())
  or exists(select 1 from public.registrations r where r.batch_id=early_payment_proposals.batch_id and r.umkm_id=auth.uid())
);
create policy early_decision_read on public.early_payment_decisions for select to authenticated using (
  exists(select 1 from public.registrations r where r.id=registration_id and r.umkm_id=auth.uid())
  or exists(select 1 from public.early_payment_proposals p join public.batches b on b.id=p.batch_id where p.id=proposal_id and b.supplier_id=auth.uid())
);
revoke all on public.early_payment_proposals,public.early_payment_decisions from anon,authenticated;
grant select on public.early_payment_proposals,public.early_payment_decisions to authenticated;

create function public.get_early_payment_context(p_batch_id uuid) returns jsonb
language plpgsql security definer set search_path=public as $$
declare b public.batches%rowtype; t public.batch_timeline%rowtype; p public.early_payment_proposals%rowtype;
  participants integer; volume integer; accepted integer; rejected integer; minimum integer; history boolean;
  owner boolean; in_window boolean; can_open boolean; decision text; tier public.batch_tiers%rowtype;
begin
  select * into b from public.batches where id=p_batch_id;
  if not found or not coalesce((b.status='published' or public.is_admin() or b.supplier_id=auth.uid()
    or exists(select 1 from public.registrations r where r.batch_id=b.id and r.umkm_id=auth.uid())),false) then
    raise exception 'batch unavailable' using errcode='42501';
  end if;
  select * into t from public.batch_timeline where batch_id=b.id;
  select * into p from public.early_payment_proposals where batch_id=b.id order by revision desc limit 1;
  if p.status='pending' and (b.status<>'published' or clock_timestamp()>=t.registration_closes_at) then
    p.status:=case when b.status='closed' then 'closed' else 'expired' end;
  end if;
  select count(*)::integer,coalesce(sum(quantity),0)::integer into participants,volume from public.registrations where batch_id=b.id and status='registered';
  select exists(select 1 from public.registrations where batch_id=b.id) into history;
  select count(*) filter(where d.decision='accepted')::integer,count(*) filter(where d.decision='rejected')::integer into accepted,rejected
    from public.early_payment_decisions d join public.registrations r on r.id=d.registration_id
    where d.proposal_id=p.id and r.status='registered' and d.consented_at>=r.consented_at;
  select d.decision into decision from public.early_payment_decisions d join public.registrations r on r.id=d.registration_id
    where d.proposal_id=p.id and r.umkm_id=auth.uid() and d.consented_at>=r.consented_at;
  minimum:=case when p.status in ('pending','rejected') then p.minimum_quantity else b.early_payment_minimum_quantity end;
  owner:=coalesce(b.supplier_id=auth.uid() and public.is_approved_supplier(),false);
  in_window:=b.status='published' and clock_timestamp()>=t.registration_opens_at and clock_timestamp()<t.registration_closes_at;
  can_open:=in_window and participants>0 and minimum is not null and volume>=minimum
    and (case when p.status in ('pending','rejected') then p.status='pending' and accepted=participants and rejected=0
      else b.early_payment_minimum_quantity is not null and not exists(select 1 from public.registrations r where r.batch_id=b.id and r.status='registered'
        and (r.consent_terms->>'earlyPaymentMinimumQuantity')::integer is distinct from b.early_payment_minimum_quantity) end);
  select * into tier from public.batch_tiers where batch_id=b.id and min_volume<=volume and (max_volume is null or volume<=max_volume) order by min_volume desc limit 1;
  if not found then select * into tier from public.batch_tiers where batch_id=b.id and tier_number=1; end if;
  return jsonb_build_object('minimumQuantity',minimum,'originalMinimumQuantity',b.early_payment_minimum_quantity,'registeredQuantity',volume,'participants',participants,'accepted',accepted,'rejected',rejected,
    'hasParticipantHistory',history,'canConfigure',owner and in_window and not history and b.capacity_quantity is not null,
    'canPropose',owner and in_window and history and b.capacity_quantity is not null,'canOpen',owner and can_open,'eligible',can_open,
    'canDecide',in_window and p.status='pending' and decision is null and exists(select 1 from public.registrations r where r.batch_id=b.id and r.umkm_id=auth.uid() and r.status='registered'),
    'reason',case when not in_window then 'Pengumpulan sudah ditutup atau belum dibuka.' when minimum is null then 'Tetapkan target minimum terlebih dahulu.'
      when volume<minimum or participants=0 then 'Target minimum belum tercapai.' when not can_open then 'Menunggu persetujuan seluruh peserta aktif.' else null end,
    'tierNumber',tier.tier_number,'unitPrice',tier.price_per_unit,
    'proposal',case when p.id is null then null else jsonb_build_object('id',p.id,'revision',p.revision,'minimumQuantity',p.minimum_quantity,'status',p.status,'decision',decision) end);
end; $$;

create function public.configure_early_payment(p_batch_id uuid,p_minimum integer,p_request_id uuid) returns jsonb
language plpgsql security definer set search_path=public as $$
declare b public.batches%rowtype; t public.batch_timeline%rowtype; p public.early_payment_proposals%rowtype; volume integer; terms jsonb;
begin
  select * into b from public.batches where id=p_batch_id for update;
  if not found or b.supplier_id<>auth.uid() or not public.is_approved_supplier() then raise exception 'own approved supplier required' using errcode='42501'; end if;
  select * into t from public.batch_timeline where batch_id=b.id;
  if b.status<>'published' or clock_timestamp()<t.registration_opens_at or clock_timestamp()>=t.registration_closes_at then raise exception 'collection unavailable' using errcode='55000'; end if;
  if p_minimum is null or p_minimum<1 or b.capacity_quantity is null or p_minimum>b.capacity_quantity or p_request_id is null then raise exception 'invalid minimum' using errcode='22023'; end if;
  select * into p from public.early_payment_proposals where id=p_request_id;
  if found then
    if p.batch_id<>b.id or p.minimum_quantity<>p_minimum then raise exception 'request changed' using errcode='40001'; end if;
    return public.get_early_payment_context(b.id);
  end if;
  if not exists(select 1 from public.registrations where batch_id=b.id) then
    update public.batches set early_payment_minimum_quantity=p_minimum where id=b.id;
    return public.get_early_payment_context(b.id);
  end if;
  select coalesce(sum(quantity),0) into volume from public.registrations where batch_id=b.id and status='registered';
  if volume<p_minimum then raise exception 'minimum not reached' using errcode='55000'; end if;
  select * into p from public.early_payment_proposals where batch_id=b.id order by revision desc limit 1;
  if p.status='pending' and p.minimum_quantity=p_minimum then return public.get_early_payment_context(b.id); end if;
  update public.early_payment_proposals set status='cancelled' where batch_id=b.id and status in ('pending','rejected');
  terms:=jsonb_build_object('minimumQuantity',p_minimum,'paymentWindowHours',24,'beforeCutoff',t.registration_closes_at,'pickupStartsAt',t.estimated_ready_at,'pickupEndsAt',t.pickup_ends_at);
  insert into public.early_payment_proposals(id,batch_id,revision,minimum_quantity,terms,created_by)
    values(p_request_id,b.id,coalesce(p.revision,0)+1,p_minimum,terms,auth.uid());
  insert into public.notifications(user_id,type,title,message,data)
    select r.umkm_id,'batch_update','Persetujuan pembukaan pembayaran lebih awal',
      'Supplier mengusulkan pembukaan pembayaran setelah target minimum tercapai. Periksa dan pilih keputusan pada pesanan Anda.',
      jsonb_build_object('registration_id',r.id,'batch_id',b.id,'proposal_id',p_request_id)
    from public.registrations r where r.batch_id=b.id and r.status='registered';
  return public.get_early_payment_context(b.id);
end; $$;

create function public.cancel_early_payment_proposal(p_batch_id uuid,p_proposal_id uuid,p_revision integer) returns jsonb
language plpgsql security definer set search_path=public as $$
declare b public.batches%rowtype;
begin
  select * into b from public.batches where id=p_batch_id for update;
  if not found or b.supplier_id<>auth.uid() or not public.is_approved_supplier() then raise exception 'owner required' using errcode='42501'; end if;
  if not exists(select 1 from public.early_payment_proposals where id=p_proposal_id and batch_id=b.id and revision=p_revision) then raise exception 'proposal revision changed' using errcode='55000'; end if;
  update public.early_payment_proposals set status='cancelled' where id=p_proposal_id and batch_id=b.id and revision=p_revision and status in ('pending','rejected');
  return public.get_early_payment_context(b.id);
end; $$;

create function public.decide_early_payment(p_registration_id uuid,p_proposal_id uuid,p_revision integer,p_decision text) returns jsonb
language plpgsql security definer set search_path=public as $$
declare r public.registrations%rowtype; b public.batches%rowtype; p public.early_payment_proposals%rowtype; d public.early_payment_decisions%rowtype; cutoff timestamptz;
begin
  if not exists(select 1 from public.profiles where id=auth.uid() and role='umkm' and status in ('active','suspended_temporary','suspended_permanent')) then raise exception 'UMKM recovery access required' using errcode='42501'; end if;
  select * into r from public.registrations where id=p_registration_id and umkm_id=auth.uid();
  if not found then raise exception 'own order required' using errcode='42501'; end if;
  select * into b from public.batches where id=r.batch_id for update;
  select * into r from public.registrations where id=p_registration_id;
  select * into p from public.early_payment_proposals where id=p_proposal_id and batch_id=b.id and revision=p_revision;
  if not found or p_decision not in ('accepted','rejected') or p_decision is null then raise exception 'invalid decision' using errcode='22023'; end if;
  if p.id is distinct from (select id from public.early_payment_proposals where batch_id=b.id order by revision desc limit 1) then raise exception 'proposal revision changed' using errcode='55000'; end if;
  select * into d from public.early_payment_decisions where proposal_id=p.id and registration_id=r.id;
  if found and d.consented_at>=r.consented_at then
    if d.decision<>p_decision then raise exception 'decision already recorded' using errcode='55000'; end if;
    return public.get_early_payment_context(b.id);
  end if;
  select registration_closes_at into cutoff from public.batch_timeline where batch_id=b.id;
  if b.status<>'published' or r.status<>'registered' or p.status<>'pending' or clock_timestamp()>=cutoff then raise exception 'proposal no longer available' using errcode='55000'; end if;
  insert into public.early_payment_decisions values(p.id,r.id,p_decision,p.terms,clock_timestamp())
    on conflict(proposal_id,registration_id) do update set decision=excluded.decision,terms=excluded.terms,consented_at=excluded.consented_at;
  if p_decision='rejected' then update public.early_payment_proposals set status='rejected' where id=p.id; end if;
  return public.get_early_payment_context(b.id);
end; $$;

create function public.enforce_early_payment_commitment() returns trigger
language plpgsql set search_path=public as $$
begin
  if new.early_payment_minimum_quantity is distinct from old.early_payment_minimum_quantity
    and exists(select 1 from public.registrations where batch_id=old.id) then
    raise exception 'early payment target is locked after first participant' using errcode='55000';
  end if;
  return new;
end; $$;
create trigger early_payment_commitment before update on public.batches for each row execute function public.enforce_early_payment_commitment();

-- Runs for legacy insert and v2 insert/rejoin; decisions cannot be supplied for another order.
create function public.accept_early_payment_on_join() returns trigger
language plpgsql security definer set search_path=public as $$
declare b public.batches%rowtype; p public.early_payment_proposals%rowtype;
begin
  if new.status<>'registered' then return new; end if;
  if tg_op='UPDATE' and old.status='registered' then return new; end if;
  select * into b from public.batches where id=new.batch_id for update;
  if b.early_payment_minimum_quantity is not null and
    (new.consent_terms->>'earlyPaymentMinimumQuantity')::integer is distinct from b.early_payment_minimum_quantity then
    raise exception 'review early payment terms again' using errcode='23514';
  end if;
  select * into p from public.early_payment_proposals where batch_id=b.id and status='pending';
  if p.id is not null then
    if new.consent_terms->>'earlyPaymentProposalId' is distinct from p.id::text or
      (new.consent_terms->>'earlyPaymentProposalRevision')::integer is distinct from p.revision then
      raise exception 'review current early payment proposal again' using errcode='23514';
    end if;
    insert into public.early_payment_decisions values(p.id,new.id,'accepted',p.terms,clock_timestamp())
      on conflict(proposal_id,registration_id) do update set decision='accepted',terms=excluded.terms,consented_at=excluded.consented_at;
  end if;
  return new;
end; $$;
create trigger early_payment_join after insert or update of status on public.registrations for each row execute function public.accept_early_payment_on_join();

-- Acquire the batch lock before a legacy INSERT obtains its FK/registration locks.
-- v2 already takes this lock before writing; PostgreSQL permits reentrant row locks.
create function public.lock_early_payment_registration() returns trigger
language plpgsql security definer set search_path=public as $$
declare b public.batches%rowtype; t public.batch_timeline%rowtype;
begin
  if new.status<>'registered' then return new; end if;
  if tg_op='UPDATE' and old.status='registered' then return new; end if;
  select * into b from public.batches where id=new.batch_id for update;
  select * into t from public.batch_timeline where batch_id=b.id;
  if b.status<>'published' or clock_timestamp()<t.registration_opens_at or clock_timestamp()>=t.registration_closes_at then
    raise exception 'registration closed' using errcode='55000';
  end if;
  return new;
end; $$;
create trigger early_payment_registration_lock before insert or update of status on public.registrations for each row execute function public.lock_early_payment_registration();

revoke all on function public.get_early_payment_context(uuid),public.configure_early_payment(uuid,integer,uuid),public.cancel_early_payment_proposal(uuid,uuid,integer),public.decide_early_payment(uuid,uuid,integer,text) from public,anon;
grant execute on function public.get_early_payment_context(uuid),public.configure_early_payment(uuid,integer,uuid),public.cancel_early_payment_proposal(uuid,uuid,integer),public.decide_early_payment(uuid,uuid,integer,text) to authenticated;

create function public.confirm_early_payment_close(p_batch_id uuid,p_confirmation jsonb,p_ip_address text default null,p_user_agent text default null) returns jsonb
language plpgsql security definer set search_path=public as $$
declare b public.batches%rowtype; context jsonb;
begin
  select * into b from public.batches where id=p_batch_id for update;
  if not found or b.supplier_id<>auth.uid() or not public.is_approved_supplier() then raise exception 'own approved supplier required' using errcode='42501'; end if;
  if b.status='closed' then return public.close_batch_and_issue_invoices(b.id,'supplier_manual',p_ip_address,p_user_agent); end if;
  context:=public.get_early_payment_context(b.id);
  if not coalesce((context->>'canOpen')::boolean,false) then raise exception 'minimum or unanimous consent required' using errcode='55000'; end if;
  if p_confirmation is null or
    (p_confirmation->>'registeredQuantity')::integer is distinct from (context->>'registeredQuantity')::integer or
    (p_confirmation->>'participants')::integer is distinct from (context->>'participants')::integer or
    (p_confirmation->>'tierNumber')::integer is distinct from (context->>'tierNumber')::integer or
    (p_confirmation->>'unitPrice')::numeric is distinct from (context->>'unitPrice')::numeric or
    p_confirmation->>'proposalId' is distinct from context->'proposal'->>'id' or
    (p_confirmation->>'proposalRevision')::integer is distinct from (context->'proposal'->>'revision')::integer then
    raise exception 'confirmation changed; review again' using errcode='40001';
  end if;
  return public.close_batch_and_issue_invoices(b.id,'supplier_manual',p_ip_address,p_user_agent);
end; $$;
revoke all on function public.confirm_early_payment_close(uuid,jsonb,text,text) from public,anon;
grant execute on function public.confirm_early_payment_close(uuid,jsonb,text,text) to authenticated;


CREATE OR REPLACE FUNCTION public.publish_supplier_offer(p_draft_id uuid, p_revision integer, p_photo_url text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $$
declare d public.supplier_offer_drafts%rowtype; p jsonb; s jsonb; tier jsonb; tiers jsonb := '[]';
  batch uuid; opens timestamptz; cutoff timestamptz; ready timestamptz; ends timestamptz; days integer; capacity integer; minimum integer; idx integer:=0;
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
  minimum:=(p->>'earlyPaymentMinimumQuantity')::integer;
  if minimum is null or minimum<1 or minimum>capacity then raise exception 'invalid early payment minimum' using errcode='22023'; end if;
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
    product_photo_url,pickup_name,pickup_address,latitude,longitude,status,transaction_policy_version,payment_opening_policy,early_payment_minimum_quantity)
  values(auth.uid(),trim(p->>'title'),trim(p->>'description'),p->>'category',
    ((tiers->(jsonb_array_length(tiers)-1))->>'min_volume')::integer,capacity,p->>'unit',24,
    p_photo_url,trim(p->>'pickupName'),trim(p->>'pickupAddress'),(p->>'pickupLatitude')::numeric,(p->>'pickupLongitude')::numeric,'published',2,'capacity_or_cutoff',minimum) returning id into batch;
  insert into public.batch_timeline(batch_id,registration_opens_at,registration_closes_at,payment_opens_at,payment_closes_at,estimated_ready_at,pickup_ends_at)
    values(batch,opens,cutoff,cutoff,cutoff+interval '24 hours',ready,ends);
  insert into public.batch_tiers(batch_id,tier_number,min_volume,max_volume,price_per_unit)
    select batch,t.tier_number,t.min_volume,t.max_volume,t.price_per_unit from jsonb_to_recordset(tiers) t(tier_number integer,min_volume integer,max_volume integer,price_per_unit numeric);
  update public.supplier_offer_drafts set published_batch_id=batch,updated_at=now() where id=d.id;
  return batch;
end; $$;

CREATE OR REPLACE FUNCTION public.join_batch_v2(p_batch_id uuid, p_quantity integer, p_terms jsonb, p_consent_lat numeric DEFAULT NULL::numeric, p_consent_lng numeric DEFAULT NULL::numeric)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $$
declare b public.batches%rowtype; t public.batch_timeline%rowtype; r public.registrations%rowtype; total integer;
begin
  if not exists(select 1 from public.profiles where id=auth.uid() and role='umkm' and status='active') then raise exception 'active UMKM required' using errcode='42501'; end if;
  if not exists(select 1 from public.umkm_profiles where user_id=auth.uid() and nullif(trim(business_name),'') is not null and nullif(trim(address),'') is not null and latitude is not null and longitude is not null) then raise exception 'complete profile required' using errcode='22023'; end if;
  select * into b from public.batches where id=p_batch_id for update;
  select * into t from public.batch_timeline where batch_id=b.id;

  if p_quantity is null or p_quantity<=0 or p_terms->>'accepted' is distinct from 'true' then raise exception 'quantity and explicit consent required' using errcode='22023'; end if;
  select * into r from public.registrations where batch_id=b.id and umkm_id=auth.uid() for update;
  if found and not (r.status='cancelled' and r.cancellation_reason='buyer_withdrawal') then
    return public.get_registration_volume_v2(b.id)||jsonb_build_object('registrationId',r.id,'quantity',r.quantity,'idempotent',true);
  end if;
  if b.transaction_policy_version<>2 or b.status<>'published' or clock_timestamp()<t.registration_opens_at or clock_timestamp()>=t.registration_closes_at then raise exception 'registration closed' using errcode='55000'; end if;
  -- Compare the reviewed summary inside the same row lock as the reservation.
  if (b.payment_opening_policy='capacity_or_cutoff' and p_terms->>'paymentOpeningPolicy' is distinct from b.payment_opening_policy)
    or (p_terms->>'maximumUnitPrice')::numeric is distinct from (select price_per_unit from public.batch_tiers where batch_id=b.id and tier_number=1)
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
      jsonb_build_object('earlyPaymentMinimumQuantity',p_terms->'earlyPaymentMinimumQuantity','earlyPaymentProposalId',p_terms->'earlyPaymentProposalId','earlyPaymentProposalRevision',p_terms->'earlyPaymentProposalRevision','accepted',true,'policyVersion',2,'paymentOpeningPolicy',b.payment_opening_policy,'unit',b.unit,'paymentOpensAt',t.payment_opens_at,'paymentClosesAt',t.payment_closes_at,'pickupStartsAt',t.estimated_ready_at,'pickupEndsAt',t.pickup_ends_at,'pickupAddress',b.pickup_address,'maximumUnitPrice',(select price_per_unit from public.batch_tiers where batch_id=b.id and tier_number=1))) returning * into r;
  else
    update public.registrations set quantity=p_quantity,status='registered',cancellation_reason=null,consented_at=clock_timestamp(),consent_latitude=p_consent_lat,consent_longitude=p_consent_lng,
      consent_terms=jsonb_build_object('earlyPaymentMinimumQuantity',p_terms->'earlyPaymentMinimumQuantity','earlyPaymentProposalId',p_terms->'earlyPaymentProposalId','earlyPaymentProposalRevision',p_terms->'earlyPaymentProposalRevision','accepted',true,'policyVersion',2,'paymentOpeningPolicy',b.payment_opening_policy,'unit',b.unit,'paymentOpensAt',t.payment_opens_at,'paymentClosesAt',t.payment_closes_at,'pickupStartsAt',t.estimated_ready_at,'pickupEndsAt',t.pickup_ends_at,'pickupAddress',b.pickup_address,'maximumUnitPrice',(select price_per_unit from public.batch_tiers where batch_id=b.id and tier_number=1)),updated_at=clock_timestamp() where id=r.id returning * into r;
  end if;
  if b.payment_opening_policy='capacity_or_cutoff' and total+p_quantity=b.capacity_quantity then
    perform public.close_batch_and_issue_invoices(b.id,'capacity_reached');
  end if;
  return public.get_registration_volume_v2(b.id)||jsonb_build_object('registrationId',r.id,'orderQuantity',r.quantity,'count',total+p_quantity,'idempotent',false);
end; $$;

CREATE OR REPLACE FUNCTION public.close_batch_and_issue_invoices(p_batch_id uuid, p_trigger text, p_ip_address text DEFAULT NULL::text, p_user_agent text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $$
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
  early jsonb; early_allowed boolean := false;
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

  if p_trigger='supplier_manual' and not (v_is_owner or v_is_admin) then raise exception 'only owning supplier may close batch' using errcode='42501'; end if;
  if not (v_is_owner or v_is_admin or exists(select 1 from public.registrations r where r.batch_id=p_batch_id and r.umkm_id=auth.uid())) then raise exception 'batch unavailable' using errcode='42501'; end if;
  if v_batch.status <> 'published' then
    if v_batch.status = 'closed' then
      return jsonb_build_object('closed',true,'idempotent',true,'batchId',p_batch_id,'closedAt',v_batch.registration_closed_at,'paymentOpensAt',(select effective_payment_opens_at from public.batch_timeline where batch_id=p_batch_id),'paymentClosesAt',(select effective_payment_closes_at from public.batch_timeline where batch_id=p_batch_id));
    end if;
    raise exception 'batch is not open' using errcode = '55000';
  end if;

  select * into v_timeline from public.batch_timeline where batch_id = p_batch_id;
  if not found then raise exception 'batch timeline is missing' using errcode = 'P0002'; end if;

  select coalesce(sum(r.quantity), 0)::integer into v_total
    from public.registrations r
   where r.batch_id = p_batch_id and r.status = 'registered';

  early:=public.get_early_payment_context(p_batch_id);
  early_allowed:=p_trigger='supplier_manual' and coalesce((early->>'eligible')::boolean,false);
  if v_batch.transaction_policy_version = 2 and not early_allowed and p_trigger <> 'registration_expired' and not (p_trigger='capacity_reached' and v_batch.payment_opening_policy='capacity_or_cutoff') then
    raise exception 'payment schedule cannot be advanced' using errcode='55000';
  end if;
  if p_trigger = 'supplier_manual' then
    if not (v_is_owner or v_is_admin) then raise exception 'only owning supplier may close batch' using errcode = '42501'; end if;
    if not early_allowed and (v_batch.early_payment_minimum_quantity is not null or early->'proposal'->>'status' in ('pending','rejected')) then raise exception 'early payment consent or minimum not reached' using errcode='55000'; end if;
    if not early_allowed and v_total < v_batch.min_quantity then raise exception 'minimum quantity has not been reached' using errcode = '55000'; end if;
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

  if v_batch.transaction_policy_version = 2 and not early_allowed then
    if not ((p_trigger='registration_expired' and now()>=v_timeline.registration_closes_at) or (p_trigger='capacity_reached' and v_batch.payment_opening_policy='capacity_or_cutoff' and v_total=v_batch.capacity_quantity)) then
      raise exception 'payment schedule cannot be advanced' using errcode='55000';
    end if;
  end if;
  v_close_at := case when p_trigger = 'registration_expired' then v_timeline.registration_closes_at else clock_timestamp() end;
  v_payment_close := v_close_at + case when v_batch.transaction_policy_version=2 or early_allowed then interval '24 hours' else make_interval(hours => v_batch.payment_window_hours) end;

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

  update public.early_payment_proposals set status=case when p_trigger='registration_expired' then 'expired' else 'closed' end where batch_id=p_batch_id and status in ('pending','rejected');

  insert into public.notifications (user_id, type, title, message, data)
  select r.umkm_id, 'payment_due', 'Tagihan batch sudah terbit',
         format('Tagihan %s sebesar Rp %s tersedia. Bayar sebelum %s WIB. Jadwal pengambilan tetap.', b.title, to_char(r.final_amount, 'FM999G999G999G990'), to_char(v_payment_close at time zone 'Asia/Jakarta','DD Mon YYYY HH24:MI')),
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

CREATE OR REPLACE FUNCTION public.get_offer_context(p_batch_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $$
declare b public.batches%rowtype; t public.batch_timeline%rowtype;
begin
  select * into b from public.batches where id=p_batch_id;
  if not found or not coalesce((b.status='published' or b.supplier_id=auth.uid() or public.is_admin() or exists(select 1 from public.registrations where batch_id=b.id and umkm_id=auth.uid())),false) then return null; end if;
  select * into t from public.batch_timeline where batch_id=b.id;
  return jsonb_build_object('early_payment',public.get_early_payment_context(b.id),'transaction_policy_version',b.transaction_policy_version,'commercial_locked',exists(select 1 from public.registrations where batch_id=b.id),'ready_at',b.ready_at,'capacity_quantity',b.capacity_quantity,'unit',b.unit,
    'payment_opening_policy',b.payment_opening_policy,'registration_closes_at',coalesce(b.registration_closed_at,t.registration_closes_at),'close_reason',b.close_reason,'payment_opens_at',coalesce(t.effective_payment_opens_at,t.payment_opens_at),'payment_closes_at',coalesce(t.effective_payment_closes_at,t.payment_closes_at),'estimated_ready_at',t.estimated_ready_at,'pickup_ends_at',t.pickup_ends_at,
    'replacements',coalesce((select jsonb_agg(to_jsonb(pr) order by revision desc) from public.pickup_replacements pr where batch_id=b.id),'[]'::jsonb),
    'pickup_actions',case when b.supplier_id=auth.uid() or public.is_admin() then coalesce((select jsonb_agg(jsonb_build_object('registration_id',r.id,'can_confirm',r.status='paid' and now()>=case when pr.id is null then t.estimated_ready_at else pr.starts_at end and now()<case when pr.id is null then t.pickup_ends_at else pr.ends_at end and case when pr.id is null then b.ready_at<=t.estimated_ready_at else pr.ready_at<=pr.starts_at end)) from public.registrations r left join public.pickup_replacements pr on pr.id=r.accepted_pickup_revision where r.batch_id=b.id),'[]'::jsonb) else '[]'::jsonb end);
end; $$;

notify pgrst, 'reload schema';
