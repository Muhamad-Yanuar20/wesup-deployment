import type {
  AccountStatus,
  UserRole,
  VerificationStatus,
} from "@/types/database";
import { cache } from "react";
import { withinReadBudget } from "@/lib/performance/read-budget";
import { getCurrentUser, AuthUnavailableError, type AuthClient, type AuthContext, AuthError } from "@/lib/supabase/auth";
import { isCompleteUmkmProfile } from "@/lib/umkm/profile-completion";
import { getDashboardPath } from "@/lib/auth/role-navigation";

export { AuthError };

export type UserAccessState =
  | {
      role: "umkm";
      status: AccountStatus;
      profileComplete: boolean;
    }
  | {
      role: "supplier";
      status: AccountStatus;
      verificationStatus: VerificationStatus;
    }
  | {
      role: "admin";
      status: AccountStatus;
    };

type QueryResult<T> = {
  data: T | null;
  error: unknown | null;
};

export interface AccessStateClient {
  auth: {
    getUser: () => PromiseLike<{
      data: { user: { id: string } | null };
      error: unknown | null;
    }>;
  };
  from: (table: "profiles" | "supplier_profiles" | "umkm_profiles") => {
    select: (columns: string) => {
      eq: (column: string, value: string) => {
        single: () => PromiseLike<QueryResult<{
          role: UserRole;
          status: AccountStatus;
        }>>;
        maybeSingle: () => PromiseLike<QueryResult<
          | { verification_status: VerificationStatus }
          | { user_id: string; business_name: string | null; address: string | null; latitude: number | string | null; longitude: number | string | null }
        >>;
      };
    };
  };
}

async function resolveClient(client?: AccessStateClient): Promise<AccessStateClient> {
  if (client) return client;
  const { getServerClient } = await import("@/lib/supabase/server");
  return (await getServerClient()) as unknown as AccessStateClient;
}

const readViewerAccessState = cache(async (client: AccessStateClient): Promise<UserAccessState | null> => {
  const context = await getCurrentUser(client as unknown as AuthClient);
  return context ? getAccessStateForUser(client, context) : null;
});
export async function getViewerAccessState(client?: AccessStateClient): Promise<UserAccessState | null> {
  return readViewerAccessState(await resolveClient(client));
}
/** Receives an already verified identity/profile, never browser-supplied data. */
export async function getAccessStateForUser(client: AccessStateClient, context: AuthContext, knownSupplierStatus?: VerificationStatus): Promise<UserAccessState> {
  if (context.role === "admin") return { role: "admin", status: context.status };
  if (context.role === "supplier") {
    if (knownSupplierStatus) return { role: "supplier", status: context.status, verificationStatus: knownSupplierStatus };
    const { data, error } = await withinReadBudget(client.from("supplier_profiles").select("verification_status").eq("user_id", context.userId).maybeSingle());
    if (error) throw new AuthUnavailableError();
    return { role: "supplier", status: context.status, verificationStatus: (data as { verification_status?: VerificationStatus } | null)?.verification_status ?? "pending" };
  }
  const { data, error } = await withinReadBudget(client.from("umkm_profiles").select("user_id,business_name,address,latitude,longitude").eq("user_id", context.userId).maybeSingle());
  if (error) throw new AuthUnavailableError();
  return { role: "umkm", status: context.status, profileComplete: isCompleteUmkmProfile(data as { business_name?: unknown; address?: unknown; latitude?: unknown; longitude?: unknown } | null) };
}

export function resolveHomePath(accessState: UserAccessState): string {
  if (accessState.status !== "active") return "/login";
  return getDashboardPath(accessState);
}

const PUBLIC_RETURN_PATHS = ["/", "/marketplace", "/bantuan"];

export function sanitizeReturnTo(
  value: unknown,
  role: UserRole,
): string | null {
  if (typeof value !== "string") return null;
  const candidate = value.trim();
  if (
    !candidate ||
    !candidate.startsWith("/") ||
    candidate.startsWith("//") ||
    candidate.includes("\\")
  ) {
    return null;
  }

  let decodedPath: string;
  try {
    decodedPath = decodeURIComponent(candidate);
  } catch {
    return null;
  }
  if (decodedPath.startsWith("//") || decodedPath.includes("\\")) return null;

  const parsed = new URL(candidate, "https://wesup.local");
  if (parsed.origin !== "https://wesup.local") return null;

  const pathname = parsed.pathname;
  if (pathname === "/api" || pathname.startsWith("/api/")) return null;

  const isPublic =
    PUBLIC_RETURN_PATHS.includes(pathname) || pathname.startsWith("/marketplace/");
  const isRolePath =
    (role === "umkm" && (pathname === "/umkm" || pathname.startsWith("/umkm/"))) ||
    (role === "supplier" &&
      (pathname === "/supplier" || pathname.startsWith("/supplier/"))) ||
    (role === "admin" &&
      (pathname === "/admin" || pathname.startsWith("/admin/")));

  return isPublic || isRolePath ? candidate : null;
}

export async function requirePageRole(
  role: UserRole,
  client?: AccessStateClient,
): Promise<UserAccessState> {
  const accessState = await getViewerAccessState(client);
  if (!accessState) throw new AuthError(401, "Sign in required");
  if (accessState.status !== "active" || accessState.role !== role) {
    throw new AuthError(403, "Insufficient permissions");
  }
  return accessState;
}

export async function requireCompleteUmkmProfile(
  client?: AccessStateClient,
): Promise<Extract<UserAccessState, { role: "umkm" }>> {
  const accessState = await getViewerAccessState(client);
  if (!accessState) throw new AuthError(401, "Sign in required");
  if (accessState.role !== "umkm" || accessState.status !== "active") {
    throw new AuthError(403, "An active UMKM account is required");
  }
  if (!accessState.profileComplete) {
    throw new AuthError(403, "Complete your UMKM profile before joining a batch");
  }
  return accessState;
}

export async function requireApprovedSupplier(
  client?: AccessStateClient,
): Promise<Extract<UserAccessState, { role: "supplier" }>> {
  const accessState = await getViewerAccessState(client);
  if (!accessState) throw new AuthError(401, "Sign in required");
  if (
    accessState.role !== "supplier" ||
    accessState.status !== "active" ||
    accessState.verificationStatus !== "approved"
  ) {
    throw new AuthError(403, "An approved supplier account is required");
  }
  return accessState;
}
