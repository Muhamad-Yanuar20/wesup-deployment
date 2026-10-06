import { NextResponse } from "next/server";
import { getAdminClient } from "@/lib/supabase/admin";
import { authorizeAdminQueue } from "@/lib/admin/queue-access";
export const dynamic = "force-dynamic";
export async function GET(request: Request) {
  const denied = await authorizeAdminQueue(request);
  if (denied) return denied;
  const { data, error } = await getAdminClient().from("disputes").select("*,registration:registrations(final_amount,umkm:profiles!registrations_umkm_id_fkey(full_name,email),batch:batches(title,supplier:profiles!batches_supplier_id_fkey(full_name,email)))").order("created_at", { ascending: false });
  if (error) return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  return NextResponse.json((data ?? []).map((item) => ({
    id: item.id,
    batchTitle: item.registration?.batch?.title ?? "Penawaran",
    amount: item.registration?.final_amount ?? 0,
    umkmName: item.registration?.umkm?.full_name ?? "UMKM",
    umkmEmail: item.registration?.umkm?.email ?? "—",
    supplierName: item.registration?.batch?.supplier?.full_name ?? "Supplier",
    supplierEmail: item.registration?.batch?.supplier?.email ?? "—",
    reason: item.description,
    evidenceUrls: item.photo_urls,
    status: item.status === "resolved_umkm" ? "resolved_refund" : item.status === "resolved_supplier" ? "resolved_payout" : item.status === "pending" ? "open" : item.status,
    resolutionNotes: item.admin_notes,
    createdAt: item.created_at,
  })));
}
