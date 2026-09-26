-- Read-path indexes for list, count and search endpoints.
--
-- Every index below is additive (`if not exists`, no drops, no renames) and
-- matches a sort/filter that already exists in application or RPC code. Each
-- one was checked against the exact query shape it serves; none of them change
-- query semantics, only the plan the planner can choose.
--
-- Note: these are deliberately plain `create index` (not `concurrently`, and
-- without `include (...)` columns) so the file stays valid inside Supabase's
-- transactional migration runner and inside the pgsql-ast-parser contract test
-- in tests/migrations/schema.test.ts.

-- Marketplace search matches an unanchored, user-supplied pattern
-- ('%' || p_query || '%'), which no btree can serve. pg_trgm turns that into
-- an index scan instead of a sequential scan.
create extension if not exists pg_trgm;

create index if not exists batches_title_trgm_idx
  on public.batches using gin (title gin_trgm_ops);
create index if not exists batches_description_trgm_idx
  on public.batches using gin (description gin_trgm_ops);

-- search_batches filters on status and falls back to created_at ordering
-- whenever no map coordinates are supplied (dist_km is then always null).
create index if not exists batches_status_created_idx
  on public.batches (status, created_at desc);

-- Notification centre lists unread-or-read for one user, newest first, and
-- bulk mark-read only ever touches unread rows.
create index if not exists notifications_user_created_idx
  on public.notifications (user_id, created_at desc);
create index if not exists notifications_user_unread_idx
  on public.notifications (user_id) where read_at is null;

-- Admin audit log orders by created_at with no guaranteed admin_id filter, so
-- the existing (admin_id, created_at) index cannot serve the unfiltered list.
create index if not exists admin_audit_logs_created_idx
  on public.admin_audit_logs (created_at desc);

-- Refund queue is ordered by requested_at and optionally narrowed by status.
create index if not exists refund_requests_requested_idx
  on public.refund_requests (requested_at desc);
create index if not exists refund_requests_status_requested_idx
  on public.refund_requests (status, requested_at desc);

-- Escrow auto-release sweep only ever looks at still-held rows, and only
-- those whose auto_release_at has passed.
create index if not exists escrow_holds_pending_release_idx
  on public.escrow_holds (auto_release_at) where status = 'held';

-- get_supplier_finance reads one supplier's ledger, bank accounts and payouts.
create index if not exists supplier_ledger_entries_supplier_bucket_idx
  on public.supplier_ledger_entries (supplier_id, to_bucket);
create index if not exists supplier_payouts_supplier_created_idx
  on public.supplier_payouts (supplier_id, created_at desc);
create index if not exists supplier_bank_accounts_supplier_primary_idx
  on public.supplier_bank_accounts (supplier_id, is_primary desc, created_at desc);
