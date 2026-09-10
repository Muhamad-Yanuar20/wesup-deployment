import "server-only";
import { getAdminClient } from "@/lib/supabase/admin";
import { getRegistrationAuthClient } from "@/lib/supabase/registration-client";
import { normalizeUmkmEmail, type UmkmRegistrationFields, type UmkmRegistrationSuccessResponse } from "./contracts";

export class DuplicateUmkmEmailError extends Error {
  constructor() {
    super("UMKM email already exists");
    this.name = "DuplicateUmkmEmailError";
  }
}

export class UmkmEmailRateLimitError extends Error {
  constructor() {
    super("Supabase confirmation email rate limit exceeded");
    this.name = "UmkmEmailRateLimitError";
  }
}

export type UmkmRegistrationStage =
  | "email_lookup"
  | "auth_signup"
  | "profile_insert"
  | "profile_verify"
  | "cleanup"
  | "unknown";

export class UmkmRegistrationError extends Error {
  constructor(
    message = "UMKM registration failed",
    public readonly stage: UmkmRegistrationStage = "unknown",
    public readonly correlationId?: string,
  ) {
    super(message);
    this.name = "UmkmRegistrationError";
  }
}

type DatabaseError = { message?: string; code?: string } | null;

interface RowQuery {
  select: (columns: string) => {
    eq: (column: string, value: string) => {
      maybeSingle: () => PromiseLike<{ data: Record<string, unknown> | null; error: DatabaseError }>;
    };
  };
}

export interface UmkmRegistrationDependencies {
  authClient: {
    auth: {
      signUp(input: {
        email: string;
        password: string;
        options: { data: { full_name: string; phone: string } };
      }): Promise<{
        data: { user: { id: string; identities?: unknown[] } | null; session: unknown };
        error: DatabaseError;
      }>;
    };
  };
  adminClient: {
    auth: { admin: { deleteUser(userId: string): Promise<{ error: DatabaseError }> } };
    from(table: "profiles" | "umkm_profiles"): RowQuery;
    rpc(
      name: "create_umkm_registration",
      args: { p_user_id: string; p_latitude: number; p_longitude: number },
    ): Promise<{ error: DatabaseError }>;
  };
}

function createCorrelationId(): string {
  return globalThis.crypto?.randomUUID?.() ?? "umkm-" + Date.now() + "-" + Math.random().toString(36).slice(2, 10);
}

async function rollbackAuthUser(
  adminClient: UmkmRegistrationDependencies["adminClient"],
  userId: string,
  correlationId: string,
  originalStage: "profile_insert" | "profile_verify",
): Promise<never> {
  try {
    const { error } = await adminClient.auth.admin.deleteUser(userId);
    if (error) {
      console.error("[auth/signup] cleanup failed", {
        stage: "cleanup",
        originalStage,
        correlationId,
        message: error.message,
        code: error.code,
      });
      throw new UmkmRegistrationError("UMKM registration cleanup failed", "cleanup", correlationId);
    }
  } catch (error) {
    if (error instanceof UmkmRegistrationError) throw error;
    console.error("[auth/signup] cleanup threw", { stage: "cleanup", originalStage, correlationId, error });
    throw new UmkmRegistrationError("UMKM registration cleanup failed", "cleanup", correlationId);
  }

  throw new UmkmRegistrationError(
    originalStage === "profile_insert" ? "UMKM profile insert failed" : "UMKM profile verification failed",
    originalStage,
    correlationId,
  );
}

