import { NextResponse } from "next/server";
import { getCurrentUser, type AuthClient } from "@/lib/supabase/auth";
import { getServerClient } from "@/lib/supabase/server";
import { parseUmkmProfilePayload } from "@/lib/umkm/profile-contract";

export const dynamic = "force-dynamic";

const PROFILE_COLUMNS = "user_id,business_name,address,latitude,longitude,strike_count,suspended_until,created_at,updated_at";

interface ProfileRow {
  user_id: string;
  business_name: string | null;
  address: string | null;
  latitude: number | string | null;
  longitude: number | string | null;
  strike_count?: number;
  suspended_until?: string | null;
  created_at?: string;
  updated_at?: string;
}

interface ProfileQuery {
  select: (columns: string) => {
    eq: (column: string, value: string) => {
      maybeSingle: () => PromiseLike<{ data: ProfileRow | null; error: unknown | null }>;
    };
  };
}

interface ProfileMutationQuery {
  update: (values: Record<string, unknown>) => {
    eq: (column: string, value: string) => {
      select: (columns: string) => {
        maybeSingle: () => PromiseLike<{ data: ProfileRow | null; error: unknown | null }>;
      };
    };
  };
  insert: (values: Record<string, unknown>) => {
    select: (columns: string) => {
      single: () => PromiseLike<{ data: ProfileRow | null; error: unknown | null }>;
    };
  };
}

interface ProfileClient {
  from: (table: "umkm_profiles") => ProfileQuery & ProfileMutationQuery;
}

function requestId(): string {
  return globalThis.crypto?.randomUUID?.() ?? "umkm-profile-" + Date.now();
}

function errorDetails(error: unknown): { message?: string; code?: string } {
  if (!error || typeof error !== "object") return {};
  const value = error as { message?: unknown; code?: unknown };
  return {
    message: typeof value.message === "string" ? value.message : undefined,
    code: typeof value.code === "string" ? value.code : undefined,
  };
}

function toResponseProfile(profile: ProfileRow | null) {
  if (!profile) return null;
  return {
    userId: profile.user_id,
    businessName: profile.business_name,
    address: profile.address,
    latitude: profile.latitude === null ? null : Number(profile.latitude),
    longitude: profile.longitude === null ? null : Number(profile.longitude),
    strikeCount: profile.strike_count ?? 0,
    suspendedUntil: profile.suspended_until ?? null,
    createdAt: profile.created_at ?? null,
    updatedAt: profile.updated_at ?? null,
  };
}

async function resolveUmkmClient() {
  const client = await getServerClient();
  const context = await getCurrentUser(client as unknown as AuthClient);
  if (!context) {
    return {
      client: null,
      response: NextResponse.json({ error: "Sign in required", code: "unauthenticated" }, { status: 401 }),
    };
  }
  if (context.role !== "umkm" || context.status !== "active") {
    return {
      client: null,
      response: NextResponse.json(
        { error: "Only active UMKM accounts can manage this profile", code: "role_forbidden" },
        { status: 403 },
      ),
    };
  }
  return { client: client as unknown as ProfileClient, context, response: null };
}

export async function GET() {
  const id = requestId();
  const resolved = await resolveUmkmClient();
  if (!resolved.client) return resolved.response;

  const { data, error } = await resolved.client
    .from("umkm_profiles")
    .select(PROFILE_COLUMNS)
    .eq("user_id", resolved.context.userId)
    .maybeSingle();

  if (error) {
    console.error("[umkm-profile] read failed", { requestId: id, userId: resolved.context.userId, ...errorDetails(error) });
    return NextResponse.json(
      { error: "Profil usaha belum dapat dimuat. Coba lagi.", code: "profile_load_failed", requestId: id },
      { status: 500 },
    );
  }
  return NextResponse.json({ profile: toResponseProfile(data) });
}

export async function PUT(request: Request) {
  const id = requestId();
  const resolved = await resolveUmkmClient();
  if (!resolved.client) return resolved.response;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body", code: "validation_error" }, { status: 400 });
  }

  const parsed = parseUmkmProfilePayload(body);
  if (!parsed.ok) {
    return NextResponse.json(
      { error: "Periksa kembali data profil usaha.", code: "validation_error", fieldErrors: parsed.fieldErrors },
      { status: 400 },
    );
  }

  const values = {
    business_name: parsed.value.businessName,
    address: parsed.value.address,
    latitude: parsed.value.latitude,
    longitude: parsed.value.longitude,
    updated_at: new Date().toISOString(),
  };
  const profiles = resolved.client.from("umkm_profiles");
  // A merge upsert also assigns user_id, which column grants protect from
  // UPDATE. Keep identity in the filter and only insert it for missing rows.
  const updateProfile = () => profiles
    .update(values)
    .eq("user_id", resolved.context.userId)
    .select(PROFILE_COLUMNS)
    .maybeSingle();

  let result = await updateProfile();
  if (!result.error && !result.data) {
    result = await profiles
      .insert({ user_id: resolved.context.userId, ...values })
      .select(PROFILE_COLUMNS)
      .single();
    // Another request can create the row after our empty UPDATE. Retry once
    // using the same owner filter and allowed business columns.
    if (errorDetails(result.error).code === "23505") {
      result = await updateProfile();
    }
  }
  const { data, error } = result;

  if (error || !data) {
    console.error("[umkm-profile] write failed", {
      requestId: id,
      userId: resolved.context.userId,
      ...errorDetails(error),
      rowReturned: Boolean(data),
    });
    return NextResponse.json(
      { error: "Profil usaha belum dapat disimpan. Coba lagi.", code: "profile_save_failed", requestId: id },
      { status: 500 },
    );
  }
  return NextResponse.json({ profile: toResponseProfile(data) });
}
