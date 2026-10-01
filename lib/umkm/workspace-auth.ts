import { NextResponse } from "next/server";
import {
  getCurrentUser,
  toAuthResponse,
  maybeLiftExpiredTemporarySuspension,
  type AuthClient,
  type AuthContext,
  type RpcLiftClient,
} from "@/lib/supabase/auth";
import { getServerClient } from "@/lib/supabase/server";

export interface UmkmWorkspaceClient {
  from: (table: string) => unknown;
}

export type UmkmWorkspaceViewer =
  | { client: UmkmWorkspaceClient; context: AuthContext; response: null }
  | { client: null; context: null; response: NextResponse };

export async function resolveActiveUmkm(options: {allowSuspended?: boolean} = {}): Promise<UmkmWorkspaceViewer> {
  const client = await getServerClient();
  let context: AuthContext | null;
  try { context = await getCurrentUser(client as unknown as AuthClient); }
  catch (error) { return { client: null, context: null, response: toAuthResponse(error) }; }
  if (!context) {
    return {
      client: null,
      context: null,
      response: NextResponse.json({ error: "Sign in required", code: "unauthenticated" }, { status: 401 }),
    };
  }

  const lifted = await maybeLiftExpiredTemporarySuspension(
    client as unknown as RpcLiftClient,
    context,
  );

  if (lifted.role !== "umkm" || (lifted.status !== "active" && !(options.allowSuspended && ["suspended_temporary","suspended_permanent"].includes(lifted.status)))) {
    return {
      client: null,
      context: null,
      response: NextResponse.json({ error: "Only active UMKM accounts can access this page", code: "role_forbidden" }, { status: 403 }),
    };
  }
  return { client: client as unknown as UmkmWorkspaceClient, context: lifted, response: null };
}
