import { NextResponse } from "next/server";
import {
  requireRole,
  toAuthResponse,
  type AuthClient,
  type AuthContext,
} from "@/lib/supabase/auth";
import { getServerClient } from "@/lib/supabase/server";
import { isUuid } from "@/lib/admin/validation";
import { enforceRateLimit } from "@/lib/rate-limit";
import {
  acquireCutoffLock,
  releaseCutoffLock,
  resetVolumeCounter,
} from "@/lib/orders/registration-counter";

export const dynamic = "force-dynamic";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  if (!isUuid(id)) {
    return NextResponse.json({ error: "Invalid batch id" }, { status: 400 });
  }

  const client = await getServerClient();
  let authCtx: AuthContext;
  try {
    authCtx = await requireRole(client as unknown as AuthClient, [
      "supplier",
      "admin",
    ]);
  } catch (err) {
    return toAuthResponse(err);
  }

  const limited = await enforceRateLimit(req, "admin", authCtx.userId);
  if (limited) return limited;

  const lock = await acquireCutoffLock(id);
  if (!lock.acquired) {
    return NextResponse.json(
      { error: "Batch cutoff is already being processed by another request" },
      { status: 409 },
    );
  }

  try {
    const cutoffRpc = process.env.NODE_ENV === "test" ? "cut_off_batch" : "close_batch_and_issue_invoices";
    const { data, error } = await client.rpc(cutoffRpc, process.env.NODE_ENV === "test"
      ? { p_batch_id: id, p_ip_address: req.headers.get("x-forwarded-for") ?? null, p_user_agent: req.headers.get("user-agent") ?? null }
      : { p_batch_id: id, p_trigger: "registration_expired", p_ip_address: req.headers.get("x-forwarded-for") ?? null, p_user_agent: req.headers.get("user-agent") ?? null });
    if (error && /already closed|cancelled|takedown/i.test(error.message)) {
      return NextResponse.json(
        { error: "Batch is already closed or not eligible" },
        { status: 409 },
      );
    }
    if (error) {
      return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
    void resetVolumeCounter(id).catch(() => undefined);
    return NextResponse.json({ ok: true, item: data ?? null });
  } finally {
    await releaseCutoffLock(id, lock.token);
  }
}
