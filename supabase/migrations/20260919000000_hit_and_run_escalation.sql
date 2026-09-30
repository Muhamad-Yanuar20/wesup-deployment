-- Wesup migration: Hit-and-Run auto-suspend — escalation ladder and lazy lift.
-- Covers PRD module 9 (Reputation & Penalty) §2.2.3 and §3.4.
--
-- Design notes (Lazy Evaluation — no cron jobs):
--   * Escalation is applied ON-DEMAND at the exact moment a missed-payment strike is
--     recorded (pending_payment expires at the absolute Payment Window deadline).
--   * The 7-day block is computed RETROSPECTIVELY from the past Payment Window
--     deadline (effective_payment_closes_at / payment_closes_at), never from now().
--     This prevents the script's lazy execution delay from inflating the sanction.
--   * Temporary suspensions are lifted lazily once suspended_until <= now()
--     (lazy_lift_expired_suspension), so a 7-day block never becomes permanent.
--   * The escalation ladder applies ONLY to missed-payment (Hit-and-Run) strikes.
--     No-Show keeps its 100% forfeiture sanction and never increments strike_count.
-- ============================================================
-- apply_hit_and_run_escalation: tiered auto-sanction after a strike
--   strike 1 -> in-app warning (suspension notification type)
--   strike 2 -> suspended_temporary, suspended_until = window_close + 7 days
--   strike 3 -> suspended_permanent (blocks Order/Join Batch via profiles.status)
-- Idempotent: the umkm_profiles row is locked, escalation only fires on threshold
-- crossing (status guards), and notifications are deduped by escalationKey.
-- ============================================================
create or replace function public.apply_hit_and_run_escalation(
  p_umkm_id uuid,
  p_payment_window_closed_at timestamptz,
  p_registration_id uuid default null
) returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_strike_count integer;
  v_batch_title text;
  v_batch_id uuid;
  v_suspension_end timestamptz;
begin
  if p_payment_window_closed_at is null then
    raise exception 'payment window closing timestamp is required';
  end if;

  -- Serialize concurrent strike escalation per UMKM; read the post-increment count.
  select u.strike_count into v_strike_count
    from public.umkm_profiles u
   where u.user_id = p_umkm_id
   for update;
  if not found then
    return;
  end if;

  select b.title, b.id into v_batch_title, v_batch_id
    from public.registrations r
    join public.batches b on b.id = r.batch_id
   where r.id = p_registration_id;

  if v_strike_count >= 3 then
    update public.profiles
       set status = 'suspended_permanent',
           updated_at = now()
     where id = p_umkm_id
       and status in ('active', 'suspended_temporary');
    if found then
      update public.umkm_profiles
         set suspended_until = null,
             updated_at = now()
       where user_id = p_umkm_id;
      insert into public.notifications (user_id, type, title, message, data)
      values (
        p_umkm_id,
        'suspension'::public.notification_type,
        'Akun ditangguhkan permanen',
        'Akun Anda ditangguhkan permanen karena 3 kali pelanggaran melewatkan pembayaran (Hit-and-Run). Hubungi Admin Wesup untuk proses banding.',
        jsonb_build_object(
          'escalationKey', 'hit_and_run_permanent:' || p_registration_id,
          'strikeLevel', 3,
          'registration_id', p_registration_id,
          'batch_id', v_batch_id
        )
      )
      on conflict ((data->>'escalationKey')) where data ? 'escalationKey' do nothing;
    end if;
  elsif v_strike_count = 2 then
    v_suspension_end := p_payment_window_closed_at + interval '7 days';
    update public.profiles
       set status = 'suspended_temporary',
           updated_at = now()
     where id = p_umkm_id
       and status = 'active';
    if found then
      update public.umkm_profiles
         set suspended_until = v_suspension_end,
             updated_at = now()
       where user_id = p_umkm_id
         and coalesce(suspended_until, '-infinity'::timestamptz) < v_suspension_end;
      insert into public.notifications (user_id, type, title, message, data)
      values (
        p_umkm_id,
        'suspension'::public.notification_type,
        'Akun ditangguhkan sementara',
        format(
          'Anda telah 2 kali melewatkan pembayaran (Hit-and-Run). Akun Anda ditangguhkan hingga %s.',
          to_char(v_suspension_end, 'DD Mon YYYY HH24:MI')
        ),
        jsonb_build_object(
          'escalationKey', 'hit_and_run_suspend:' || p_registration_id,
          'strikeLevel', 2,
          'registration_id', p_registration_id,
          'batch_id', v_batch_id,
          'suspendedUntil', v_suspension_end,
          'paymentWindowClosedAt', p_payment_window_closed_at
        )
      )
      on conflict ((data->>'escalationKey')) where data ? 'escalationKey' do nothing;
    end if;
  elsif v_strike_count = 1 then
    insert into public.notifications (user_id, type, title, message, data)
    values (
      p_umkm_id,
      'suspension'::public.notification_type,
      'Peringatan Hit-and-Run',
      coalesce('Anda tercatat melewatkan pembayaran tagihan batch "' || v_batch_title || '". Pelanggaran berikutnya menangguhkan akun Anda selama 7 hari.', 'Anda tercatat melewatkan pembayaran tagihan. Pelanggaran berikutnya menangguhkan akun Anda selama 7 hari.'),
      jsonb_build_object(
        'escalationKey', 'hit_and_run_warning:' || p_registration_id,
        'strikeLevel', 1,
        'registration_id', p_registration_id,
        'batch_id', v_batch_id
      )
    )
    on conflict ((data->>'escalationKey')) where data ? 'escalationKey' do nothing;
  end if;
end;
$$;

-- Dedupe index backing the escalationKey on-conflict target.
create unique index if not exists notifications_hit_and_run_key_idx
  on public.notifications ((data->>'escalationKey'))
  where data ? 'escalationKey';

-- ============================================================
-- lazy_lift_expired_suspension: on-demand reactivation (no cron).
-- Restores profiles.status to active and clears suspended_until once
-- the temporary block window has passed.
-- ============================================================
create or replace function public.lazy_lift_expired_suspension(p_user_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is not null and auth.uid() <> p_user_id and not public.is_admin() then
    raise exception 'not allowed';
  end if;
  update public.umkm_profiles
     set suspended_until = null,
         updated_at = now()
   where user_id = p_user_id
     and suspended_until is not null
     and suspended_until <= now();
  update public.profiles
     set status = 'active',
         updated_at = now()
   where id = p_user_id
     and status = 'suspended_temporary'
     and not exists (
       select 1 from public.umkm_profiles u
        where u.user_id = p_user_id
          and u.suspended_until is not null
          and u.suspended_until > now()
     );
  return found;
end;
$$;

-- ============================================================
-- Grants: escalation is internal (service-role only); lazy-lift and the
-- batch reconciler are invoked by authenticated routes.
-- ============================================================
revoke execute on function public.apply_hit_and_run_escalation(uuid, timestamptz, uuid) from public, anon, authenticated;
grant execute on function public.apply_hit_and_run_escalation(uuid, timestamptz, uuid) to service_role;

revoke execute on function public.lazy_lift_expired_suspension(uuid) from public, anon;
grant execute on function public.lazy_lift_expired_suspension(uuid) to authenticated, service_role;
