import type { TransactionRpcClient } from "@/lib/transactions/api";
import { getOfferContext } from "@/lib/transactions/offer-context";
import { NextResponse } from "next/server";
import { requireRole, toAuthResponse, type AuthClient } from "@/lib/supabase/auth";
import { getServerClient } from "@/lib/supabase/server";
import { isUuid } from "@/lib/admin/validation";

export const dynamic = "force-dynamic";

function requestId(): string {
  return globalThis.crypto?.randomUUID?.() ?? `supplier-transactions-${Date.now()}`;
}

function errorDetails(error: unknown): { code?: string } {
  if (!error || typeof error !== "object") return {};
  const value = error as { code?: unknown };
  return {
    code: typeof value.code === "string" ? value.code : undefined,
  };
}

function errorResponse(error: unknown, id: string, fallback = "Transaksi batch belum dapat dimuat.") {
  const details = errorDetails(error);
  const code = details.code ?? "";
  if (["PGRST202", "PGRST205", "42883", "42P01"].includes(code)) {
    return NextResponse.json(
      {
        error: "Skema transaksi Supplier belum siap. Coba lagi setelah deployment database selesai.",
        code: "SUPPLIER_SCHEMA_NOT_READY",
        requestId: id,
      },
      { status: 503, headers: { "retry-after": "30" } },
    );
  }
  if (code === "42702") {
    return NextResponse.json(
      {
        error: "Konfigurasi lifecycle transaksi belum valid. Silakan coba lagi setelah deployment diperbarui.",
        code: "SUPPLIER_LIFECYCLE_RPC_INVALID",
        requestId: id,
      },
      { status: 500 },
    );
  }
  if (code === "P0002" || code === "42501") return NextResponse.json({ error: "Batch tidak ditemukan.", code: "BATCH_NOT_FOUND", requestId: id }, { status: 404 });
  if (code === "55000") return NextResponse.json({ error: "Status batch belum dapat dimaterialisasi.", code: "BATCH_STATE_CONFLICT", requestId: id }, { status: 409 });
  return NextResponse.json({ error: fallback, code: "SUPPLIER_TRANSACTION_READ_FAILED", requestId: id }, { status: 500 });
}

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const requestIdValue = requestId();
  const client = await getServerClient();
  try { await requireRole(client as unknown as AuthClient, ["supplier", "admin"]); } catch (error) { return toAuthResponse(error); }
  const { id: batchId } = await params;
  if (!isUuid(batchId)) return NextResponse.json({ error: "Batch tidak ditemukan.", code: "BATCH_NOT_FOUND", requestId: requestIdValue }, { status: 404 });
  const rpcClient = client as unknown as { rpc: (name: string, args: Record<string, unknown>) => PromiseLike<{ data: unknown; error: unknown }> };
  try {
    const materialized = await rpcClient.rpc("materialize_supplier_batch", { p_batch_id: batchId });
    if (materialized.error) {
      console.error("[supplier-transactions] materialize failed", { requestId: requestIdValue, ...errorDetails(materialized.error) });
      return errorResponse(materialized.error, requestIdValue);
    }
    const snapshot = await rpcClient.rpc("get_supplier_batch_transaction", { p_batch_id: batchId });
    if (snapshot.error) {
      console.error("[supplier-transactions] snapshot failed", { requestId: requestIdValue, ...errorDetails(snapshot.error) });
      return errorResponse(snapshot.error, requestIdValue);
    }
    const item=snapshot.data as {batch:Record<string,unknown>;capabilities:Record<string,boolean>;orders:Array<{status:string;registrationId:string;canConfirmPickup?:boolean}>;readyAt?:string|null;timeline:Record<string,unknown>};
    const context=await getOfferContext(rpcClient as unknown as TransactionRpcClient,batchId);
    if(context?.policyVersion===2&&item?.batch&&item.capabilities) {
      item.batch.transaction_policy_version=2;
      item.timeline={...item.timeline,pickup_ends_at:context.pickupEndsAt};
      const effective=context.replacements[0];
      const ready=effective?effective.ready_at:context.readyAt;
      const paid=item.orders.some(o=>o.status==='paid');
      for(const order of item.orders) order.canConfirmPickup=context.pickupActions?.find(action=>action.registrationId===order.registrationId)?.canConfirm??false;
      item.capabilities.canCloseBatch=false;
      item.capabilities.canEditCommercialFields=!context.commercialLocked&&item.batch.status==='published';
      item.capabilities.canMarkReady=paid&&item.batch.status==='closed'&&!ready;
      item.capabilities.canCancelBatch=['published','closed'].includes(String(item.batch.status));
      item.capabilities.canConfirmPickup=item.orders.some(order=>order.canConfirmPickup);
      item.readyAt=ready;
    }
    return NextResponse.json({ item: {...item,offerContext:context} });
  } catch (error) {
    console.error("[supplier-transactions] request failed", { requestId: requestIdValue, ...errorDetails(error) });
    return errorResponse(error, requestIdValue);
  }
}
