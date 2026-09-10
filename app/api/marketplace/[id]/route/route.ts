import { NextResponse } from "next/server";
import { isUuid } from "@/lib/admin/validation";
import { enforceRateLimit } from "@/lib/rate-limit";
import { getCurrentUser, type AuthClient } from "@/lib/supabase/auth";
import { getServerClient } from "@/lib/supabase/server";
import { hasValidUmkmLocation } from "@/lib/umkm/profile-completion";
import { fetchMarketplaceDetail } from "@/lib/marketplace/server-repository";
import { resolveMarketplaceRoute, type MarketplaceRouteEndpoints } from "@/lib/marketplace/routing";

export const dynamic = "force-dynamic";

interface ProfileLocationRow {
  latitude: number | string | null;
  longitude: number | string | null;
}

interface MarketplaceRouteClient {
  auth: AuthClient["auth"];
  from: (table: "umkm_profiles") => {
    select: (columns: string) => {
      eq: (column: string, value: string) => {
        single: () => PromiseLike<{ data: unknown; error: Error | null }>;
        maybeSingle: () => PromiseLike<{ data: unknown; error: Error | null }>;
      };
    };
  };
  rpc: (
    functionName: string,
    params: Record<string, unknown>,
  ) => PromiseLike<{ data: unknown[] | null; error: Error | null }>;
}

function jsonError(error: string, code: string, status: number) {
  return NextResponse.json({ error, code }, { status, headers: { "cache-control": "no-store" } });
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  if (!isUuid(id)) return jsonError("Invalid batch id", "invalid_batch_id", 400);

  const url = new URL(request.url);
  if (["lat", "lng", "userId", "user_id"].some((key) => url.searchParams.has(key))) {
    return jsonError("Route origin is resolved from the active session", "client_coordinates_not_allowed", 400);
  }

  const client = (await getServerClient()) as unknown as MarketplaceRouteClient;
  const context = await getCurrentUser(client as unknown as AuthClient);
  if (!context) return jsonError("Silakan masuk sebagai UMKM.", "login_required", 401);
  if (context.role !== "umkm" || context.status !== "active") {
    return jsonError("Rute pickup hanya tersedia untuk akun UMKM aktif.", "role_forbidden", 403);
  }

  const limited = await enforceRateLimit(request, "route", context.userId);
  if (limited) return limited;

  const { data: profile, error: profileError } = await client
    .from("umkm_profiles")
    .select("latitude,longitude")
    .eq("user_id", context.userId)
    .maybeSingle();

  if (profileError) {
    console.error("[marketplace/route] profile lookup failed", {
      batchId: id,
      userId: context.userId,
      message: profileError.message,
    });
    return jsonError("Lokasi usaha belum dapat dibaca.", "profile_lookup_failed", 500);
  }

  const location = profile as ProfileLocationRow | null;
  if (!location || !hasValidUmkmLocation(location)) {
    return jsonError("Simpan lokasi usaha terlebih dahulu untuk melihat rute.", "profile_location_missing", 409);
  }

  const origin = {
    latitude: Number(location.latitude),
    longitude: Number(location.longitude),
  };

  let item;
  try {
    item = await fetchMarketplaceDetail(client, id, origin);
  } catch (error) {
    console.error("[marketplace/route] batch lookup failed", {
      batchId: id,
      userId: context.userId,
      message: error instanceof Error ? error.message : "unknown",
    });
    return jsonError("Lokasi pickup belum dapat dimuat.", "batch_lookup_failed", 500);
  }
  if (!item) return jsonError("Batch tidak ditemukan.", "batch_not_found", 404);

  const endpoints: MarketplaceRouteEndpoints = {
    origin,
    destination: {
      latitude: item.pickupLatitude,
      longitude: item.pickupLongitude,
      address: item.pickupAddress,
    },
  };
  const payload = await resolveMarketplaceRoute(id, endpoints);

  return NextResponse.json(payload, {
    headers: { "cache-control": "no-store" },
  });
}
