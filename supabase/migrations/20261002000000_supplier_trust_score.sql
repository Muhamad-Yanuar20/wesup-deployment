-- Wesup migration 0011: supplier trust score
-- Covers PRD module: Reputation & Penalty (2.1.6, 2.2.6).
-- Trust score computed on-demand from ratings (Lazy Evaluation).
-- Review bombing protection: 1-star ratings do NOT trigger auto-suspend on Supplier.

-- ============================================================
-- compute_supplier_trust_score: on-demand trust score from ratings
-- Returns NULL if no ratings exist (new supplier).
-- ============================================================
create or replace function public.compute_supplier_trust_score(p_supplier_id uuid)
returns numeric(3, 2)
language sql
stable
security definer
as $$
  select
    case
      when count(*) = 0 then null
      else round(avg(score)::numeric, 2)
    end
  from public.ratings
  where supplier_id = p_supplier_id;
$$;

-- ============================================================
-- get_supplier_trust_breakdown: detailed breakdown for UI
-- Returns score counts, total, average (trust score).
-- ============================================================
create or replace function public.get_supplier_trust_breakdown(p_supplier_id uuid)
returns jsonb
language sql
stable
security definer
as $$
  select
    jsonb_build_object(
      'trustScore', coalesce(round(avg(score)::numeric, 2), 0),
      'totalRatings', count(*),
      'scoreCounts', jsonb_object_agg(score, cnt) filter (where score is not null)
    )
  from (
    select
      score,
      count(*) as cnt
    from public.ratings
    where supplier_id = p_supplier_id
    group by score
  ) s;
$$;

-- ============================================================
-- Review bombing protection: explicit documentation
-- Auto-suspend (Hit and Run) applies ONLY to UMKM (see 20260919000000_hit_and_run_escalation.sql).
-- Supplier trust score is informational; no algorithmic sanction on low score.
-- Admin takedown (manual) is the only enforcement path for problematic Suppliers.
-- ============================================================
comment on function public.compute_supplier_trust_score(uuid) is
  'Returns supplier trust score (avg 1-5 stars). NULL if no ratings. No auto-suspend on low score (review bombing protection per PRD 2.1.6).';

comment on function public.get_supplier_trust_breakdown(uuid) is
  'Returns detailed trust breakdown: trustScore, totalRatings, scoreCounts per star.';

-- Grant execute to service_role for backend API routes
revoke execute on function public.compute_supplier_trust_score(uuid) from public, anon, authenticated;
grant execute on function public.compute_supplier_trust_score(uuid) to service_role;

revoke execute on function public.get_supplier_trust_breakdown(uuid) from public, anon, authenticated;
grant execute on function public.get_supplier_trust_breakdown(uuid) to service_role;