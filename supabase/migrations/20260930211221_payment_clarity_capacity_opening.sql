-- Existing promises remain unchanged. Only new publications opt in.
alter table public.batches add column payment_opening_policy text not null default 'fixed_cutoff' check(payment_opening_policy in ('fixed_cutoff','capacity_or_cutoff'));
alter table public.payment_attempts add column provider_checked_at timestamptz;

create or replace function public.get_registration_volume_v2(p_batch_id uuid) returns jsonb
language plpgsql stable security definer set search_path=public as $$
declare b public.batches%rowtype; t public.batch_timeline%rowtype; r public.registrations%rowtype; total integer; closed boolean;
begin
 if auth.uid() is null then raise exception 'sign in required' using errcode='42501'; end if;
 select * into b from public.batches where id=p_batch_id;
 if not found or not (b.status='published' or b.supplier_id=auth.uid() or exists(select 1 from public.registrations rx where rx.batch_id=b.id and rx.umkm_id=auth.uid())) then raise exception 'batch unavailable' using errcode='42501'; end if;
 select * into t from public.batch_timeline where batch_id=b.id;
 select * into r from public.registrations where batch_id=b.id and umkm_id=auth.uid();
 closed:=b.status<>'published';
 if closed then total:=coalesce(b.final_registered_quantity,0); else select coalesce(sum(quantity),0) into total from public.registrations where batch_id=b.id and status='registered'; end if;
 return jsonb_build_object('quantity',total,'registered',r.id is not null and r.status in ('registered','pending_payment','paid','picked_up','completed','refund_pending','refunded'),
  'registrationId',r.id,'batchClosed',closed,'phase',case when r.status='pending_payment' then 'payment_open' when r.status='paid' then 'paid_waiting_ready' when r.status='cancelled' then 'cancelled' else 'waiting_payment_window' end,
  'deadlineAt',case when closed then coalesce(t.effective_payment_closes_at,t.payment_closes_at) else t.registration_closes_at end,
  'capabilities',jsonb_build_object('canWithdraw',not closed and r.status='registered' and clock_timestamp()<t.registration_closes_at,'canPay',r.status='pending_payment' and clock_timestamp()>=coalesce(t.effective_payment_opens_at,t.payment_opens_at) and clock_timestamp()<coalesce(t.effective_payment_closes_at,t.payment_closes_at)),
  'blockedReason',case when closed then null else 'Pembayaran dibuka ketika kapasitas penuh atau batas ikut tiba.' end);
end; $$;

CREATE OR REPLACE FUNCTION public.publish_supplier_offer(p_draft_id uuid, p_revision integer, p_photo_url text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $$
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
    product_photo_url,pickup_name,pickup_address,latitude,longitude,status,transaction_policy_version,payment_opening_policy)
  values(auth.uid(),trim(p->>'title'),trim(p->>'description'),p->>'category',
    ((tiers->(jsonb_array_length(tiers)-1))->>'min_volume')::integer,capacity,p->>'unit',24,
    p_photo_url,trim(p->>'pickupName'),trim(p->>'pickupAddress'),(p->>'pickupLatitude')::numeric,(p->>'pickupLongitude')::numeric,'published',2,'capacity_or_cutoff') returning id into batch;
  insert into public.batch_timeline(batch_id,registration_opens_at,registration_closes_at,payment_opens_at,payment_closes_at,estimated_ready_at,pickup_ends_at)
    values(batch,opens,cutoff,cutoff,cutoff+interval '24 hours',ready,ends);
  insert into public.batch_tiers(batch_id,tier_number,min_volume,max_volume,price_per_unit)
    select batch,t.tier_number,t.min_volume,t.max_volume,t.price_per_unit from jsonb_to_recordset(tiers) t(tier_number integer,min_volume integer,max_volume integer,price_per_unit numeric);
  update public.supplier_offer_drafts set published_batch_id=batch,updated_at=now() where id=d.id;
  return batch;
end; $$;


