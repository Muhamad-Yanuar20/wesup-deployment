import { NextResponse } from "next/server";
import {
  requireRole,
  toAuthResponse,
  type AuthClient,
  type AuthContext,
} from "@/lib/supabase/auth";
import { getServerClient } from "@/lib/supabase/server";
import { enforceRateLimit } from "@/lib/rate-limit";
import { parsePositiveInt } from "@/lib/admin/validation";

export const dynamic = "force-dynamic";

const REFUND_STATUSES = [
  "pending",
  "waiting_bank_account",
  "processing",
  "completed",
  "failed",
] as const;

interface RefundsQuery {
  eq: (column: string, value: string) => RefundsQuery;
  order: (
    column: string,
    options?: { ascending?: boolean },
  ) => {
    range: (from: number, to: number) => PromiseLike<{
      data: unknown[] | null;
      error: Error | { message: string } | null;
    }>;
  };
}

export async function GET(req: Request) {
  const url = new URL(req.url);

  const limitParam = url.searchParams.get("limit");
  const offsetParam = url.searchParams.get("offset");
  const limit = limitParam === null ? 50 : parsePositiveInt(limitParam);
  const offset = offsetParam === null ? 0 : parsePositiveInt(offsetParam);
  if (limit === null || offset === null || limit < 1 || limit > 100) {
    return NextResponse.json(
      { error: "limit must be an integer between 1 and 100" },
      { status: 400 },
    );
  }
  if (offset < 0) {
    return NextResponse.json(
      { error: "offset must be a non-negative integer" },
      { status: 400 },
    );
  }

  const status = url.searchParams.get("status");
  if (status !== null && !(REFUND_STATUSES as readonly string[]).includes(status)) {
    return NextResponse.json({ error: "invalid status" }, { status: 400 });
  }

  const client = await getServerClient();
  let authCtx: AuthContext;
  try {
    authCtx = await requireRole(client as unknown as AuthClient, ["admin"]);
  } catch (err) {
    return toAuthResponse(err);
  }

  const limited = await enforceRateLimit(req, "admin", authCtx.userId);
  if (limited) return limited;

  let query = client
    .from("refund_requests")
    .select(
      "*, registration:registrations(id,status,quantity,cancellation_reason,batch:batches(id,title,category),umkm:profiles(full_name,email))",
    ) as unknown as RefundsQuery;
  if (status) {
    query = query.eq("status", status);
  }

  const { data, error } = await query
    .order("requested_at", { ascending: false })
    .range(offset, offset + limit - 1);
  if (error && typeof error === "object" && "message" in error) {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }

  if (url.searchParams.get("format") !== "queue") return NextResponse.json({ refunds: data ?? [] });
  const record = (value: unknown): Record<string, unknown> => value !== null && typeof value === "object" ? value as Record<string, unknown> : {};
  const refunds = (data ?? []).map((value) => {
    const item = record(value);
    const registration = record(item.registration);
    const umkm = record(registration.umkm);
    const batch = record(registration.batch);
    return ({
    id: item.id,
    umkmName: umkm.full_name || "UMKM",
    email: umkm.email || "—",
    batchTitle: batch.title || "Penawaran",
    amount: item.amount,
    reason: registration.cancellation_reason || item.trigger_type || "Pengembalian dana",
    status: item.status,
    createdAt: item.requested_at,
  }); });

  return NextResponse.json(refunds);
}
