import { NextResponse } from "next/server";
import { requireRole, toAuthResponse, type AuthClient } from "@/lib/supabase/auth";
import { getServerClient } from "@/lib/supabase/server";
import { isUuid, parseJsonBody } from "@/lib/admin/validation";
import { transactionError, type TransactionRpcClient } from "@/lib/transactions/api";
import { withRegistrationLock } from "@/lib/transactions/registration";
import { enforceRateLimit } from "@/lib/rate-limit";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const client = await getServerClient();
  let user;
  try { user = await requireRole(client as unknown as AuthClient, ["supplier"]); } catch (error) { return toAuthResponse(error); }
  const { id } = await params;
  const body = await parseJsonBody(request);
  if (!isUuid(id) || !body || "supplierId" in body) return NextResponse.json({ error: "Data usulan tidak valid." }, { status: 400 });
  const cancelling = body.action === "cancel";
  if (cancelling ? typeof body.proposalId !== "string" || !isUuid(body.proposalId) || !Number.isSafeInteger(body.revision) || Number(body.revision) < 1
    : typeof body.minimumQuantity !== "number" || !Number.isSafeInteger(body.minimumQuantity) || body.minimumQuantity < 1 || typeof body.requestId !== "string" || !isUuid(body.requestId)) {
    return NextResponse.json({ error: "Isi target minimum yang valid dan periksa usulan terbaru." }, { status: 400 });
  }
  const limited = await enforceRateLimit(request, "registration", user.userId);
  if (limited) return limited;
  try {
    const item = await withRegistrationLock(id, async () => {
      const result = await (client as unknown as TransactionRpcClient).rpc(cancelling ? "cancel_early_payment_proposal" : "configure_early_payment", cancelling
        ? { p_batch_id: id, p_proposal_id: body.proposalId, p_revision: body.revision }
        : { p_batch_id: id, p_minimum: body.minimumQuantity, p_request_id: body.requestId });
      if (result.error) throw result.error;
      return result.data;
    });
    return NextResponse.json({ item, serverTime: new Date().toISOString() });
  } catch (error) { return transactionError(error, "Jumlah, harga, atau usulan berubah. Muat ulang transaksi dan periksa ringkasan terbaru."); }
}