CREATE OR REPLACE FUNCTION public.enforce_offer_commitments()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $$
begin
 if new.payment_opening_policy is distinct from old.payment_opening_policy then raise exception 'payment opening policy is immutable' using errcode='55000'; end if;
 if old.transaction_policy_version=2 then
  if new.transaction_policy_version<>old.transaction_policy_version then raise exception 'transaction policy is immutable' using errcode='55000'; end if;
  if exists(select 1 from public.registrations where batch_id=old.id) and
    (new.min_quantity,new.capacity_quantity,new.unit,new.payment_window_hours,new.pickup_name,new.pickup_address,new.latitude,new.longitude) is distinct from
    (old.min_quantity,old.capacity_quantity,old.unit,old.payment_window_hours,old.pickup_name,old.pickup_address,old.latitude,old.longitude) then raise exception 'commercial promises are locked after first participant' using errcode='55000'; end if;
 end if;
 return new;
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

  if v_batch.transaction_policy_version = 2 and p_trigger <> 'registration_expired' and not (p_trigger='capacity_reached' and v_batch.payment_opening_policy='capacity_or_cutoff') then
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
    if not ((p_trigger='registration_expired' and now()>=v_timeline.registration_closes_at) or (p_trigger='capacity_reached' and v_batch.payment_opening_policy='capacity_or_cutoff' and v_total=v_batch.capacity_quantity)) then
      raise exception 'payment schedule cannot be advanced' using errcode='55000';
    end if;
  end if;
  v_close_at := case when p_trigger = 'registration_expired' then v_timeline.registration_closes_at else clock_timestamp() end;
  v_payment_close := v_close_at + case when v_batch.transaction_policy_version=2 then interval '24 hours' else make_interval(hours => v_batch.payment_window_hours) end;

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
      jsonb_build_object('accepted',true,'policyVersion',2,'paymentOpeningPolicy',b.payment_opening_policy,'unit',b.unit,'paymentOpensAt',t.payment_opens_at,'paymentClosesAt',t.payment_closes_at,'pickupStartsAt',t.estimated_ready_at,'pickupEndsAt',t.pickup_ends_at,'pickupAddress',b.pickup_address,'maximumUnitPrice',(select price_per_unit from public.batch_tiers where batch_id=b.id and tier_number=1))) returning * into r;
  else
    update public.registrations set quantity=p_quantity,status='registered',cancellation_reason=null,consented_at=clock_timestamp(),consent_latitude=p_consent_lat,consent_longitude=p_consent_lng,
      consent_terms=jsonb_build_object('accepted',true,'policyVersion',2,'paymentOpeningPolicy',b.payment_opening_policy,'unit',b.unit,'paymentOpensAt',t.payment_opens_at,'paymentClosesAt',t.payment_closes_at,'pickupStartsAt',t.estimated_ready_at,'pickupEndsAt',t.pickup_ends_at,'pickupAddress',b.pickup_address,'maximumUnitPrice',(select price_per_unit from public.batch_tiers where batch_id=b.id and tier_number=1)),updated_at=clock_timestamp() where id=r.id returning * into r;
  end if;
  if b.payment_opening_policy='capacity_or_cutoff' and total+p_quantity=b.capacity_quantity then
    perform public.close_batch_and_issue_invoices(b.id,'capacity_reached');
  end if;
  return public.get_registration_volume_v2(b.id)||jsonb_build_object('registrationId',r.id,'orderQuantity',r.quantity,'count',total+p_quantity,'idempotent',false);
end; $$;


