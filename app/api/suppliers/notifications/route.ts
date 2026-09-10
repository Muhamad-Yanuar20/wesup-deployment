import { NextResponse } from "next/server";
import { getCurrentUser, type AuthClient, type AuthContext } from "@/lib/supabase/auth";
import { getServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

interface NotificationRow {
  id: string;
  type: string;
  title: string;
  message: string;
  data?: Record<string, unknown> | null;
  read_at: string | null;
  created_at: string;
}

interface NotificationQuery {
  select: (columns: string) => {
    eq: (column: string, value: string) => {
      order: (column: string, options: { ascending: boolean }) => PromiseLike<{ data: NotificationRow[] | null; error: unknown | null }>;
    };
  };
  update: (values: Record<string, unknown>) => {
    eq: (column: string, value: string) => {
      is: (column: string, value: null) => PromiseLike<{ data: unknown; error: unknown | null }>;
    };
  };
}

interface SupplierProfileQuery {
  select: (columns: string) => {
    eq: (column: string, value: string) => {
      maybeSingle: () => PromiseLike<{ data: { verification_status?: string } | null; error: unknown | null }>;
    };
  };
}

interface SupplierNotificationsClient {
  from: (table: "notifications" | "supplier_profiles") => unknown;
}

type ResolvedSupplier =
  | { client: SupplierNotificationsClient; context: AuthContext; response: null }
  | { client: null; context: null; response: NextResponse };

async function resolveApprovedSupplier(): Promise<ResolvedSupplier> {
  const client = await getServerClient();
  const context = await getCurrentUser(client as unknown as AuthClient);
  if (!context) {
    return { client: null, context: null, response: NextResponse.json({ error: "Sign in required", code: "unauthenticated" }, { status: 401 }) };
  }
  if (context.role !== "supplier" || context.status !== "active") {
    return { client: null, context: null, response: NextResponse.json({ error: "Only active Supplier accounts can access notifications", code: "role_forbidden" }, { status: 403 }) };
  }
  const profileQuery = client.from("supplier_profiles") as never as SupplierProfileQuery;
  const { data: supplierProfile, error } = await profileQuery
    .select("verification_status")
    .eq("user_id", context.userId)
    .maybeSingle();
  if (error) return { client: null, context: null, response: NextResponse.json({ error: "Unable to verify Supplier status" }, { status: 500 }) };
  if (supplierProfile?.verification_status !== "approved") {
    return { client: null, context: null, response: NextResponse.json({ error: "Supplier approval is required", code: "role_forbidden" }, { status: 403 }) };
  }
  return { client: client as unknown as SupplierNotificationsClient, context, response: null };
}

export async function GET() {
  const resolved = await resolveApprovedSupplier();
  if (!resolved.client) return resolved.response;
  const query = resolved.client.from("notifications") as NotificationQuery;
  const { data, error } = await query
    .select("id,type,title,message,data,read_at,created_at")
    .eq("user_id", resolved.context.userId)
    .order("created_at", { ascending: false });
  if (error) return NextResponse.json({ error: "Unable to load Supplier notifications" }, { status: 500 });
  return NextResponse.json({
    notifications: (data ?? []).map((row) => ({
      id: row.id,
      type: row.type,
      title: row.title,
      message: row.message,
      readAt: row.read_at,
      createdAt: row.created_at,
      href: typeof row.data?.href === "string" ? row.data.href : undefined,
    })),
  });
}

export async function PATCH() {
  const resolved = await resolveApprovedSupplier();
  if (!resolved.client) return resolved.response;
  const query = resolved.client.from("notifications") as NotificationQuery;
  const { error } = await query
    .update({ read_at: new Date().toISOString() })
    .eq("user_id", resolved.context.userId)
    .is("read_at", null);
  if (error) return NextResponse.json({ error: "Unable to mark Supplier notifications read" }, { status: 500 });
  return NextResponse.json({ ok: true });
}
