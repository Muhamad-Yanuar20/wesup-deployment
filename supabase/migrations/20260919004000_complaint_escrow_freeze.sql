-- Wesup migration: complaint escrow freeze hardening.
--
-- Independent of the Hit-and-Run ladder: freezing an escrow on complaint must also
-- suspend the auto-release timer itself, not just the escrow status, per PRD §3.3
-- "Suspend Escrow".
-- ============================================================
-- Harden submit_order_complaint: freezing an escrow must also suspend
-- the auto-release timer itself (auto_release_at = null), not just the
-- escrow status, per PRD §3.3 "Suspend Escrow".
-- ============================================================
create or replace function public.submit_order_complaint(
  p_registration_id uuid,
  p_complaint_category text,
  p_description text,
  p_photo_urls text[]
) returns uuid
language plpgsql security definer set search_path = public
as $$
declare v_dispute_id uuid; v_pickup_confirmed_at timestamptz;
begin
  if auth.uid() is null then raise exception 'sign in required'; end if;
  if p_complaint_category not in ('cacat', 'busuk') then raise exception 'invalid complaint category'; end if;
  select e.pickup_confirmed_at into v_pickup_confirmed_at
    from public.escrow_holds e where e.registration_id = p_registration_id;
  if v_pickup_confirmed_at is null or now() > v_pickup_confirmed_at + interval '24 hours'
     or not exists (select 1 from public.registrations where id = p_registration_id and umkm_id = auth.uid() and status in ('picked_up', 'completed')) then
    raise exception 'complaint window is closed';
  end if;
  if coalesce(array_length(p_photo_urls, 1), 0) < 1 then raise exception 'at least one photo is required'; end if;
  insert into public.disputes (registration_id, umkm_id, supplier_id, complaint_category, description, photo_urls)
    select r.id, r.umkm_id, b.supplier_id, p_complaint_category, coalesce(p_description, ''), to_jsonb(p_photo_urls)
      from public.registrations r join public.batches b on b.id = r.batch_id
     where r.id = p_registration_id
    on conflict (registration_id) do nothing
    returning id into v_dispute_id;
  if v_dispute_id is null then select id into v_dispute_id from public.disputes where registration_id = p_registration_id; end if;
  update public.escrow_holds
     set status = 'frozen', dispute_id = v_dispute_id, auto_release_at = null
   where registration_id = p_registration_id and status in ('held', 'frozen');
  return v_dispute_id;
end;
$$;
