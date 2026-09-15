import { NextResponse } from "next/server";
import { requireRole, toAuthResponse, type AuthClient } from "@/lib/supabase/auth";
import { getServerClient } from "@/lib/supabase/server";
import { isUuid, parseJsonBody } from "@/lib/admin/validation";

export const dynamic = "force-dynamic";

export async function PATCH(request: Request, { params }: { params: Promise<{ payoutId: string }> }) {
  const client = await getServerClient();
  try { await requireRole(client as unknown as AuthClient, ["admin"]); } catch (error) { return toAuthResponse(error); }
  const { payoutId } = await params;
  if (!isUuid(payoutId)) return NextResponse.json({ error: "Payout tidak ditemukan.", code: "PAYOUT_NOT_FOUND" }, { status: 404 });
  const body = await parseJsonBody(request);
  if (!body || !["approved", "transferred", "rejected"].includes(String(body.status))) return NextResponse.json({ error: "Status payout tidak valid.", code: "PAYOUT_INVALID" }, { status: 400 });
  const result = await (client as unknown as { rpc: (name: string, args: Record<string, unknown>) => PromiseLike<{ error: unknown }> }).rpc("complete_supplier_payout", { p_payout_id: payoutId, p_status: body.status, p_transfer_proof_url: typeof body.transferProofUrl === "string" ? body.transferProofUrl : null, p_notes: typeof body.notes === "string" ? body.notes : null });
  if (result.error) return NextResponse.json({ error: "Payout belum dapat diperbarui.", code: "PAYOUT_UPDATE_FAILED" }, { status: 409 });
  return NextResponse.json({ ok: true });
}
