-- Wesup migration: materializer revisions for the Hit-and-Run ladder.
--
-- Re-emits the two per-registration materializers so both the UMKM and the supplier
-- entry point escalate on missed-payment expiry. Must sort BEFORE
-- 20260920020000_batched_order_materialization.sql, whose materialize_umkm_orders
-- delegates to materialize_umkm_order defined here.
-- ============================================================
-- materialize_umkm_order: re-emitted to (1) drop the No-Show strike
-- increment (No-Show keeps only forfeiture; the Hit-and-Run ladder is
-- strictly for missed payments) and (2) escalate on missed-payment expiry.
-- ============================================================
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
begin
  select * into v_registration from public.registrations where id = p_registration_id for update;
  if not found or (auth.uid() is not null and v_registration.umkm_id <> auth.uid() and not public.is_admin()) then
    raise exception 'order not found';
  end if;
  select * into v_timeline from public.batch_timeline where batch_id = v_registration.batch_id;
  if v_registration.status = 'registered' and now() >= v_timeline.registration_closes_at then
    if v_registration.final_amount is not null then
      insert into public.payments (registration_id, midtrans_order_id, gross_amount)
      values (p_registration_id, 'WESUP-' || replace(p_registration_id::text, '-', ''), v_registration.final_amount)
      on conflict (registration_id) do nothing;
    end if;
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
      update public.registrations set status = 'cancelled', updated_at = now()
        where id = p_registration_id and status = 'pending_payment';
      if found then
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
  select status into v_registration.status from public.registrations where id = p_registration_id;
  return v_registration.status;
end;
$$;

-- ============================================================
-- materialize_supplier_order: re-emitted to escalate on the ownership-
-- gated missed-payment path using the effective absolute deadline.
-- ============================================================
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
  if v_status = 'pending_payment' and v_payment_close is not null and now() >= v_payment_close then
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
