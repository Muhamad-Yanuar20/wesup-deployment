import { NextResponse } from "next/server";
import { resolveActiveUmkm } from "@/lib/umkm/workspace-auth";
import { isUuid } from "@/lib/admin/validation";
import { restoreVolumeCounter } from "@/lib/orders/registration-counter";
import { withRegistrationLock } from "@/lib/transactions/registration";
import { transactionError, type TransactionRpcClient } from "@/lib/transactions/api";

export async function POST(_request: Request, { params }: { params: Promise<{ orderId: string }> }) {
  const viewer = await resolveActiveUmkm();
  if (!viewer.client) return viewer.response;
  const { orderId } = await params;
  if (!isUuid(orderId)) return NextResponse.json({ error: "Pesanan tidak ditemukan." }, { status: 404 });
  const client = viewer.client as unknown as TransactionRpcClient;
  const context = await client.rpc("get_registration_context_v2", { p_registration_id: orderId });
  if (context.error) return transactionError(context.error);
  if (!context.data) return NextResponse.json({ error: "Pesanan tidak ditemukan." }, { status: 404 });
  const { batchId } = context.data as { batchId: string };
  try {
    const data = await withRegistrationLock(batchId, async () => {
      const withdrawn = await client.rpc("withdraw_batch_registration", { p_registration_id: orderId });
      if (withdrawn.error) throw withdrawn.error;
      const volume = await client.rpc("get_registration_volume_v2", { p_batch_id: batchId });
      if (!volume.error) await restoreVolumeCounter(batchId, (volume.data as { quantity: number }).quantity).catch(() => undefined);
      return withdrawn.data;
    });
    return NextResponse.json({ item: data, serverTime: new Date().toISOString() });
  } catch (error) { return transactionError(error); }
}
