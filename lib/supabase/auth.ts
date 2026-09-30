import { NextResponse } from "next/server";
import type { AccountStatus, UserRole } from "@/types/database";

export class AuthError extends Error {
  constructor(
    public status: 401 | 403,
    message: string,
  ) {
    super(message);
    this.name = "AuthError";
  }
}

export interface AuthContext {
  userId: string;
  email: string;
  role: UserRole;
  status: AccountStatus;
  fullName: string;
}

interface GetUserResponse {
  data: { user: { id: string; email?: string } | null };
  error: Error | null;
}

interface ProfileRow {
  role: UserRole;
  status: AccountStatus;
  full_name: string;
}

interface SingleResponse {
  data: ProfileRow | null;
  error: Error | null;
}

export interface AuthClient {
  auth: { getUser: () => PromiseLike<GetUserResponse> };
  from: (table: "profiles") => {
    select: (columns: string) => {
      eq: (column: string, value: string) => {
        single: () => PromiseLike<SingleResponse>;
      };
    };
  };
}

export interface RpcLiftClient extends AuthClient {
  rpc: (
    fn: "lazy_lift_expired_suspension",
    args: { p_user_id: string },
  ) => Promise<{ data: boolean | null; error: { message: string } | null }>;
}

/**
 * Lazy lift for expired temporary suspensions (auto-suspend lazy evaluation).
 * PostgREST only executes this RPC when the temp-suspension window has elapsed
 * and the user is still blocked; otherwise it is a cheap no-op that leaves
 * status intact so the caller's gate still rejects non-active accounts.
 * Returns a fresh AuthContext when the lift actually transitioned the account,
 * or the original context when nothing changed.
 */
export async function maybeLiftExpiredTemporarySuspension(
  client: RpcLiftClient,
  context: AuthContext,
): Promise<AuthContext> {
  if (context.status === "active" || context.status === "suspended_permanent") {
    return context;
  }

  let lifted: boolean | null = null;
  try {
    const result = await client.rpc("lazy_lift_expired_suspension", {
      p_user_id: context.userId,
    });
    if (result.error) {
      return context;
    }
    lifted = result.data;
  } catch {
    return context;
  }

  if (!lifted) {
    return context;
  }
  return (await getCurrentUser(client)) ?? context;
}

export async function getCurrentUser(client: AuthClient): Promise<AuthContext | null> {
  const { data, error } = await client.auth.getUser();
  if (error || !data.user) {
    return null;
  }

  const { data: profile, error: profileError } = await client
    .from("profiles")
    .select("role,status,full_name")
    .eq("id", data.user.id)
    .single();

  if (profileError || !profile) {
    return null;
  }

  return {
    userId: data.user.id,
    email: data.user.email ?? "",
    role: profile.role,
    status: profile.status,
    fullName: profile.full_name,
  };
}

export async function requireRole(client: AuthClient, roles: UserRole[]): Promise<AuthContext> {
  const context = await getCurrentUser(client);
  if (!context) {
    throw new AuthError(401, "Sign in required");
  }
  if (!roles.includes(context.role) || context.status !== "active") {
    throw new AuthError(403, "Insufficient permissions");
  }
  return context;
}

export async function requireActive(client: AuthClient): Promise<AuthContext> {
  const context = await getCurrentUser(client);
  if (!context) {
    throw new AuthError(401, "Sign in required");
  }
  if (context.status !== "active") {
    throw new AuthError(403, `Account is ${context.status}`);
  }
  return context;
}

export function toAuthResponse(err: unknown): NextResponse {
  if (err instanceof AuthError) {
    return NextResponse.json({ error: err.message }, { status: err.status });
  }
  return NextResponse.json({ error: "Internal server error" }, { status: 500 });
}
