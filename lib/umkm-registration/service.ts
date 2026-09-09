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

export type UmkmRegistrationStage = "email_lookup" | "auth_signup" | "profile_insert" | "unknown";

export class UmkmRegistrationError extends Error {
  constructor(message = "UMKM registration failed", public readonly stage: UmkmRegistrationStage = "unknown") {
    super(message);
    this.name = "UmkmRegistrationError";
  }
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
        error: { code?: string; message?: string } | null;
      }>;
    };
  };
  adminClient: {
    auth: { admin: { deleteUser(userId: string): Promise<{ error: { message?: string } | null }> } };
    from(table: "profiles"): {
      select(columns: "id"): {
        eq(column: "email", value: string): {
          maybeSingle(): Promise<{ data: { id: string } | null; error: { message?: string } | null }>;
        };
      };
    };
    rpc(name: "create_umkm_registration", args: { p_user_id: string; p_latitude: number; p_longitude: number }): Promise<{ error: { message?: string } | null }>;
  };
}

export async function registerUmkm(
  fields: UmkmRegistrationFields,
  dependencies?: UmkmRegistrationDependencies,
): Promise<UmkmRegistrationSuccessResponse> {
  const authClient = dependencies?.authClient ?? (getRegistrationAuthClient() as unknown as UmkmRegistrationDependencies["authClient"]);
  const adminClient = dependencies?.adminClient ?? (getAdminClient() as unknown as UmkmRegistrationDependencies["adminClient"]);
  const email = normalizeUmkmEmail(fields.email);

  const { data: existing, error: lookupError } = await adminClient
    .from("profiles")
    .select("id")
    .eq("email", email)
    .maybeSingle();
  if (lookupError) throw new UmkmRegistrationError("UMKM profile lookup failed", "email_lookup");
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
    throw new UmkmRegistrationError("UMKM auth signup failed", "auth_signup");
  }

  const user = signup.user;
  if (!user || (Array.isArray(user.identities) && user.identities.length === 0)) throw new DuplicateUmkmEmailError();

  const { error: profileError } = await adminClient.rpc("create_umkm_registration", {
    p_user_id: user.id,
    p_latitude: fields.latitude,
    p_longitude: fields.longitude,
  });
  if (profileError) {
    await adminClient.auth.admin.deleteUser(user.id).catch(() => undefined);
    throw new UmkmRegistrationError("UMKM profile insert failed", "profile_insert");
  }

  return { ok: true, requiresEmailConfirmation: signup.session === null };
}

export function isDuplicateUmkmEmailError(error: unknown): boolean {
  return error instanceof DuplicateUmkmEmailError;
}

export function isUmkmEmailRateLimitError(error: unknown): boolean {
  return error instanceof UmkmEmailRateLimitError;
}
