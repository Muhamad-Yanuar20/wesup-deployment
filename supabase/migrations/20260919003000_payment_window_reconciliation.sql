-- Wesup migration: batch-level payment window reconciliation.
--
-- Sweeps a batch once its absolute Payment Window deadline has passed: expires the
-- invoice, cancels the order, records the Hit-and-Run strike, and escalates on the
-- spot. Split out of the escalation migration so the sweep can be reviewed, applied
-- and rolled back independently of the ladder it calls.
-- ============================================================
-- reconcile_batch_payment_window: batch-level auto-suspend script.
-- After the absolute Payment Window deadline passes, sweep every
-- pending_payment registration in the batch, expire the invoice, cancel
-- the order, record the Hit-and-Run strike, and escalate on the spot.
-- ============================================================
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
    select r.id, r.umkm_id
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
         set status = 'cancelled', updated_at = now()
       where id = v_reg.id and status = 'pending_payment';
      if found then
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