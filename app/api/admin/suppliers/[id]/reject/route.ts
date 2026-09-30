import { NextResponse } from "next/server";
import { NextResponse } from "next/server";
import { getAdminClient } from "@/lib/supabase/admin";
import {
  requireRole,
  toAuthResponse,
  type AuthClient,
  type AuthContext,
} from "@/lib/supabase/auth";
import { getServerClient } from "@/lib/supabase/server";
import { enforceRateLimit } from "@/lib/rate-limit";
import { isUuid, parseJsonBody } from "@/lib/admin/validation";

export const dynamic = "force-dynamic";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json().catch(() => ({}));
    const reason = body.reason || "Pendaftaran ditolak oleh admin.";

    const supabase = getAdminClient();

    // Update verification_status dan sertakan catatan penolakan
    const { error: updateError } = await supabase
      .from("supplier_profiles")
      .update({
        verification_status: "rejected",
        verification_notes: reason,
        verified_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("user_id", id);

    if (updateError) {
      console.error("Gagal update supplier_profiles:", updateError);
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, message: "Supplier ditolak." });
  } catch (err: any) {
    console.error("Reject API Error:", err);
    return NextResponse.json(
      { error: err.message || "Gagal memproses penolakan." },
      { status: 500 }
    );
  }
  const { id } = await params;
  if (!isUuid(id)) {
    return NextResponse.json({ error: "Invalid supplier id" }, { status: 400 });
  }

  const body = await parseJsonBody(req);
  if (
    !body ||
    typeof body.reason !== "string" ||
    body.reason.trim().length === 0
  ) {
    return NextResponse.json({ error: "reason is required" }, { status: 400 });
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

  const { error } = await client.rpc("reject_supplier", {
    p_user_id: id,
    p_reason: body.reason.trim(),
    p_ip_address: req.headers.get("x-forwarded-for") ?? null,
    p_user_agent: req.headers.get("user-agent") ?? null,
  });
  if (error) {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}