import type { AuthContext } from "@/lib/supabase/auth";
import { BANDUNG_SERVICE_CENTER } from "@/lib/geo/service-center";
import { hasValidUmkmLocation } from "@/lib/umkm/profile-completion";
import type { MarketplaceOrigin } from "./types";

interface ProfileLocationRow {
  latitude: number | string | null;
  longitude: number | string | null;
}

export interface MarketplaceOriginClient {
  from: (table: "umkm_profiles") => {
    select: (columns: string) => {
      eq: (column: string, value: string) => {
        maybeSingle: () => PromiseLike<{ data: ProfileLocationRow | null; error: unknown | null }>;
      };
    };
  };
}

function bandungDefault(needsProfileLocation: boolean): MarketplaceOrigin {
  return {
    latitude: BANDUNG_SERVICE_CENTER.lat,
    longitude: BANDUNG_SERVICE_CENTER.lng,
    source: "bandung_default",
    needsProfileLocation,
  };
}

export async function resolveMarketplaceOrigin(
  client: MarketplaceOriginClient,
  context: AuthContext | null,
  requestCoordinates?: { latitude: number; longitude: number } | null,
): Promise<MarketplaceOrigin> {
  if (context?.role === "umkm") {
    const { data } = await client
      .from("umkm_profiles")
      .select("latitude,longitude")
      .eq("user_id", context.userId)
      .maybeSingle();
    if (data && hasValidUmkmLocation(data)) {
      return {
        latitude: Number(data.latitude),
        longitude: Number(data.longitude),
        source: "umkm_profile",
        needsProfileLocation: false,
      };
    }
    return bandungDefault(true);
  }

  if (requestCoordinates) {
    return {
      ...requestCoordinates,
      source: "request",
      needsProfileLocation: false,
    };
  }
  return bandungDefault(false);
}