import { NextResponse } from "next/server";
import { getAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const supabase = getAdminClient();

    // Query registrasi berstatus refund_pending langsung gabung dengan batch & profile
    const { data: regData, error: regError } = await supabase
      .from("registrations")
      .select(`
        id,
        final_amount,
        status,
        updated_at,
        batches (
          id,
          title,
          takedown_reason
        ),
        profiles:umkm_id (
          full_name,
          email
        )
      `)
      .eq("status", "refund_pending")
      .order("updated_at", { ascending: false });

    if (!regError && regData && regData.length > 0) {
      const formatted = regData.map((r: any) => ({
        id: r.id,
        umkmName: r.profiles?.full_name || "UMKM Korban",
        email: r.profiles?.email || "—",
        batchTitle: r.batches?.title || "Katalog Takedown",
        amount: r.final_amount,
        reason: r.batches?.takedown_reason || "Pelanggaran Ketentuan Katalog (Takedown)",
        status: "pending",
        createdAt: r.updated_at,
      }));

      return NextResponse.json(formatted);
    }

    // Secondary Check: Query dari refund_requests jika registrasi tidak ditemukan
    const { data: refundRequestsData } = await supabase
      .from("refund_requests")
      .select(`
        id,
        amount,
        status,
        created_at,
        registrations (
          umkm_id,
          batches ( title, takedown_reason ),
          profiles:umkm_id ( full_name, email )
        )
      `)
      .order("created_at", { ascending: false });

    const refunds = (refundRequestsData || []).map((item: any) => ({
      id: item.id,
      umkmName: item.registrations?.profiles?.full_name || "UMKM Korban",
      email: item.registrations?.profiles?.email || "—",
      batchTitle: item.registrations?.batches?.title || "Katalog Takedown",
      amount: item.amount,
      reason: item.registrations?.batches?.takedown_reason || "Pelanggaran Ketentuan Katalog",
      status: item.status,
      createdAt: item.created_at,
    }));

    return NextResponse.json(refunds);
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Internal Server Error" }, { status: 500 });
  }
}