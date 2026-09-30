import { NextResponse } from "next/server";
import { resolveActiveUmkm, type UmkmWorkspaceClient } from "@/lib/umkm/workspace-auth";
import { isCompleteUmkmProfile } from "@/lib/umkm/profile-completion";

export const dynamic = "force-dynamic";

interface ProfileRow {
  business_name?: string | null;
  address?: string | null;
  latitude?: number | string | null;
  longitude?: number | string | null;
}

interface RegistrationRow {
  id: string;
  batch_id: string;
  status: string;
  quantity: number;
  final_amount: number | string | null;
  created_at: string;
  batch?: { id?: string; title?: string; batch_timeline?: { registration_closes_at?: string | null; payment_opens_at?: string | null; estimated_ready_at?: string | null } | Array<{ registration_closes_at?: string | null; payment_opens_at?: string | null; estimated_ready_at?: string | null }> | null } | null;
}

interface QueryResult<T> {
  data: T | null;
  error: unknown | null;
}

interface ProfileQuery {
  select: (columns: string) => { eq: (column: string, value: string) => { maybeSingle: () => PromiseLike<QueryResult<ProfileRow>> } };
}

interface RegistrationQuery {
  select: (columns: string) => { eq: (column: string, value: string) => { in: (column: string, values: string[]) => PromiseLike<QueryResult<RegistrationRow[]>> } };
}

interface CountResult {
  data: null;
  error: unknown | null;
  count: number | null;
}

interface NotificationQuery {
  select: (columns: string, options: { head: true; count: "exact" }) => { eq: (column: string, value: string) => { is: (column: string, value: null) => PromiseLike<CountResult> } };
}

const ACTIVE_ORDER_STATUSES = ["registered", "pending_payment", "paid"] as const;

function isActiveOrder(status: string): boolean {
  return status === "registered" || status === "pending_payment" || status === "paid";
}

function resolveNextAction(rows: RegistrationRow[]) {
  const timelineFor = (row: RegistrationRow) => { const value = row.batch?.batch_timeline; return Array.isArray(value) ? value[0] : value; };
  const active = rows
    .filter((row) => isActiveOrder(row.status))
    .sort((a, b) => Date.parse(a.created_at) - Date.parse(b.created_at));
  for (const row of active) {
    if (row.status === "registered" || row.status === "pending_payment") {
      return {
        type: "payment" as const,
        registrationId: row.id,
        batchId: row.batch_id,
        batchTitle: row.batch?.title ?? "Batch Anda",
        dueAt: timelineFor(row)?.payment_opens_at ?? timelineFor(row)?.registration_closes_at ?? null,
      };
    }
    if (row.status === "paid") {
      return {
        type: "pickup" as const,
        registrationId: row.id,
        batchId: row.batch_id,
        batchTitle: row.batch?.title ?? "Batch Anda",
        dueAt: timelineFor(row)?.estimated_ready_at ?? null,
      };
    }
  }
  return null;
}

export async function GET() {
  const viewer = await resolveActiveUmkm();
  if (!viewer.client) return viewer.response;
  const client = viewer.client as UmkmWorkspaceClient;

  const profileQuery = client.from("umkm_profiles") as ProfileQuery;
  const { data: profile, error: profileError } = await profileQuery
    .select("business_name,address,latitude,longitude")
    .eq("user_id", viewer.context.userId)
    .maybeSingle();
  if (profileError) return NextResponse.json({ error: "Unable to load UMKM profile" }, { status: 500 });

  // Only active orders can be counted or become the next action, so the query
  // is narrowed to them instead of streaming the whole order history into JS.
  // registrations_umkm_status_created_idx (umkm_id, status, created_at) covers
  // both predicates.
  const registrationsQuery = client.from("registrations") as RegistrationQuery;
  const { data: registrations, error: registrationsError } = await registrationsQuery
    .select("id,batch_id,status,quantity,final_amount,created_at,batch:batches(id,title,batch_timeline(registration_closes_at,payment_opens_at,estimated_ready_at))")
    .eq("umkm_id", viewer.context.userId)
    .in("status", [...ACTIVE_ORDER_STATUSES]);
  if (registrationsError) return NextResponse.json({ error: "Unable to load UMKM orders" }, { status: 500 });

  // A COUNT with head: true returns no rows at all, where the previous shape
  // transferred every unread notification just to take its length.
  const notificationQuery = client.from("notifications") as NotificationQuery;
  const { count: unreadNotificationCount, error: notificationError } = await notificationQuery
    .select("id", { head: true, count: "exact" })
    .eq("user_id", viewer.context.userId)
    .is("read_at", null);
  if (notificationError) return NextResponse.json({ error: "Unable to load UMKM notifications" }, { status: 500 });

  const rows = registrations ?? [];
  const profileComplete = isCompleteUmkmProfile(profile);
  return NextResponse.json({
    profileComplete,
    profile: profileComplete && profile ? { businessName: profile.business_name ?? "", address: profile.address ?? "" } : null,
    activeOrderCount: rows.filter((row) => isActiveOrder(row.status)).length,
    unreadNotificationCount: unreadNotificationCount ?? 0,
    nextAction: resolveNextAction(rows),
  });
}
