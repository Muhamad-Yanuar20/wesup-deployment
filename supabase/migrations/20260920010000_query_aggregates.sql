-- Aggregate the batch progress fallback in the database.
--
-- GET /api/batches/[id]/progress serves registeredQuantity from Redis. Only when
-- that key is missing does it fall back to Postgres, and the fallback used to
-- pull every registration row for the batch over the wire just to sum one
-- column in JavaScript.
--
-- The status filter below is deliberately identical to the one cut_off_batch
-- already uses when it reconciles the same total, so the two can never disagree
-- about what "registered quantity" means.

create or replace function public.sum_registered_quantity(p_batch_id uuid)
returns bigint
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(sum(r.quantity), 0)::bigint
    from public.registrations r
   where r.batch_id = p_batch_id
     and r.status in ('registered', 'pending_payment');
$$;

revoke execute on function public.sum_registered_quantity(uuid) from public, anon, authenticated;
grant execute on function public.sum_registered_quantity(uuid) to service_role;