CREATE OR REPLACE FUNCTION public.materialize_supplier_batch(p_batch_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $$
declare b public.batches%rowtype; t public.batch_timeline%rowtype; total integer; r record;
begin
  if auth.uid() is null then raise exception 'sign in required' using errcode='42501'; end if;
  select * into b from public.batches where id=p_batch_id for update;
  if not found then raise exception 'batch not found' using errcode='P0002'; end if;
  select * into t from public.batch_timeline where batch_id=b.id;
  if b.status='published' then
    select coalesce(sum(quantity),0) into total from public.registrations where batch_id=b.id and status='registered';
    if (b.transaction_policy_version=1 or b.payment_opening_policy='capacity_or_cutoff') and b.capacity_quantity is not null and total>=b.capacity_quantity then
      return public.close_batch_and_issue_invoices(b.id,'capacity_reached');
    elsif now()>=t.registration_closes_at then
      perform public.close_batch_and_issue_invoices(b.id,'registration_expired');
    end if;
  end if;
  if b.transaction_policy_version=2 then
    for r in select id from public.registrations where batch_id=b.id and (umkm_id=auth.uid() or b.supplier_id=auth.uid() or public.is_admin()) loop
      perform public.materialize_umkm_order(r.id);
    end loop;
    select * into t from public.batch_timeline where batch_id=b.id;
    if (clock_timestamp()>=coalesce(t.effective_payment_closes_at,t.payment_closes_at) or (clock_timestamp()>=t.registration_closes_at and not exists(select 1 from public.registrations where batch_id=b.id and status<>'cancelled'))) and not exists(select 1 from public.registrations where batch_id=b.id and status in ('registered','pending_payment','paid','picked_up','refund_pending')) then
      update public.batches set status='completed',close_reason=case when not exists(select 1 from public.registrations where batch_id=b.id and status<>'cancelled') then 'no_participants' else 'no_payments_or_fulfilled' end,completed_at=coalesce(completed_at,now()),updated_at=now() where id=b.id and status='closed';
    end if;
  end if;
  return jsonb_build_object('closed',(select status<>'published' from public.batches where id=b.id),'idempotent',true,'batchId',b.id);
end; $$;


CREATE OR REPLACE FUNCTION public.get_offer_context(p_batch_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $$
declare b public.batches%rowtype; t public.batch_timeline%rowtype;
begin
  select * into b from public.batches where id=p_batch_id;
  if not found or not (b.status='published' or b.supplier_id=auth.uid() or public.is_admin() or exists(select 1 from public.registrations where batch_id=b.id and umkm_id=auth.uid())) then return null; end if;
  select * into t from public.batch_timeline where batch_id=b.id;
  return jsonb_build_object('transaction_policy_version',b.transaction_policy_version,'commercial_locked',exists(select 1 from public.registrations where batch_id=b.id),'ready_at',b.ready_at,'capacity_quantity',b.capacity_quantity,'unit',b.unit,
    'payment_opening_policy',b.payment_opening_policy,'registration_closes_at',coalesce(b.registration_closed_at,t.registration_closes_at),'close_reason',b.close_reason,'payment_opens_at',coalesce(t.effective_payment_opens_at,t.payment_opens_at),'payment_closes_at',coalesce(t.effective_payment_closes_at,t.payment_closes_at),'estimated_ready_at',t.estimated_ready_at,'pickup_ends_at',t.pickup_ends_at,
    'replacements',coalesce((select jsonb_agg(to_jsonb(pr) order by revision desc) from public.pickup_replacements pr where batch_id=b.id),'[]'::jsonb),
    'pickup_actions',case when b.supplier_id=auth.uid() or public.is_admin() then coalesce((select jsonb_agg(jsonb_build_object('registration_id',r.id,'can_confirm',r.status='paid' and now()>=case when pr.id is null then t.estimated_ready_at else pr.starts_at end and now()<case when pr.id is null then t.pickup_ends_at else pr.ends_at end and case when pr.id is null then b.ready_at<=t.estimated_ready_at else pr.ready_at<=pr.starts_at end)) from public.registrations r left join public.pickup_replacements pr on pr.id=r.accepted_pickup_revision where r.batch_id=b.id),'[]'::jsonb) else '[]'::jsonb end);
end; $$;

-- Replaced functions keep their existing ownership checks and ACLs.
revoke all on function public.get_registration_volume_v2(uuid) from public,anon;
grant execute on function public.get_registration_volume_v2(uuid) to authenticated;
notify pgrst, 'reload schema';
