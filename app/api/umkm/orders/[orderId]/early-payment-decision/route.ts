import { NextResponse } from "next/server";
import { resolveActiveUmkm } from "@/lib/umkm/workspace-auth";
import { isUuid, parseJsonBody } from "@/lib/admin/validation";
import { transactionError, type TransactionRpcClient } from "@/lib/transactions/api";
import { withRegistrationLock } from "@/lib/transactions/registration";

export async function POST(request: Request, { params }: { params: Promise<{ orderId: string }> }) {
  const viewer = await resolveActiveUmkm({ allowSuspended: true });
  if (!viewer.client) return viewer.response;
  const { orderId } = await params;
  const body = await parseJsonBody(request);
  if (!isUuid(orderId) || !body || typeof body.proposalId !== "string" || !isUuid(body.proposalId)
    || !Number.isSafeInteger(body.revision) || Number(body.revision) < 1 || !["accepted", "rejected"].includes(String(body.decision))) {
    return NextResponse.json({ error: "Periksa usulan dan pilih keputusan Anda." }, { status: 400 });
  }
  const query = await (viewer.client.from("registrations") as { select: (columns: string) => { eq: (column: string, value: string) => { eq: (column: string, value: string) => { maybeSingle: () => PromiseLike<{ data: { batch_id: string } | null; error: unknown }> } } } }).select("batch_id").eq("id", orderId).eq("umkm_id", viewer.context.userId).maybeSingle();
  if (query.error) return transactionError(query.error);
  if (!query.data) return NextResponse.json({ error: "Pesanan tidak ditemukan." }, { status: 404 });
  try {
    const item = await withRegistrationLock(query.data.batch_id, async () => {
      const result = await (viewer.client as unknown as TransactionRpcClient).rpc("decide_early_payment", {
        p_registration_id: orderId, p_proposal_id: body.proposalId, p_revision: body.revision, p_decision: body.decision,
      });
      if (result.error) throw result.error;
      return result.data;
    });
    return NextResponse.json({ item });
  } catch (error) { return transactionError(error, "Jumlah, harga, atau usulan berubah. Muat ulang transaksi dan periksa ringkasan terbaru."); }
}
