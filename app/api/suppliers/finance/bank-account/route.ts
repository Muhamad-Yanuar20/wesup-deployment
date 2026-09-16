import { NextResponse } from "next/server";
import { requireRole, toAuthResponse, type AuthClient } from "@/lib/supabase/auth";
import { getServerClient } from "@/lib/supabase/server";
import { isUuid, parseJsonBody } from "@/lib/admin/validation";

export const dynamic = "force-dynamic";

export async function PUT(request: Request) {
  const client = await getServerClient();
  try { await requireRole(client as unknown as AuthClient, ["supplier"]); } catch (error) { return toAuthResponse(error); }
  const body = await parseJsonBody(request);
  if (!body || "supplierId" in body || typeof body.bankName !== "string" || typeof body.accountNumber !== "string" || typeof body.accountHolderName !== "string") {
    return NextResponse.json({ error: "Data rekening tidak lengkap.", code: "BANK_ACCOUNT_INVALID" }, { status: 400 });
  }
  const accountId = body.id === undefined || body.id === null ? null : typeof body.id === "string" && isUuid(body.id) ? body.id : null;
  if (body.id !== undefined && body.id !== null && !accountId) return NextResponse.json({ error: "ID rekening tidak valid.", code: "BANK_ACCOUNT_INVALID" }, { status: 400 });
  const result = await (client as unknown as { rpc: (name: string, args: Record<string, unknown>) => PromiseLike<{ data: unknown; error: unknown }> }).rpc("upsert_supplier_bank_account", {
    p_bank_account_id: accountId,
    p_bank_name: body.bankName.trim(),
    p_account_number: body.accountNumber.trim(),
    p_account_holder_name: body.accountHolderName.trim(),
    p_is_primary: body.isPrimary === true,
  });
  if (result.error) {
    const code = typeof result.error === "object" && result.error !== null && "code" in result.error ? String((result.error as { code?: unknown }).code ?? "") : "";
    if (code === "42501") return NextResponse.json({ error: "Akses Supplier ditolak.", code: "SUPPLIER_FINANCE_FORBIDDEN" }, { status: 403 });
    if (code === "P0002") return NextResponse.json({ error: "Rekening tidak ditemukan.", code: "BANK_ACCOUNT_NOT_FOUND" }, { status: 404 });
    return NextResponse.json({ error: "Rekening belum dapat disimpan.", code: "BANK_ACCOUNT_SAVE_FAILED" }, { status: 400 });
  }
  return NextResponse.json({ ok: true, id: result.data });
}
