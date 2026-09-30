import { NextResponse } from "next/server";
import { getServerClient } from "@/lib/supabase/server";
import { requireRole, toAuthResponse, type AuthClient } from "@/lib/supabase/auth";
import { isUuid, parseJsonBody } from "@/lib/admin/validation";
import { fromWibInput, validatePickupWindow } from "@/lib/transactions/schedule";
import { transactionError, type TransactionRpcClient } from "@/lib/transactions/api";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const client = await getServerClient();
  try { await requireRole(client as unknown as AuthClient, ["supplier"]); } catch (error) { return toAuthResponse(error); }
  const { id } = await params;
  const body = await parseJsonBody(request);
  if (!isUuid(id) || !body || typeof body.startsAt !== "string" || typeof body.endsAt !== "string" || typeof body.reason !== "string" || !body.reason.trim()) return NextResponse.json({ error: "Isi jadwal baru dan alasan keterlambatan." }, { status: 400 });
  const error = validatePickupWindow(body.startsAt, body.endsAt);
  if (error) return NextResponse.json({ error }, { status: 400 });
  const result = await (client as unknown as TransactionRpcClient).rpc("propose_pickup_replacement", { p_batch_id: id, p_start: fromWibInput(body.startsAt), p_end: fromWibInput(body.endsAt), p_reason: body.reason });
  return result.error ? transactionError(result.error) : NextResponse.json({ replacementId: result.data });
}
