import { NextResponse } from "next/server";
import { getCurrentUser, type AuthClient } from "@/lib/supabase/auth";
import { getServerClient } from "@/lib/supabase/server";
import { isUuid, parseJsonBody } from "@/lib/admin/validation";
import { enforceRateLimit } from "@/lib/rate-limit";
import {
  evaluateRegistrationWindow,
  type BatchTimeline,
  type Tier,
} from "@/lib/orders/time-gatekeeper";
import { adjustVolumeCounter } from "@/lib/orders/registration-counter";
import { isCompleteUmkmProfile } from "@/lib/umkm/profile-completion";

export const dynamic = "force-dynamic";

interface UmkmProfileCheck { user_id: string; business_name: string | null; address: string | null; latitude: number | string | null; longitude: number | string | null }

interface RegistrationBody {
  batchId?: unknown;
  quantity?: unknown;
  consentLat?: unknown;
  consentLng?: unknown;
}

export async function POST(req: Request) {
  const client = await getServerClient();

  const authCtx = await getCurrentUser(client as unknown as AuthClient);
  if (!authCtx) {
    return NextResponse.json({ error: "Sign in required", code: "unauthenticated" }, { status: 401 });
  }
  if (authCtx.role !== "umkm" || authCtx.status !== "active") {
    return NextResponse.json({ error: "Pendaftaran hanya tersedia untuk akun UMKM aktif.", code: "role_forbidden" }, { status: 403 });
  }

  const profileQuery = client.from("umkm_profiles") as never as {
    select: (columns: string) => {
      eq: (column: string, value: string) => {
        maybeSingle: () => PromiseLike<{ data: UmkmProfileCheck | null; error: Error | null }>;
      };
    };
  };
  const { data: umkmProfile, error: profileError } = await profileQuery
    .select("user_id,business_name,address,latitude,longitude")
    .eq("user_id", authCtx.userId)
    .maybeSingle();
  if (profileError) {
    return NextResponse.json({ error: "Unable to verify UMKM profile" }, { status: 500 });
  }
  if (!isCompleteUmkmProfile(umkmProfile)) {
    return NextResponse.json({ error: "Lengkapi profil usaha sebelum bergabung ke batch.", code: "profile_incomplete" }, { status: 409 });
  }

  const limited = await enforceRateLimit(req, "registration", authCtx.userId);
  if (limited) return limited;

  const body = (await parseJsonBody(req)) as RegistrationBody | null;
  if (
    !body ||
    typeof body.batchId !== "string" ||
    !isUuid(body.batchId) ||
    typeof body.quantity !== "number" ||
    !Number.isSafeInteger(body.quantity) ||
    body.quantity <= 0
  ) {
    return NextResponse.json({ error: "Invalid registration payload" }, { status: 400 });
  }

  const batchId = body.batchId;
  const quantity = body.quantity;
  const consentLat =
    typeof body.consentLat === "number" ? body.consentLat : null;
  const consentLng =
    typeof body.consentLng === "number" ? body.consentLng : null;

  const batchQuery = client.from("batches") as never as {
    select: (cols: string) => {
      eq: (col: string, v: string) => { single: () => PromiseLike<{ data: { status: string } | null; error: Error | null }> };
    };
  };
  const { data: batch, error: batchErr } = await batchQuery
    .select("status")
    .eq("id", batchId)
    .single();
  if (batchErr || !batch) {
    return NextResponse.json({ error: "Batch not found" }, { status: 404 });
  }

  const timelineQuery = client.from("batch_timeline") as never as {
    select: (cols: string) => {
      eq: (col: string, v: string) => { single: () => PromiseLike<{ data: BatchTimeline | null; error: Error | null }> };
    };
  };
  const { data: timeline, error: timelineErr } = await timelineQuery
    .select("*")
    .eq("batch_id", batchId)
    .single();
  if (timelineErr || !timeline) {
    return NextResponse.json({ error: "Batch timeline not found" }, { status: 500 });
  }

  const gate = evaluateRegistrationWindow(
    timeline,
    new Date().toISOString(),
    batch.status as never,
  );
  if (!gate.allowed) {
    const message =
      gate.reason === "not_open"
        ? "Pendaftaran belum dibuka"
        : gate.reason === "closed"
          ? "Pendaftaran telah ditutup"
          : "Penawaran tidak tersedia";
    return NextResponse.json({ error: message }, { status: 403 });
  }

  const tiersQuery = client.from("batch_tiers") as never as {
    select: (cols: string) => {
      eq: (col: string, v: string) => PromiseLike<{ data: Tier[] | null; error: Error | null }>;
    };
  };
  const { data: tiers, error: tiersErr } = await tiersQuery
    .select("tier_number,min_volume,max_volume,price_per_unit")
    .eq("batch_id", batchId);
  if (tiersErr || !tiers || tiers.length === 0) {
    return NextResponse.json({ error: "Batch tiers not found" }, { status: 500 });
  }
  const maxVolume = tiers.reduce<number>(
    (max, t) => (t.max_volume === null ? max : Math.max(max, t.max_volume)),
    0,
  );
  if (maxVolume > 0 && quantity > maxVolume) {
    return NextResponse.json(
      { error: "Quantity exceeds batch tier maximum volume" },
      { status: 400 },
    );
  }

  let newCount: number;
  try {
    newCount = await adjustVolumeCounter(batchId, quantity);
  } catch {
    return NextResponse.json({ error: "Service unavailable" }, { status: 503 });
  }

  const registrations = client.from("registrations");
  const { data: inserted, error: insertErr } = await (registrations as never as {
    insert: (row: never) => {
      select: (columns: string) => {
        single: () => PromiseLike<{ data: { id: string } | null; error: Error | null }>;
      };
    };
  }).insert({
    batch_id: batchId,
    umkm_id: authCtx.userId,
    quantity,
    consented_at: new Date().toISOString(),
    consent_latitude: consentLat,
    consent_longitude: consentLng,
    status: "registered",
  } as never).select("id").single();

  if (insertErr && isDuplicateKeyError(insertErr)) {
    await adjustVolumeCounter(batchId, -quantity).catch(() => undefined);
    return NextResponse.json(
      { error: "Anda sudah terdaftar pada penawaran ini" },
      { status: 409 },
    );
  }
  if (insertErr) {
    await adjustVolumeCounter(batchId, -quantity).catch(() => undefined);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }

  if (!inserted) {
    await adjustVolumeCounter(batchId, -quantity).catch(() => undefined);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }

  return NextResponse.json(
    { ok: true, count: newCount, registrationId: inserted?.id ?? null },
    { status: 201 },
  );
}

function isDuplicateKeyError(
  error: { code?: string; message?: string },
): boolean {
  return error.code === "23505" || /duplicate/i.test(error.message ?? "");
}
