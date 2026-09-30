import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { requireRole, toAuthResponse, type AuthClient } from "@/lib/supabase/auth";
import { getServerClient } from "@/lib/supabase/server";
import { isUuid, parseJsonBody } from "@/lib/admin/validation";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const client = await getServerClient();
  try { await requireRole(client as unknown as AuthClient, ["supplier"]); } catch (error) { return toAuthResponse(error); }
  const body = await parseJsonBody(request);
  if (!body || typeof body.amount !== "number" || !Number.isSafeInteger(body.amount) || body.amount <= 0 || typeof body.bankAccountId !== "string" || !isUuid(body.bankAccountId)) {
    return NextResponse.json({ error: "Nominal atau rekening payout tidak valid.", code: "PAYOUT_INVALID" }, { status: 400 });
  }
  const idempotencyKey = typeof body.idempotencyKey === "string" && body.idempotencyKey.trim() ? body.idempotencyKey.trim() : `payout-${randomUUID()}`;
  const result = await (client as unknown as { rpc: (name: string, args: Record<string, unknown>) => PromiseLike<{ data: unknown; error: unknown }> }).rpc("request_supplier_payout", { p_amount: body.amount, p_bank_account_id: body.bankAccountId, p_idempotency_key: idempotencyKey });
  if (result.error) {
    const code = typeof result.error === "object" && result.error !== null && "code" in result.error ? String((result.error as { code?: unknown }).code ?? "") : "";
    const message = typeof result.error === "object" && result.error !== null && "message" in result.error ? String((result.error as { message?: unknown }).message ?? "") : "";
    if (code === "55000" || /insufficient|primary/i.test(message)) return NextResponse.json({ error: message || "Saldo tersedia tidak mencukupi.", code: /primary/i.test(message) ? "PRIMARY_BANK_ACCOUNT_REQUIRED" : "INSUFFICIENT_AVAILABLE_BALANCE" }, { status: 409 });
    if (code === "42501") return NextResponse.json({ error: "Akses Supplier ditolak.", code: "SUPPLIER_FINANCE_FORBIDDEN" }, { status: 403 });
    return NextResponse.json({ error: "Payout belum dapat diajukan.", code: "PAYOUT_REQUEST_FAILED" }, { status: 500 });
  }
  return NextResponse.json({ ok: true, payoutId: result.data }, { status: 201 });
}
