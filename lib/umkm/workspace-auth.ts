import { NextResponse } from "next/server";
import { getCurrentUser, type AuthClient, type AuthContext } from "@/lib/supabase/auth";
import { getServerClient } from "@/lib/supabase/server";

export interface UmkmWorkspaceClient {
  from: (table: string) => unknown;
}

export type UmkmWorkspaceViewer =
  | { client: UmkmWorkspaceClient; context: AuthContext; response: null }
  | { client: null; context: null; response: NextResponse };

export async function resolveActiveUmkm(): Promise<UmkmWorkspaceViewer> {
  const client = await getServerClient();
  const context = await getCurrentUser(client as unknown as AuthClient);
  if (!context) {
    return {
      client: null,
      context: null,
      response: NextResponse.json({ error: "Sign in required", code: "unauthenticated" }, { status: 401 }),
    };
  }
  if (context.role !== "umkm" || context.status !== "active") {
    return {
      client: null,
      context: null,
      response: NextResponse.json({ error: "Only active UMKM accounts can access this page", code: "role_forbidden" }, { status: 403 }),
    };
  }
  return { client: client as unknown as UmkmWorkspaceClient, context, response: null };
}
