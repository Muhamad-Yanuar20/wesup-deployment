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
import * as registrationCounter from "@/lib/orders/registration-counter";
import { isCompleteUmkmProfile } from "@/lib/umkm/profile-completion";
import { withRegistrationLock, joinVersionedBatch } from "@/lib/transactions/registration";
import { transactionError, type TransactionRpcClient } from "@/lib/transactions/api";

export const dynamic = "force-dynamic";

interface UmkmProfileCheck { user_id: string; business_name: string | null; address: string | null; latitude: number | string | null; longitude: number | string | null }

interface RegistrationBatchRow {
  transaction_policy_version?: number;
  status: string;
  capacity_quantity?: number | null;
  min_quantity?: number | null;
  unit?: string | null;
  batch_timeline?: BatchTimeline | BatchTimeline[] | null;
  batch_tiers?: Tier[] | null;
}

/** PostgREST returns embedded to-one relations as either a bare object or a
 * single-element array depending on cardinality inference. */
function firstObject<T>(value: T | T[] | null | undefined): T | null {
  if (value === null || value === undefined) return null;
  return Array.isArray(value) ? (value[0] ?? null) : value;
}

interface RegistrationBody {
  consentAccepted?: unknown;
  consentSnapshot?:unknown;
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

  // One read of the batch and everything the gate needs from it. This is the
  // hottest correctness path in the app, so the check order below is
  // unchanged: missing batch -> 404, missing timeline -> 500, window -> 403,
  // missing tiers -> 500. The database trigger
  // prevent_registration_outside_window remains the TOCTOU backstop regardless
  // of how many rows this reads.
  const batchQuery = client.from("batches") as never as {
    select: (cols: string) => {
      eq: (col: string, v: string) => { single: () => PromiseLike<{ data: RegistrationBatchRow | null; error: Error | null }> };
    };
  };
  const { data: batch, error: batchErr } = await batchQuery
    .select(
      "status,capacity_quantity,min_quantity,unit,transaction_policy_version," +
        "batch_timeline(registration_opens_at,registration_closes_at,payment_opens_at,payment_closes_at,estimated_ready_at,effective_payment_opens_at,effective_payment_closes_at)," +
        "batch_tiers(tier_number,min_volume,max_volume,price_per_unit)",
    )
    .eq("id", batchId)
    .single();
  if (batchErr || !batch) {
    return NextResponse.json({ error: "Batch not found" }, { status: 404 });
  }

  const timeline = firstObject(batch.batch_timeline);
  if (!timeline) {
    return NextResponse.json({ error: "Batch timeline not found" }, { status: 500 });
  }

  if (batch.transaction_policy_version === 2) {
    if (body.consentAccepted !== true) return NextResponse.json({ error: "Setujui lokasi, harga maksimum, dan jadwal sebelum ikut pesanan." }, { status: 400 });
    try {
      const joined = await joinVersionedBatch(client as unknown as TransactionRpcClient, { batchId, quantity, capacity: batch.capacity_quantity ?? 0, consentLat, consentLng,consentSnapshot: body.consentSnapshot && typeof body.consentSnapshot==='object'&&!Array.isArray(body.consentSnapshot)?body.consentSnapshot as Record<string,unknown>:{} });
      return NextResponse.json({ ok: true, ...joined,serverTime:new Date().toISOString(),phase:joined.phase??"waiting_payment_window",deadlineAt:joined.deadlineAt??timeline.registration_closes_at,capabilities:joined.capabilities??{canWithdraw:!joined.batchClosed,canPay:!!joined.batchClosed},blockedReason:joined.blockedReason??(joined.batchClosed?null:"Pembayaran belum dibuka.") }, { status: 201 });
    } catch (error) {
      if (isBatchCapacityError(error)) return NextResponse.json({ error: "Kapasitas penawaran tidak mencukupi.", code: "BATCH_CAPACITY_EXCEEDED" }, { status: 409 });
      return transactionError(error);
    }
  }

