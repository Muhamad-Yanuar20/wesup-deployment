import { NextResponse } from "next/server";
import { resolveActiveUmkm } from "@/lib/umkm/workspace-auth";

export const dynamic = "force-dynamic";

interface OrderRow {
  id: string;
  batch_id: string;
  quantity: number;
  status: string;
  final_amount: number | string | null;
  locked_tier_number: number | null;
  created_at: string;
  batch?: { id?: string; title?: string; status?: string } | null;
}

interface OrdersQuery {
  select: (columns: string) => { eq: (column: string, value: string) => PromiseLike<{ data: OrderRow[] | null; error: unknown | null }> };
}

export async function GET() {
  const viewer = await resolveActiveUmkm();
  if (!viewer.client) return viewer.response;

  const query = viewer.client.from("registrations") as OrdersQuery;
  const { data, error } = await query
    .select("id,batch_id,quantity,status,final_amount,locked_tier_number,created_at,batch:batches(id,title,status)")
    .eq("umkm_id", viewer.context.userId);
  if (error) return NextResponse.json({ error: "Unable to load UMKM orders" }, { status: 500 });

  return NextResponse.json({
    orders: (data ?? []).map((row) => ({
      id: row.id,
      batchId: row.batch_id,
      batchTitle: row.batch?.title ?? "Batch tanpa judul",
      batchStatus: row.batch?.status ?? null,
      quantity: row.quantity,
      status: row.status,
      finalAmount: row.final_amount === null ? null : Number(row.final_amount),
      lockedTier: row.locked_tier_number,
      createdAt: row.created_at,
    })),
  });
}
