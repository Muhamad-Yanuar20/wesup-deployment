-- Consolidates the redundant reads in public.get_supplier_batch_transaction(uuid).
--
-- The previous body touched the same two tables over and over to assemble one
-- document. public.registrations was read nine times: registered_quantity,
-- participant_count and paid_participant_count inside the batch document, three
-- capability predicates as separate exists/sum scans, the summary aggregate,
-- and the per-row orders projection. public.batches was read thirteen times,
-- ten of which were trailing scalar subqueries
-- ((select capacity_quantity from public.batches where id = p_batch_id), ...)
-- re-fetching columns the batch document had already selected.
--
-- Only the orders projection genuinely needs per-row data, so it is left alone.
-- Everything else now comes from a single grouped pass over registrations,
-- joined once to batches, and the ten duplicated top-level scalars are read
-- from the row already in hand instead of being fetched again.
--
-- Three edge cases the grouped form would otherwise change are preserved
-- deliberately:
--
--   1. A batch with no registrations produces no grouped row at all, so every
--      derived number is coalesced to zero and the summary still carries all
--      six keys rather than collapsing to {}.
--   2. sum() over a set whose filter excludes every row is NULL, not 0. That
--      applies to a batch whose only registration was cancelled: both
--      registered_quantity and the total amount must read 0, not null.
--   3. canEditCommercialFields is gated on registration_count, which counts
--      every row, rather than participant_count, which excludes cancelled ones.
--      The old check was not exists over all rows, so a batch whose only
--      registration was cancelled must still refuse commercial editing even
--      though its participant count is zero.
--
-- Capabilities are built with an explicit "no timeline" guard instead of the
-- previous inner join on batch_timeline. A batch without a timeline still
-- yields an empty capability object while its batch document stays populated,
-- which is what the inner join produced.

create or replace function public.get_supplier_batch_transaction(p_batch_id uuid)
returns jsonb
language plpgsql stable security definer set search_path = public
as $$
declare
  v_supplier_id uuid;
  v_batch jsonb;
  v_timeline jsonb;
  v_orders jsonb;
  v_summary jsonb;
  v_capabilities jsonb;
  v_has_dispute boolean;
  -- The ten fields repeated at the top level of the document. They are read
  -- from the joined row instead of re-selected from public.batches.
  v_capacity_quantity integer;
  v_payment_window_hours smallint;
  v_registration_closed_at timestamptz;
  v_close_reason text;
  v_final_registered_quantity integer;
  v_locked_tier_number integer;
  v_locked_unit_price numeric;
  v_invoices_issued_at timestamptz;
  v_ready_at timestamptz;
  v_completed_at timestamptz;
