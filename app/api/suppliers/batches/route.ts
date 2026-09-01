import { NextResponse } from "next/server";
import {
  requireRole,
  toAuthResponse,
  type AuthClient,
} from "@/lib/supabase/auth";
import { getServerClient } from "@/lib/supabase/server";
import { parseJsonBody, isUuid } from "@/lib/admin/validation";
import { validateCreateBatch } from "@/lib/catalog/batch-validators";

export const dynamic = "force-dynamic";

export async function GET() {
  const client = await getServerClient();
  try {
    await requireRole(client as unknown as AuthClient, ["supplier", "admin"]);
  } catch (err) {
    return toAuthResponse(err);
  }

  const { data, error } = await client.rpc("list_own_batches");
  if (error) {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
  return NextResponse.json({ batches: data ?? [] });
}

export async function POST(req: Request) {
  const body = await parseJsonBody(req);
  if (!body) {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const validation = validateCreateBatch(body);
  if (!validation.ok) {
    return NextResponse.json({ error: validation.error }, { status: 400 });
  }
  const v = validation.value;

  const client = await getServerClient();
  try {
    await requireRole(client as unknown as AuthClient, ["supplier", "admin"]);
  } catch (err) {
    return toAuthResponse(err);
  }

  const { data: batchId, error } = await client.rpc("create_batch", {
    p_title: v.title,
    p_description: v.description ?? null,
    p_category: v.category,
    p_min_quantity: v.minQuantity,
    p_product_photo_url: v.productPhotoUrl ?? null,
    p_pickup_address: v.pickupAddress,
    p_latitude: v.latitude,
    p_longitude: v.longitude,
    p_registration_opens_at: v.registrationOpensAt,
    p_registration_closes_at: v.registrationClosesAt,
    p_payment_opens_at: v.paymentOpensAt,
    p_payment_closes_at: v.paymentClosesAt,
    p_estimated_ready_at: v.estimatedReadyAt,
    p_tiers: v.tiers.map((t) => ({
      min_volume: t.minVolume,
      max_volume: t.maxVolume ?? null,
      price_per_unit: t.pricePerUnit,
    })),
    p_recurring_config_id: v.recurringConfigId
      ? isUuid(v.recurringConfigId)
        ? v.recurringConfigId
        : null
      : null,
    p_ip_address: req.headers.get("x-forwarded-for") ?? null,
    p_user_agent: req.headers.get("user-agent") ?? null,
  });

  if (error) {
    const msg = error.message ?? "";
    if (
      /only an approved supplier|sign in required/i.test(msg)
    ) {
      return NextResponse.json({ error: msg }, { status: 403 });
    }
    if (
      /timeline|overlap|invert|inversion|strictly increasing|outside the Bandung|at least one tier|positive/i.test(
        msg,
      )
    ) {
      return NextResponse.json({ error: msg }, { status: 400 });
    }
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }

  return NextResponse.json({ id: batchId }, { status: 201 });
}
