-- Disbursement setup RLS refinement.
-- Requirement: only the account owner can SELECT (and where direct writes are
-- intended, UPDATE) their own bank account rows. All writes continue to flow
-- through SECURITY DEFINER RPCs (upsert_supplier_bank_account,
-- attach_refund_bank_account); the browser never holds INSERT/UPDATE/DELETE
-- policies on the tables themselves.

-- ============================================================
-- umkm_bank_accounts: previously FOR ALL to the owner, which let a UMKM
-- bypass attach_refund_bank_account validation. Narrow to owner SELECT only;
-- writes remain RPC-only. Admin read access is preserved.
-- ============================================================
drop policy if exists "umkm_bank_accounts_own_all" on public.umkm_bank_accounts;

create policy "umkm_bank_accounts_owner_select" on public.umkm_bank_accounts
  for select to authenticated
  using (umkm_id = auth.uid());

-- ============================================================
-- supplier_bank_accounts: SELECT stays owner-or-admin but is now restricted
-- to approved suppliers. Writes already flow through
-- upsert_supplier_bank_account (SECURITY DEFINER), so no UPDATE policy is
-- granted — the browser cannot mutate disbursement setup directly.
-- ============================================================
drop policy if exists "supplier_bank_accounts_supplier_select" on public.supplier_bank_accounts;

create policy "supplier_bank_accounts_supplier_select" on public.supplier_bank_accounts
  for select to authenticated
  using ((supplier_id = auth.uid() and public.is_approved_supplier()) or public.is_admin());