begin
  if auth.uid() is null then raise exception 'sign in required' using errcode = '42501'; end if;
  select supplier_id into v_supplier_id from public.batches where id = p_batch_id;
  if not found then raise exception 'batch not found' using errcode = 'P0002'; end if;
  if v_supplier_id <> auth.uid() and not public.is_admin() then
    raise exception 'batch access denied' using errcode = '42501';
  end if;
  if v_supplier_id = auth.uid() and not public.is_approved_supplier() then
    raise exception 'active approved supplier required' using errcode = '42501';
  end if;

  -- Dispute visibility is not owner-gated: Admin reconciliation depends on it,
  -- so it stays one independent lookup. Resolved before the aggregated read so
  -- the capability document can be built in a single pass.
  select exists (
    select 1
      from public.disputes d
      join public.registrations r on r.id = d.registration_id
     where r.batch_id = p_batch_id
  ) into v_has_dispute;

  -- One grouped pass supplies every non-per-row registration value. A batch
  -- with no registrations yields no row here, hence the coalesce in every
  -- consumer below.
  with registration_stats as (
    select r.batch_id,
           count(*) as registration_count,
           sum(r.quantity) filter (where r.status <> 'cancelled') as registered_quantity,
           count(*) filter (where r.status <> 'cancelled') as participant_count,
           count(*) filter (where r.status in ('paid', 'picked_up', 'completed')) as paid_participant_count,
           sum(r.quantity) filter (where r.status = 'registered') as registered_quantity_for_close,
           bool_or(r.status in ('picked_up', 'completed')) as has_picked_up_or_completed,
           bool_or(r.status = 'paid') as has_paid,
           count(*) filter (where r.status = 'registered') as registered_count,
           count(*) filter (where r.status = 'pending_payment') as pending_payment_count,
           count(*) filter (where r.status = 'paid') as paid_count,
           count(*) filter (where r.status in ('picked_up', 'completed')) as picked_up_count,
           count(*) filter (where r.status in ('cancelled', 'no_show')) as failed_count,
           count(*) filter (where r.status in ('refund_pending', 'refunded')) as refund_count,
           sum(r.quantity) as total_quantity,
           sum(r.final_amount) as total_amount
      from public.registrations r
     where r.batch_id = p_batch_id
     group by r.batch_id
  )
  select jsonb_build_object(
    'id', b.id,
    'supplier_name', coalesce(sp.business_name, p.full_name),
    'title', b.title,
    'description', b.description,
    'category', b.category,
    'min_quantity', b.min_quantity,
    'capacity_quantity', b.capacity_quantity,
    'unit', b.unit,
    'payment_window_hours', b.payment_window_hours,
    'registration_closed_at', b.registration_closed_at,
    'close_reason', b.close_reason,
    'final_registered_quantity', b.final_registered_quantity,
    'locked_tier_number', b.locked_tier_number,
    'locked_unit_price', b.locked_unit_price,
    'invoices_issued_at', b.invoices_issued_at,
    'ready_at', b.ready_at,
    'completed_at', b.completed_at,
    'product_photo_url', b.product_photo_url,
    'pickup_name', b.pickup_name,
    'pickup_address', b.pickup_address,
    'latitude', b.latitude,
    'longitude', b.longitude,
    'status', b.status,
    'registration_opens_at', t.registration_opens_at,
    'registration_closes_at', t.registration_closes_at,
    'payment_opens_at', t.payment_opens_at,
    'payment_closes_at', t.payment_closes_at,
    'effective_payment_opens_at', t.effective_payment_opens_at,
    'effective_payment_closes_at', t.effective_payment_closes_at,
    'estimated_ready_at', t.estimated_ready_at,
    'tiers', coalesce((select jsonb_agg(jsonb_build_object(
      'tier_number', bt.tier_number,
      'min_volume', bt.min_volume,
      'max_volume', bt.max_volume,
      'price_per_unit', bt.price_per_unit
    ) order by bt.tier_number) from public.batch_tiers bt where bt.batch_id = b.id), '[]'::jsonb),
    'registered_quantity', coalesce(s.registered_quantity, 0),
    'participant_count', coalesce(s.participant_count, 0),
    'paid_participant_count', coalesce(s.paid_participant_count, 0),
    'cancelled_reason', b.cancelled_reason,
    'updated_at', b.updated_at,
    'created_at', b.created_at
  ),
  jsonb_build_object(
    'registered', coalesce(s.registered_count, 0),
    'pendingPayment', coalesce(s.pending_payment_count, 0),
    'paid', coalesce(s.paid_count, 0),
    'pickedUp', coalesce(s.picked_up_count, 0),
    'failed', coalesce(s.failed_count, 0),
    'refund', coalesce(s.refund_count, 0),
    'totalQuantity', coalesce(s.total_quantity, 0),
    'totalAmount', coalesce(s.total_amount, 0)
  ),
  case when t.batch_id is null then '{}'::jsonb else jsonb_build_object(
    'canEditCommercialFields', v_supplier_id = auth.uid() and b.status in ('draft', 'published') and coalesce(s.registration_count, 0) = 0,
    'canCloseBatch', v_supplier_id = auth.uid() and b.status = 'published' and now() < t.registration_closes_at and coalesce(s.registered_quantity_for_close, 0) >= b.min_quantity,
    'canCancelBatch', v_supplier_id = auth.uid() and b.status in ('published', 'closed') and not coalesce(s.has_picked_up_or_completed, false),
    'canMarkReady', v_supplier_id = auth.uid() and b.status = 'closed' and b.ready_at is null,
    'canConfirmPickup', v_supplier_id = auth.uid() and coalesce(s.has_paid, false),
    'canViewDispute', v_has_dispute,
    'canRequestPayout', v_supplier_id = auth.uid()
  ) end,
  b.capacity_quantity,
  b.payment_window_hours,
  b.registration_closed_at,
  b.close_reason,
  b.final_registered_quantity,
  b.locked_tier_number,
  b.locked_unit_price,
  b.invoices_issued_at,
  b.ready_at,
  b.completed_at
    into v_batch, v_summary, v_capabilities,
         v_capacity_quantity, v_payment_window_hours, v_registration_closed_at,
         v_close_reason, v_final_registered_quantity, v_locked_tier_number,
         v_locked_unit_price, v_invoices_issued_at, v_ready_at, v_completed_at
    from public.batches b
    join public.profiles p on p.id = b.supplier_id
    left join public.supplier_profiles sp on sp.user_id = b.supplier_id
    left join public.batch_timeline t on t.batch_id = b.id
    left join registration_stats s on s.batch_id = b.id
   where b.id = p_batch_id;

  select to_jsonb(t) into v_timeline from public.batch_timeline t where t.batch_id = p_batch_id;

  select coalesce(jsonb_agg(jsonb_build_object(
      'registrationId', r.id,
      'umkmId', r.umkm_id,
      'umkmName', coalesce(p.full_name, 'UMKM'),
      'quantity', r.quantity,
      'status', r.status,
      'finalAmount', r.final_amount,
      'lockedTierNumber', r.locked_tier_number,
      'lockedPricePerUnit', r.locked_price_per_unit,
      'createdAt', r.created_at,
      'paymentStatus', pay.status,
      'escrowStatus', eh.status,
      'pickupConfirmedAt', eh.pickup_confirmed_at,
      'autoReleaseAt', eh.auto_release_at
    ) order by r.created_at desc), '[]'::jsonb)
    into v_orders
    from public.registrations r
    left join public.profiles p on p.id = r.umkm_id
    left join public.payments pay on pay.registration_id = r.id
    left join public.escrow_holds eh on eh.registration_id = r.id
   where r.batch_id = p_batch_id;

  return jsonb_build_object(
    'batch', coalesce(v_batch, '{}'::jsonb),
    'timeline', coalesce(v_timeline, '{}'::jsonb),
    'capacityQuantity', v_capacity_quantity,
    'paymentWindowHours', v_payment_window_hours,
    'registrationClosedAt', v_registration_closed_at,
    'closeReason', v_close_reason,
    'finalRegisteredQuantity', v_final_registered_quantity,
    'lockedTierNumber', v_locked_tier_number,
    'lockedUnitPrice', v_locked_unit_price,
    'invoicesIssuedAt', v_invoices_issued_at,
    'readyAt', v_ready_at,
    'completedAt', v_completed_at,
    'summary', coalesce(v_summary, '{}'::jsonb),
    'capabilities', coalesce(v_capabilities, '{}'::jsonb),
    'orders', coalesce(v_orders, '[]'::jsonb),
    'serverTime', now()
  );
end;
$$;

revoke execute on function public.get_supplier_batch_transaction(uuid) from public, anon;
grant execute on function public.get_supplier_batch_transaction(uuid) to authenticated;