async function verifyRegistrationRows(
  adminClient: UmkmRegistrationDependencies["adminClient"],
  userId: string,
  correlationId: string,
): Promise<void> {
  const profile = await adminClient
    .from("profiles")
    .select("id,role")
    .eq("id", userId)
    .maybeSingle();

  if (profile.error || !profile.data || profile.data.id !== userId || profile.data.role !== "umkm") {
    console.error("[auth/signup] profile verification failed", {
      stage: "profile_verify",
      correlationId,
      message: profile.error?.message,
      code: profile.error?.code,
      profileFound: Boolean(profile.data),
    });
    throw new UmkmRegistrationError("UMKM profile verification failed", "profile_verify", correlationId);
  }

  const umkmProfile = await adminClient
    .from("umkm_profiles")
    .select("user_id")
    .eq("user_id", userId)
    .maybeSingle();

  if (umkmProfile.error || !umkmProfile.data || umkmProfile.data.user_id !== userId) {
    console.error("[auth/signup] UMKM row verification failed", {
      stage: "profile_verify",
      correlationId,
      message: umkmProfile.error?.message,
      code: umkmProfile.error?.code,
      profileFound: Boolean(umkmProfile.data),
    });
    throw new UmkmRegistrationError("UMKM profile verification failed", "profile_verify", correlationId);
  }
}

export async function registerUmkm(
  fields: UmkmRegistrationFields,
  dependencies?: UmkmRegistrationDependencies,
): Promise<UmkmRegistrationSuccessResponse> {
  const authClient = dependencies?.authClient ?? (getRegistrationAuthClient() as unknown as UmkmRegistrationDependencies["authClient"]);
  const adminClient = dependencies?.adminClient ?? (getAdminClient() as unknown as UmkmRegistrationDependencies["adminClient"]);
  const email = normalizeUmkmEmail(fields.email);
  const correlationId = createCorrelationId();

  const { data: existing, error: lookupError } = await adminClient
    .from("profiles")
    .select("id")
    .eq("email", email)
    .maybeSingle();
  if (lookupError) {
    console.error("[auth/signup] email lookup failed", {
      stage: "email_lookup",
      correlationId,
      message: lookupError.message,
      code: lookupError.code,
    });
    throw new UmkmRegistrationError("UMKM profile lookup failed", "email_lookup", correlationId);
  }
  if (existing) throw new DuplicateUmkmEmailError();

  const { data: signup, error: signupError } = await authClient.auth.signUp({
    email,
    password: fields.password,
    options: { data: { full_name: fields.fullName, phone: fields.phone } },
  });
  if (signupError) {
    if (signupError.code === "over_email_send_rate_limit") throw new UmkmEmailRateLimitError();
    if (signupError.code === "user_already_exists" || /already registered|already exists/i.test(signupError.message ?? "")) {
      throw new DuplicateUmkmEmailError();
    }
    console.error("[auth/signup] auth signup failed", {
      stage: "auth_signup",
      correlationId,
      message: signupError.message,
      code: signupError.code,
    });
    throw new UmkmRegistrationError("UMKM auth signup failed", "auth_signup", correlationId);
  }

  const user = signup.user;
  if (!user || (Array.isArray(user.identities) && user.identities.length === 0)) throw new DuplicateUmkmEmailError();

  const { error: profileError } = await adminClient.rpc("create_umkm_registration", {
    p_user_id: user.id,
    p_latitude: fields.latitude,
    p_longitude: fields.longitude,
  });
  if (profileError) {
    console.error("[auth/signup] UMKM row creation failed", {
      stage: "profile_insert",
      correlationId,
      message: profileError.message,
      code: profileError.code,
    });
    return rollbackAuthUser(adminClient, user.id, correlationId, "profile_insert");
  }

  try {
    await verifyRegistrationRows(adminClient, user.id, correlationId);
  } catch (error) {
    if (error instanceof UmkmRegistrationError) {
      return rollbackAuthUser(adminClient, user.id, correlationId, "profile_verify");
    }
    console.error("[auth/signup] UMKM row verification threw", { stage: "profile_verify", correlationId, error });
    return rollbackAuthUser(adminClient, user.id, correlationId, "profile_verify");
  }

  return { ok: true, requiresEmailConfirmation: signup.session === null };
}

export function isDuplicateUmkmEmailError(error: unknown): boolean {
  return error instanceof DuplicateUmkmEmailError;
}

export function isUmkmEmailRateLimitError(error: unknown): boolean {
  return error instanceof UmkmEmailRateLimitError;
}
