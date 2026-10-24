import { NextResponse } from "next/server";
import { isUuid } from "@/lib/admin/validation";
import { getServerClient } from "@/lib/supabase/server";
import { fetchMarketplaceSnapshot } from "@/lib/marketplace/server-repository";
import { deriveTierProgress } from "@/lib/marketplace/tier-progress";

export const dynamic = "force-dynamic";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!isUuid(id)) return NextResponse.json({ error: "Invalid batch id" }, { status: 400 });
  try {
    const client = await getServerClient();
    // Durable availability must not be reopened by a stale Redis counter.
    // Redis reservations and all registration locks remain unchanged.
    const item = await fetchMarketplaceSnapshot(client as never, id);
    if (!item) return NextResponse.json({ error: "Batch not found" }, { status: 404 });
    if (!item.availability || !item.serverTime || !item.tiers?.length) {
      return NextResponse.json({ error: "Ketersediaan penawaran belum dapat diperiksa." }, { status: 503 });
    }
    return NextResponse.json({
      batchId: id,
      status: item.status === "ACTIVE" ? "published" : "closed",
      registeredQuantity: item.registeredQuantity,
      tiers: item.tiers,
      tierProgress: deriveTierProgress(item.tiers, item.registeredQuantity),
      registrationClosesAt: item.registrationClosesAt,
      registrationOpensAt: item.registrationOpensAt,
      availability: item.availability,
      serverTime: item.serverTime,
    }, { headers: { "cache-control": "no-store" } });
  } catch {
    return NextResponse.json({ error: "Service unavailable" }, { status: 503 });
  }
}
