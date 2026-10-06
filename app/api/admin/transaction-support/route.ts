import { NextResponse } from "next/server";
import { getServerClient } from "@/lib/supabase/server";
import { requireRole, toAuthResponse, type AuthClient } from "@/lib/supabase/auth";
import { transactionError, type TransactionRpcClient } from "@/lib/transactions/api";
import { isUuid } from "@/lib/admin/validation";

export async function GET() {
  const client = await getServerClient();
  try { await requireRole(client as unknown as AuthClient, ["admin"]); } catch (error) { return toAuthResponse(error); }
  const { data, error } = await client.from("transaction_support_requests" as never).select("*").eq("status", "pending").order("created_at", { ascending: true }).limit(100);
  if (error) return transactionError(error);
  return NextResponse.json({ items: data, serverTime: new Date().toISOString() });
}
export async function POST(request: Request) {
  const client = await getServerClient();
  try { await requireRole(client as unknown as AuthClient, ["admin"]); } catch (error) { return toAuthResponse(error); }
  try {
    const body = await request.json();
    if (!isUuid(body.id) || typeof body.note !== "string" || body.note.trim().length < 10 || body.note.length > 2000 || typeof body.exemptPayment !== "boolean" || typeof body.restoreAccess !== "boolean") return NextResponse.json({ error: "Lengkapi catatan pemeriksaan dan keputusan Admin." }, { status: 400 });
    const result = await (client as unknown as TransactionRpcClient).rpc("resolve_transaction_support", { p_request_id: body.id, p_note: body.note.trim(), p_exempt_payment: body.exemptPayment, p_restore_access: body.restoreAccess });
    if (result.error) return transactionError(result.error);
    return NextResponse.json({ ok: true, serverTime: new Date().toISOString() });
  } catch (error) { return transactionError(error); }
}
