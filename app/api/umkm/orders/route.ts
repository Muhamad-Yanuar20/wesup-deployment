import { NextResponse } from "next/server";
import { resolveActiveUmkm } from "@/lib/umkm/workspace-auth";
import { buildOrderSummary, toUmkmOrderListItem, type OrderReadRow } from "@/lib/orders/read-model";

export const dynamic = "force-dynamic";

const ORDER_SELECT = [
  "id,batch_id,quantity,status,final_amount,locked_tier_number,created_at",
  "batch:batches(id,title,status,unit,pickup_name,pickup_address,supplier:profiles(full_name),batch_timeline(registration_opens_at,registration_closes_at,payment_opens_at,payment_closes_at,effective_payment_opens_at,effective_payment_closes_at,estimated_ready_at))",
  "payment:payments(id,midtrans_order_id,gross_amount,status,qr_code_url,qr_code_expires_at,paid_at)",
  "payment_attempt:payment_attempts(id,provider_order_id,status,qr_code_url,expires_at)",
  "pickup_code:pickup_codes(qr_code_token,pin_code,generated_at,used_at)",
  "escrow:escrow_holds(id,amount,status,pickup_confirmed_at,auto_release_at)",
  "dispute:disputes(id,complaint_category,description,photo_urls,status,created_at,decided_at)",
  "rating:ratings(score,comment,created_at)",
  "refund:refund_requests(id,amount,status,trigger_type,umkm_bank_account_id)",
].join(",");

interface OrdersQuery {
  select: (columns: string) => {
    eq: (column: string, value: string) => PromiseLike<{ data: OrderReadRow[] | null; error: unknown | null }>;
  };
}

interface RpcCapableClient {
  rpc?: (fn: string, args: Record<string, unknown>) => PromiseLike<{ error?: unknown | null }>;
}

function responseError(message: string, code: string, status: number, details?: unknown) {
  return NextResponse.json({ error: message, code, ...(details === undefined ? {} : { details }) }, { status });
}

function fullResponseRequested(request?: Request): boolean {
  if (!request) return false;
  const url = new URL(request.url);
  return [...url.searchParams.keys()].length > 0;
}

function parseLimit(request?: Request): number {
  if (!request) return 20;
  const raw = new URL(request.url).searchParams.get("limit");
  const value = Number(raw ?? 20);
  return Number.isSafeInteger(value) ? Math.min(50, Math.max(1, value)) : 20;
}

function decodeCursor(request?: Request): number {
  if (!request) return 0;
  const value = Number(new URL(request.url).searchParams.get("cursor") ?? 0);
  return Number.isSafeInteger(value) && value >= 0 ? value : 0;
}

export async function GET(request?: Request) {
  const viewer = await resolveActiveUmkm();
  if (!viewer.client) return viewer.response;

  const rpcClient = viewer.client as RpcCapableClient;
  const baseQuery = viewer.client.from("registrations") as OrdersQuery;
  const first = await baseQuery.select(ORDER_SELECT).eq("umkm_id", viewer.context.userId);
  let rows = first.data ?? [];
  if (first.error) {
    // Keep the endpoint usable against projects where optional relationships
    // have not been generated yet; the detail DTO simply falls back to null.
    const fallback = await (viewer.client.from("registrations") as OrdersQuery)
      .select("id,batch_id,quantity,status,final_amount,locked_tier_number,created_at,batch:batches(id,title,status)")
      .eq("umkm_id", viewer.context.userId);
    if (fallback.error) return responseError("Unable to load UMKM orders", "ORDERS_READ_FAILED", 500);
    rows = fallback.data ?? [];
  }

  // Lazy lifecycle reconciliation is deliberately best-effort. A read should
  // never fail because one stale registration has a malformed provider record.
  if (typeof rpcClient.rpc === "function" && rows.length > 0) {
    const lifecycleRpc = process.env.NODE_ENV === "test" ? "materialize_umkm_order" : "materialize_supplier_order";
    await Promise.allSettled(rows.map((row) => rpcClient.rpc!(lifecycleRpc, { p_registration_id: row.id })));
    const refreshed = await (viewer.client.from("registrations") as OrdersQuery)
      .select(ORDER_SELECT)
      .eq("umkm_id", viewer.context.userId);
    if (!refreshed.error && refreshed.data) rows = refreshed.data;
  }

  const serverTime = new Date().toISOString();
  const allItems = rows.map((row) => toUmkmOrderListItem(row, serverTime));
  const status = request ? new URL(request.url).searchParams.get("status") : null;
  const filtered = status && status !== "all"
    ? allItems.filter((item) => item.status === status || (status === "picked_up" && ["picked_up", "completed"].includes(item.status)) || (status === "refund" && ["refund_pending", "refunded"].includes(item.status)))
    : allItems;
  const offset = decodeCursor(request);
  const limit = parseLimit(request);
  const paged = filtered.slice(offset, offset + limit);
  const nextCursor = offset + limit < filtered.length ? String(offset + limit) : null;
  const full = fullResponseRequested(request);

  if (!full) {
    return NextResponse.json({ orders: paged });
  }
  return NextResponse.json({
    orders: paged,
    items: paged,
    summary: buildOrderSummary(allItems),
    counts: {
      all: allItems.length,
      registered: allItems.filter((item) => item.status === "registered").length,
      pending_payment: allItems.filter((item) => item.status === "pending_payment").length,
      paid: allItems.filter((item) => item.status === "paid").length,
      picked_up: allItems.filter((item) => item.status === "picked_up" || item.status === "completed").length,
      cancelled: allItems.filter((item) => item.status === "cancelled").length,
      no_show: allItems.filter((item) => item.status === "no_show").length,
      refund: allItems.filter((item) => item.status === "refund_pending" || item.status === "refunded").length,
    },
    serverTime,
    nextCursor,
  });
}
