import { NextResponse } from "next/server";
import {
  requireRole,
  toAuthResponse,
  type AuthClient,
} from "@/lib/supabase/auth";
import { getServerClient } from "@/lib/supabase/server";
import { parseJsonBody, isUuid } from "@/lib/admin/validation";

export const dynamic = "force-dynamic";

const BANDUNG_BOUNDS = {
  minLat: -7.1,
  maxLat: -6.5,
  minLng: 107.4,
  maxLng: 107.9,
};

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  if (!isUuid(id)) {
    return NextResponse.json({ error: "Invalid batch id" }, { status: 400 });
  }

  const body = await parseJsonBody(req);
  if (!body) {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const client = await getServerClient();
  try {
    await requireRole(client as unknown as AuthClient, ["supplier", "admin"]);
  } catch (err) {
    return toAuthResponse(err);
  }

  let latitude: number | null = null;
  let longitude: number | null = null;
  if (body.latitude !== undefined || body.longitude !== undefined) {
    latitude = body.latitude !== undefined ? Number(body.latitude) : null;
    longitude = body.longitude !== undefined ? Number(body.longitude) : null;
    if (
      latitude !== null &&
      (latitude < BANDUNG_BOUNDS.minLat || latitude > BANDUNG_BOUNDS.maxLat)
    ) {
      return NextResponse.json(
        { error: "location is outside the Bandung operating region" },
        { status: 400 },
      );
    }
    if (
      longitude !== null &&
      (longitude < BANDUNG_BOUNDS.minLng || longitude > BANDUNG_BOUNDS.maxLng)
    ) {
      return NextResponse.json(
        { error: "location is outside the Bandung operating region" },
        { status: 400 },
      );
    }
  }

  const { error } = await client.rpc("update_batch", {
    p_batch_id: id,
    p_title: typeof body.title === "string" ? body.title : null,
    p_description:
      typeof body.description === "string" ? body.description : null,
    p_category: typeof body.category === "string" ? body.category : null,
    p_product_photo_url:
      typeof body.productPhotoUrl === "string" ? body.productPhotoUrl : null,
    p_pickup_address:
      typeof body.pickupAddress === "string" ? body.pickupAddress : null,
    p_latitude: latitude,
    p_longitude: longitude,
    p_ip_address: req.headers.get("x-forwarded-for") ?? null,
    p_user_agent: req.headers.get("user-agent") ?? null,
  });

  if (error) {
    const msg = error.message ?? "";
    if (/locked once registrants|not editable|not found|only the owning/i.test(msg)) {
      return NextResponse.json({ error: msg }, { status: 409 });
    }
    if (/outside the Bandung/i.test(msg)) {
      return NextResponse.json({ error: msg }, { status: 400 });
    }
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}

export async function DELETE(
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

  const { error } = await client.rpc("delete_batch", {
    p_batch_id: id,
    p_ip_address: req.headers.get("x-forwarded-for") ?? null,
    p_user_agent: req.headers.get("user-agent") ?? null,
  });

  if (error) {
    const msg = error.message ?? "";
    if (/cancel instead of delete|not found|only the owning/i.test(msg)) {
      return NextResponse.json({ error: msg }, { status: 409 });
    }
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