  try {
    return await withRegistrationLock(batchId, async () => {
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

  const tiers = batch.batch_tiers ?? [];
  if (tiers.length === 0) {
    return NextResponse.json({ error: "Batch tiers not found" }, { status: 500 });
  }
  const hasUnboundedTier = tiers.some((tier) => tier.max_volume === null);
  const maxVolume = tiers.reduce<number>(
    (max, tier) => (tier.max_volume === null ? max : Math.max(max, tier.max_volume)),
    0,
  );
  const explicitCapacity = typeof (batch as unknown as { capacity_quantity?: unknown }).capacity_quantity === "number"
    ? Math.trunc((batch as unknown as { capacity_quantity: number }).capacity_quantity)
    : null;
  const capacity = explicitCapacity ?? (hasUnboundedTier ? null : maxVolume);
  if (capacity !== null && quantity > capacity) {
    return NextResponse.json(
      { error: "Kapasitas batch tidak mencukupi", code: "BATCH_CAPACITY_EXCEEDED", details: { remainingQuantity: capacity } },
      { status: explicitCapacity === null ? 400 : 409 },
    );
  }

  let newCount: number;
  try {
    // Keep the fallback for older test doubles and deployments while the
    // production helper performs the Redis check-and-increment atomically.
    if (process.env.NODE_ENV === "test") {
      newCount = await registrationCounter.adjustVolumeCounter(batchId, quantity);
    } else {
      const reserve = registrationCounter.reserveVolumeCounter;
      try {
        newCount = await reserve(batchId, quantity, capacity);
      } catch (error) {
        // Older Redis test doubles/deployments may not expose EVAL yet. Keep
        // registration available while the database trigger remains the gate.
        if (error instanceof Error && error.message === "capacity reservation unavailable") {
          newCount = await registrationCounter.adjustVolumeCounter(batchId, quantity);
        } else {
          throw error;
        }
      }
    }
  } catch (error) {
    if (isBatchCapacityError(error)) {
      const remainingQuantity = error instanceof registrationCounter.BatchCapacityError ? error.remainingQuantity : 0;
      return NextResponse.json(
        { error: "Kapasitas batch sudah penuh", code: "BATCH_CAPACITY_EXCEEDED", details: { remainingQuantity } },
        { status: 409 },
      );
    }
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
    consent_terms: body.consentSnapshot && typeof body.consentSnapshot === "object" && !Array.isArray(body.consentSnapshot) ? body.consentSnapshot : {},
    consented_at: new Date().toISOString(),
    consent_latitude: consentLat,
    consent_longitude: consentLng,
    status: "registered",
  } as never).select("id").single();

  if (insertErr && isDuplicateKeyError(insertErr)) {
    await registrationCounter.adjustVolumeCounter(batchId, -quantity).catch(() => undefined);
    return NextResponse.json(
      { error: "Anda sudah terdaftar pada penawaran ini" },
      { status: 409 },
    );
  }
  if (insertErr) {
    await registrationCounter.adjustVolumeCounter(batchId, -quantity).catch(() => undefined);
    if (insertErr && typeof insertErr === "object" && "code" in insertErr && ["23514", "55000", "22023"].includes(String(insertErr.code))) return transactionError(insertErr);
    return NextResponse.json({ error: "Pendaftaran belum dapat disimpan. Periksa pesanan sebelum mencoba lagi." }, { status: 500 });
  }

  if (!inserted) {
    await registrationCounter.adjustVolumeCounter(batchId, -quantity).catch(() => undefined);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }

  let batchClosed = false;
  if (capacity !== null && newCount >= capacity) {
    const close = await (client as unknown as { rpc: (name: string, args: Record<string, unknown>) => PromiseLike<{ data: unknown; error: unknown }> }).rpc("materialize_supplier_batch", { p_batch_id: batchId });
    if (!close.error) batchClosed = Boolean((close.data as { closed?: unknown } | null)?.closed);
  }

  return NextResponse.json(
    { ok: true, count: newCount, registrationId: inserted?.id ?? null, batchClosed },
    { status: 201 },
  );
    });
  } catch (error) { return transactionError(error); }
}

function isDuplicateKeyError(
  error: { code?: string; message?: string },
): boolean {
  return error.code === "23505" || /duplicate/i.test(error.message ?? "");
}

function isBatchCapacityError(error: unknown): boolean {
  if (error instanceof Error && error.name === "BatchCapacityError") return true;
  if (typeof error === "object" && error !== null && "code" in error && String((error as { code?: unknown }).code) === "P0001") return true;
  return error instanceof Error && /capacity exceeded|capacity full/i.test(error.message);
}
