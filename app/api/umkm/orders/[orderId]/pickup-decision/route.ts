import { NextResponse } from "next/server";
import { resolveActiveUmkm } from "@/lib/umkm/workspace-auth";
import { isUuid, parseJsonBody } from "@/lib/admin/validation";
import { transactionError, type TransactionRpcClient } from "@/lib/transactions/api";

export async function POST(request: Request, { params }: { params: Promise<{ orderId: string }> }) {
  const viewer = await resolveActiveUmkm();
  if (!viewer.client) return viewer.response;
  const { orderId } = await params;
  const body = await parseJsonBody(request);
  if (!isUuid(orderId) || !body || !["wait", "refund"].includes(String(body.decision)) || (body.decision === "wait" && !isUuid(String(body.replacementId)))) return NextResponse.json({ error: "Pilih jadwal baru atau pengembalian dana." }, { status: 400 });
  const result = await (viewer.client as unknown as TransactionRpcClient).rpc("decide_pickup_replacement", { p_registration_id: orderId, p_replacement_id: body.replacementId ?? null, p_decision: body.decision });
  return result.error ? transactionError(result.error) : NextResponse.json({ ok: true,serverTime:new Date().toISOString() });
}
