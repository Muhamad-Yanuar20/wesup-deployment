-- Fix supplier transaction lazy materialization.
-- The previous close RPC used an unqualified "status" inside an
-- INSERT ... ON CONFLICT expression. PostgreSQL resolves that reference
-- ambiguously between the target row and EXCLUDED, raising 42702 before a
-- cutoff batch can be materialized.

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

revoke execute on function public.close_batch_and_issue_invoices(uuid, text, text, text) from public, anon;
grant execute on function public.close_batch_and_issue_invoices(uuid, text, text, text) to authenticated, service_role;
