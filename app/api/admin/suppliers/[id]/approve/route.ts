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
import { isUuid } from "@/lib/admin/validation";

export const dynamic = "force-dynamic";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  if (!isUuid(id)) {
    return NextResponse.json({ error: "Invalid supplier id" }, { status: 400 });
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

  const { error } = await client.rpc("approve_supplier", {
    p_user_id: id,
    p_ip_address: req.headers.get("x-forwarded-for") ?? null,
    p_user_agent: req.headers.get("user-agent") ?? null,
  });
  if (error) {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }

  return NextResponse.json({ ok: true });

    if (updateError) {
      console.error("Gagal update supplier_profiles:", updateError);
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }

    await supabase
      .from("profiles")
      .update({ role: "supplier", updated_at: new Date().toISOString() })
      .eq("id", id);

    return NextResponse.json({ success: true, message: "Supplier disetujui." });
  } catch (err: any) {
    console.error("Approve API Error:", err);
    return NextResponse.json(
      { error: err.message || "Gagal memproses persetujuan." },
      { status: 500 }
    );
  }
}