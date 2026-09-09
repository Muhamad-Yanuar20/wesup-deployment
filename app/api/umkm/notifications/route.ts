import { NextResponse } from "next/server";
import { resolveActiveUmkm } from "@/lib/umkm/workspace-auth";

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
  select: (columns: string) => { eq: (column: string, value: string) => { order: (column: string, options: { ascending: boolean }) => PromiseLike<{ data: NotificationRow[] | null; error: unknown | null }> } };
  update: (values: Record<string, unknown>) => { eq: (column: string, value: string) => { is: (column: string, value: null) => PromiseLike<{ data: unknown; error: unknown | null }> } };
}

export async function GET() {
  const viewer = await resolveActiveUmkm();
  if (!viewer.client) return viewer.response;
  const query = viewer.client.from("notifications") as NotificationQuery;
  const { data, error } = await query
    .select("id,type,title,message,data,read_at,created_at")
    .eq("user_id", viewer.context.userId)
    .order("created_at", { ascending: false });
  if (error) return NextResponse.json({ error: "Unable to load notifications" }, { status: 500 });

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
  const viewer = await resolveActiveUmkm();
  if (!viewer.client) return viewer.response;
  const query = viewer.client.from("notifications") as NotificationQuery;
  const { error } = await query
    .update({ read_at: new Date().toISOString() })
    .eq("user_id", viewer.context.userId)
    .is("read_at", null);
  if (error) return NextResponse.json({ error: "Unable to mark notifications read" }, { status: 500 });
  return NextResponse.json({ ok: true });
}
