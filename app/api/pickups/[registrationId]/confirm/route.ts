import { NextResponse } from "next/server";
import { requireRole, toAuthResponse, type AuthClient } from "@/lib/supabase/auth";
import { getServerClient } from "@/lib/supabase/server";
import { parseJsonBody, isUuid } from "@/lib/admin/validation";

export const dynamic = "force-dynamic";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ registrationId: string }> },
) {
  const { registrationId } = await params;
  if (!isUuid(registrationId)) {
    return NextResponse.json({ error: "Invalid registration id", code: "INVALID_REGISTRATION_ID" }, { status: 400 });
  }

  const body = await parseJsonBody(req);
  if (!body) {
    return NextResponse.json({ error: "Invalid request body", code: "INVALID_REQUEST" }, { status: 400 });
  }

  const method = String(body.method ?? "").toLowerCase();
  if (method !== "qr" && method !== "pin") {
    return NextResponse.json({ error: "method must be qr or pin", code: "INVALID_PICKUP_METHOD" }, { status: 400 });
  }
  if (typeof body.code !== "string" || body.code.trim() === "") {
    return NextResponse.json({ error: "code is required", code: "PICKUP_CODE_REQUIRED" }, { status: 400 });
  }

  const client = await getServerClient();
  try {
    await requireRole(client as unknown as AuthClient, ["supplier", "admin"]);
  } catch (err) {
    return toAuthResponse(err);
  }

  const { error } = await client.rpc("confirm_pickup", {
    p_registration_id: registrationId,
    p_method: method,
    p_code: body.code.trim(),
    p_latitude: body.latitude !== undefined ? Number(body.latitude) : null,
    p_longitude: body.longitude !== undefined ? Number(body.longitude) : null,
    p_notes: typeof body.notes === "string" ? body.notes : null,
    p_ip_address: req.headers.get("x-forwarded-for") ?? null,
    p_user_agent: req.headers.get("user-agent") ?? null,
  });

  if (error) {
    const msg = error.message ?? "";
    if (/invalid or already-used (qr code|pin)/i.test(msg)) {
      return NextResponse.json({ error: msg, code: "PICKUP_CODE_INVALID" }, { status: 409 });
    }
    if (/not eligible|already picked up/i.test(msg)) {
      return NextResponse.json({ error: msg, code: "PICKUP_STATE_CONFLICT" }, { status: 409 });
    }
    if (/only the owning supplier|sign in required/i.test(msg)) {
      return NextResponse.json({ error: msg, code: "PICKUP_FORBIDDEN" }, { status: 403 });
    }
    if (/registration not found/i.test(msg)) {
      return NextResponse.json({ error: "Pesanan tidak ditemukan", code: "ORDER_NOT_FOUND" }, { status: 404 });
    }
    return NextResponse.json({ error: "Internal server error", code: "PICKUP_CONFIRM_FAILED" }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
