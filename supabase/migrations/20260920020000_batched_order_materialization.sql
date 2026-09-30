-- Batched lazy lifecycle reconciliation.
--
-- The UMKM order list used to call materialize_supplier_order once per row, so
-- a list of N orders cost N round-trips and re-ran materialize_supplier_batch
-- N times for every batch that appeared in the page. This function does the
-- same work in one call: the batch-level sweep runs once per distinct batch,
-- and each registration is still reconciled individually.
--
-- The per-registration work is delegated to materialize_umkm_order so the
-- lifecycle rules stay defined in exactly one place. Ownership is re-checked
-- there, and its 'order not found' raise is caught below, so passing somebody
-- else's registration id changes nothing for that row.
--
-- Each row is isolated in its own exception block on purpose. The route treats
-- this reconciliation as best-effort (a read must not fail because one stale
-- registration has a malformed provider record), which is what the previous
-- Promise.allSettled fan-out guaranteed.

create or replace function public.materialize_umkm_orders(p_registration_ids uuid[])
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_registration_id uuid;
  v_batch_id uuid;
  v_reconciled integer := 0;
begin
  if auth.uid() is null then
    raise exception 'sign in required' using errcode = '42501';
  end if;

  if p_registration_ids is null or cardinality(p_registration_ids) = 0 then
    return 0;
  end if;

  -- Once per distinct batch rather than once per registration. This mirrors
  -- what materialize_supplier_order did for every row, and is idempotent.
  for v_batch_id in
    select distinct r.batch_id
      from public.registrations r
     where r.id = any(p_registration_ids)
  loop
    begin
      perform public.materialize_supplier_batch(v_batch_id);
    exception when others then
      null;
    end;
  end loop;

  for v_registration_id in
    select unnest(p_registration_ids)
  loop
    begin
      perform public.materialize_umkm_order(v_registration_id);
      v_reconciled := v_reconciled + 1;
    exception when others then
      null;
    end;
  end loop;

  return v_reconciled;
end;
$$;

revoke execute on function public.materialize_umkm_orders(uuid[]) from public, anon;
grant execute on function public.materialize_umkm_orders(uuid[]) to authenticated, service_role;
