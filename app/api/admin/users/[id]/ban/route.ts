import { NextResponse } from "next/server";
import { NextResponse } from "next/server";
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
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  if (!isUuid(id)) {
    return NextResponse.json({ error: "Invalid user id" }, { status: 400 });
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

  const { error } = await client.rpc("ban_user", {
    p_user_id: id,
    p_ip_address: req.headers.get("x-forwarded-for") ?? null,
    p_user_agent: req.headers.get("user-agent") ?? null,
  });
  if (error) {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(users || []);
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || "Internal Server Error" },
      { status: 500 }
    );
  }
}

export async function PATCH(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const { userId, suspend } = body;

    if (!userId || typeof suspend !== "boolean") {
      return NextResponse.json(
        { error: "Parameter userId dan status suspend wajib disertakan." },
        { status: 400 }
      );
    }

    const supabase = getAdminClient();

    const { error } = await supabase
      .from("profiles")
      .update({ is_suspended: suspend } as any)
      .eq("id", userId);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      message: `Status pengguna berhasil diperbarui menjadi ${
        suspend ? "DIBEKUKAN (Suspended)" : "AKTIF"
      }`,
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || "Internal Server Error" },
      { status: 500 }
    );
  }
}