import { NextResponse } from "next/server";
import { resolveActiveUmkm } from "@/lib/umkm/workspace-auth";
import { buildOrderSummary, toUmkmOrderListItem, type OrderReadRow } from "@/lib/orders/read-model";
import { ORDER_SELECT, readCompatibleOrder } from "@/lib/orders/selects";

export const dynamic = "force-dynamic";

interface OrdersQuery {
  select: (columns: string) => {
    eq: (column: string, value: string) => PromiseLike<{ data: OrderReadRow[] | null; error: unknown | null }>;
  };
}

interface RpcCapableClient {
  rpc?: (fn: string, args: Record<string, unknown>) => PromiseLike<{ error?: unknown | null }>;
}

function errorCode(error: unknown): string {
  if (error && typeof error === "object" && "code" in error) return String((error as Record<string, unknown>).code ?? "UNKNOWN");
  return "UNKNOWN";
}

function responseError(message: string, code: string, status: number, details?: unknown, requestId = crypto.randomUUID()) {
  return NextResponse.json({ error: message, code, ...(details === undefined ? {} : { details }), requestId }, { status });
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
  const viewer = await resolveActiveUmkm({allowSuspended:true});
  if (!viewer.client) return viewer.response;

  const rpcClient = viewer.client as RpcCapableClient;
  const baseQuery = viewer.client.from("registrations") as OrdersQuery;
  const first = await readCompatibleOrder((projection) => baseQuery.select(projection).eq("umkm_id", viewer.context.userId), ORDER_SELECT);
  if (first.error) {
    const requestId = crypto.randomUUID();
    console.error("[umkm-orders] read failed", { operation: "list", code: errorCode(first.error), requestId });
    return responseError("Daftar pesanan belum dapat dimuat. Coba lagi.", "ORDERS_READ_FAILED", 503, undefined, requestId);
  }
  let rows = first.data ?? [];

  // Lazy lifecycle reconciliation is deliberately best-effort. A read should
  // never fail because one stale registration has a malformed provider record.
  // One batched call covers the whole page: the per-order fan-out used to cost
  // a round-trip per order and re-ran the batch sweep once per row.
  if (typeof rpcClient.rpc === "function" && rows.length > 0) {
    await Promise.allSettled([
      rpcClient.rpc("materialize_umkm_orders", { p_registration_ids: rows.map((row) => row.id) }),
    ]);
    const refreshed = await (viewer.client.from("registrations") as OrdersQuery)
      .select(first.projection)
      .eq("umkm_id", viewer.context.userId);
    if (!refreshed.error && refreshed.data) rows = refreshed.data;
  }

  const serverTime = new Date().toISOString();
  const allItems = rows.map((row) => toUmkmOrderListItem(row, serverTime, viewer.context.status === "active"));
  const status = request ? new URL(request.url).searchParams.get("status") : null;
  const group=request?new URL(request.url).searchParams.get("group"):null;
  const filtered = group ? allItems.filter(item=>item.presentation?.group===group) : status && status !== "all"
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
      needs_action:allItems.filter(i=>i.presentation?.group==='needs_action').length,
      ongoing:allItems.filter(i=>i.presentation?.group==='ongoing').length,
      completed:allItems.filter(i=>i.presentation?.group==='completed').length,
      registered: allItems.filter((item) => item.status === "registered").length,
      pending_payment: allItems.filter((item) => item.status === "pending_payment").length,
      paid: allItems.filter((item) => item.status === "paid").length,
      picked_up: allItems.filter((item) => item.status === "picked_up" || item.status === "completed").length,
      cancelled: allItems.filter((item) => item.status === "cancelled").length,
      cancelled_group:allItems.filter(item=>item.presentation?.group==='cancelled').length,
      no_show: allItems.filter((item) => item.status === "no_show").length,
      refund: allItems.filter((item) => item.status === "refund_pending" || item.status === "refunded").length,
    },
    serverTime,
    nextCursor,
  });
}
