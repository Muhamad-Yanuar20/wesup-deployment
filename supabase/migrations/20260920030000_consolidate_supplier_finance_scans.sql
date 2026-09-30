-- Consolidate repeated scans in supplier-side read models.
--
-- get_supplier_finance read public.supplier_ledger_entries four times with the
-- same supplier_id filter to build four different totals. Postgres cannot fold
-- those into one pass, so a supplier opening the finance page paid four
-- sequential index scans. One grouped pass with aggregate FILTER produces the
-- same four numbers.
--
-- Equivalence, in detail, because this is a money path:
--   * escrow / frozen / paidOut were coalesce(sum(amount) [where bucket], 0).
--     sum() over zero rows is NULL, so an empty ledger yielded 0. The FILTER
--     form is also NULL over zero rows, so the coalesce is still required and
--     still yields 0. Same for a supplier whose rows match no bucket.
--   * available was coalesce(sum(case to_bucket ...) - sum(case from_bucket
--     ...), 0). Over zero rows that is coalesce(NULL - NULL, 0) = 0. Computing
--     the two coalesce() terms separately gives 0 - 0 = 0, which is the same
--     value, and it keeps each sum in the same numeric domain as before.
--
-- The account and payout lookups are separate tables and are left alone.
--
-- The signature, grants and returned JSON keys are unchanged.

create or replace function public.get_supplier_finance()
returns jsonb
language plpgsql stable security definer set search_path = public
as $$
declare
  v_supplier_id uuid := auth.uid();
  v_escrow numeric := 0;
  v_frozen numeric := 0;
  v_available numeric := 0;
  v_paid_out numeric := 0;
begin
  if v_supplier_id is null or not public.is_supplier() or not public.is_approved_supplier() then raise exception 'active approved supplier required' using errcode = '42501'; end if;

  -- One pass over the supplier's ledger instead of four.
  select
    coalesce(sum(amount) filter (where to_bucket = 'escrow'), 0),
    coalesce(sum(amount) filter (where to_bucket = 'frozen'), 0),
    coalesce(sum(case when to_bucket = 'available' then amount else 0 end), 0)
      - coalesce(sum(case when from_bucket = 'available' then amount else 0 end), 0),
    coalesce(sum(amount) filter (where to_bucket = 'paid_out'), 0)
  into v_escrow, v_frozen, v_available, v_paid_out
  from public.supplier_ledger_entries
  where supplier_id = v_supplier_id;

  return jsonb_build_object(
    'serverTime', now(),
    'balances', jsonb_build_object(
      'escrow', v_escrow,
      'frozen', v_frozen,
      'available', v_available,
      'paidOut', v_paid_out
    ),
    'accounts', coalesce((select jsonb_agg(to_jsonb(a) order by a.is_primary desc, a.created_at desc) from public.supplier_bank_accounts a where a.supplier_id = v_supplier_id), '[]'::jsonb),
    'payouts', coalesce((select jsonb_agg(to_jsonb(p) order by p.created_at desc) from public.supplier_payouts p where p.supplier_id = v_supplier_id), '[]'::jsonb)
  );
end;
$$;

revoke execute on function public.get_supplier_finance() from public, anon;
grant execute on function public.get_supplier_finance() to authenticated;
