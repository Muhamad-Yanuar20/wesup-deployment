import { NextResponse } from "next/server";
import { getAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const supabase = getAdminClient();

    const { data: disputes, error } = await supabase
      .from("disputes")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Supabase Error (disputes):", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    if (!disputes || disputes.length === 0) {
      return NextResponse.json([]);
    }

    const registrationIds = Array.from(
      new Set(disputes.map((d: any) => d.registration_id).filter(Boolean))
    );
    const profileIds = Array.from(
      new Set(
        disputes
          .flatMap((d: any) => [d.umkm_id, d.supplier_id])
          .filter(Boolean)
      )
    );

    // Fetch Registrations + Batches
    const { data: registrations } = await supabase
      .from("registrations")
      .select("id, final_amount, batch_id, batches(title)")
      .in("id", registrationIds);

    const { data: profiles } = await supabase
      .from("profiles")
      .select("id, full_name, email")
      .in("id", profileIds);

    const regMap = new Map((registrations || []).map((r: any) => [r.id, r]));
    const profileMap = new Map((profiles || []).map((p: any) => [p.id, p]));

    const formatted = disputes.map((item: any) => {
      const reg: any = regMap.get(item.registration_id) || {};
      const umkm: any = profileMap.get(item.umkm_id) || {};
      const supplier: any = profileMap.get(item.supplier_id) || {};

      return {
        id: item.id,
        batchTitle: reg.batches?.title || "Katalog Tidak Ditemukan",
        amount: reg.final_amount || 0,
        umkmName: umkm.full_name || "UMKM",
        umkmEmail: umkm.email || "—",
        supplierName: supplier.full_name || "Supplier",
        supplierEmail: supplier.email || "—",
        reason: item.reason || item.description || "Tidak ada rincian alasan.",
        evidenceUrls: item.evidence_urls || item.photo_urls || [],
        status: item.status || "open",
        resolutionNotes: item.resolution_notes || null,
        createdAt: item.created_at,
      };
    });

    return NextResponse.json(formatted);
  } catch (err: any) {
    console.error("Server Error (/api/admin/disputes):", err);
    return NextResponse.json(
      { error: err.message || "Internal Server Error" },
      { status: 500 }
    );
  }
}