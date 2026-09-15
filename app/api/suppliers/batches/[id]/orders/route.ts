import { NextResponse } from "next/server";
import { requireRole, toAuthResponse, type AuthClient } from "@/lib/supabase/auth";
import { getServerClient } from "@/lib/supabase/server";
import { isUuid } from "@/lib/admin/validation";

export const dynamic = "force-dynamic";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  if (!isUuid(id)) {
    return NextResponse.json({ error: "Invalid batch id" }, { status: 400 });
  }

  const client = await getServerClient();
  try {
    await requireRole(client as unknown as AuthClient, ["supplier", "admin"]);
  } catch (err) {
    return toAuthResponse(err);
  }

  await client.rpc("materialize_supplier_batch", { p_batch_id: id });
  const { data, error } = await client.rpc("list_batch_orders", { p_batch_id: id });
  if (error) {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }

  const url = new URL(req.url);
  const requestedStatus = url.searchParams.get("status");
  const limitRaw = Number(url.searchParams.get("limit") ?? 50);
  const offsetRaw = Number(url.searchParams.get("cursor") ?? 0);
  const limit = Number.isSafeInteger(limitRaw) ? Math.min(50, Math.max(1, limitRaw)) : 50;
  const offset = Number.isSafeInteger(offsetRaw) && offsetRaw >= 0 ? offsetRaw : 0;
  const orders = Array.isArray(data) ? data as Array<Record<string, unknown>> : [];
  const filtered = requestedStatus && requestedStatus !== "all" ? orders.filter((order) => requestedStatus === "picked_up" ? ["picked_up", "completed"].includes(String(order.status)) : requestedStatus === "refund" ? ["refund_pending", "refunded"].includes(String(order.status)) : String(order.status) === requestedStatus) : orders;
  return NextResponse.json({ orders: filtered.slice(offset, offset + limit), counts: { all: orders.length, pending_payment: orders.filter((o) => o.status === "pending_payment").length, paid: orders.filter((o) => o.status === "paid").length, picked_up: orders.filter((o) => ["picked_up", "completed"].includes(String(o.status))).length, refund: orders.filter((o) => ["refund_pending", "refunded"].includes(String(o.status))).length }, nextCursor: offset + limit < filtered.length ? String(offset + limit) : null, serverTime: new Date().toISOString() });
}
