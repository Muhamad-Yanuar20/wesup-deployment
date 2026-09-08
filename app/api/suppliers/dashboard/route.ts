import { NextResponse } from "next/server";
import { requireRole, toAuthResponse, type AuthClient } from "@/lib/supabase/auth";
import { getServerClient } from "@/lib/supabase/server";
import { mapSupplierBatchRow, type SupplierBatchRpcRow } from "@/lib/supplier-catalog/api";

export const dynamic = "force-dynamic";

interface DashboardRow {
  supplier_name?: unknown;
  supplier_status?: unknown;
  active_batch_count?: unknown;
  total_participant_count?: unknown;
  collected_revenue?: unknown;
  ready_to_disburse?: unknown;
  average_rating?: unknown;
  rating_count?: unknown;
  recent_batches?: unknown;
}

function number(value: unknown, fallback = 0) {
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function text(value: unknown, fallback = "") {
  return typeof value === "string" && value.trim() ? value : fallback;
}

function dashboardError(error: unknown) {
  const code = typeof error === "object" && error !== null && "code" in error ? String((error as { code?: unknown }).code ?? "") : "";
  if (code === "42501") return NextResponse.json({ error: "Akses supplier ditolak.", code: "SUPPLIER_CATALOG_FORBIDDEN" }, { status: 403 });
  if (code === "22023") return NextResponse.json({ error: "Permintaan dashboard tidak valid.", code: "SUPPLIER_CATALOG_INVALID" }, { status: 400 });
  if (code === "55000") return NextResponse.json({ error: "Dashboard belum tersedia untuk status saat ini.", code: "SUPPLIER_CATALOG_CONFLICT" }, { status: 409 });
  console.error("[suppliers/dashboard] request failed", error);
  return NextResponse.json({ error: "Dashboard belum dapat dimuat.", code: "SUPPLIER_CATALOG_REQUEST_FAILED" }, { status: 500 });
}

export async function GET() {
  const client = await getServerClient();
  try {
    await requireRole(client as unknown as AuthClient, ["supplier"]);
  } catch (error) {
    return toAuthResponse(error);
  }
  const { data, error } = await client.rpc("get_supplier_dashboard_summary");
  if (error) return dashboardError(error);
  const row = (Array.isArray(data) ? data[0] : null) as DashboardRow | null;
  if (!row) return NextResponse.json({ error: "Dashboard belum tersedia.", code: "SUPPLIER_CATALOG_REQUEST_FAILED" }, { status: 500 });
  const averageRating = row.average_rating === null || row.average_rating === undefined ? null : number(row.average_rating);
  const recentRows = Array.isArray(row.recent_batches) ? row.recent_batches : [];
  return NextResponse.json({
    supplier: { displayName: text(row.supplier_name, "Supplier Wesup"), verificationStatus: text(row.supplier_status, "") },
    summary: {
      activeBatchCount: number(row.active_batch_count), participantCount: number(row.total_participant_count),
      collectedRevenue: number(row.collected_revenue), readyToDisburse: number(row.ready_to_disburse),
      ratingAverage: averageRating, ratingTotal: number(row.rating_count),
    },
    recentBatches: recentRows.map((batch) => mapSupplierBatchRow(batch as SupplierBatchRpcRow)),
  });
}
