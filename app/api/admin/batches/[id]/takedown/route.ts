import { NextResponse } from "next/server";
import { getAdminClient } from "@/lib/supabase/admin";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json().catch(() => ({}));
    const reason = body.reason?.trim();

    if (!reason || reason.length < 5) {
      return NextResponse.json(
        { error: "Alasan pelanggaran wajib diisi (minimal 5 karakter)." },
        { status: 400 }
      );
    }

    const supabase = getAdminClient();

    // 1. Simpan alasan takedown & update status batch menjadi 'takedown'
    const { error: batchError } = await supabase
      .from("batches")
      .update({
        status: "takedown",
        takedown_reason: reason,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id);

    if (batchError) {
      // Fallback jika kolom takedown_reason belum tersedia
      await supabase
        .from("batches")
        .update({
          status: "takedown",
          updated_at: new Date().toISOString(),
        })
        .eq("id", id);
    }

    // 2. Ambil semua registrasi UMKM pada batch ini yang berstatus 'paid'
    const { data: paidRegistrations } = await supabase
      .from("registrations")
      .select("id, final_amount")
      .eq("batch_id", id)
      .eq("status", "paid");

    if (paidRegistrations && paidRegistrations.length > 0) {
      const regIds = paidRegistrations.map((r) => r.id);

      // Update status registrasi menjadi refund_pending
      await supabase
        .from("registrations")
        .update({
          status: "refund_pending",
          updated_at: new Date().toISOString(),
        })
        .in("id", regIds);

      // Insert ke refund_requests sesuai skema tabel murni (tanpa atribut reason yang tidak ada di tabel)
      const refundEntries = paidRegistrations.map((r) => ({
        registration_id: r.id,
        batch_id: id,
        trigger_type: "takedown" as const,
        amount: Number(r.final_amount || 0),
        status: "pending" as const,
        created_at: new Date().toISOString(),
      }));

      const { error: refundInsertError } = await supabase
        .from("refund_requests")
        .insert(refundEntries);

      if (refundInsertError) {
        console.error("Gagal insert ke refund_requests:", refundInsertError.message);
      }
    }

    return NextResponse.json({
      success: true,
      message: "Katalog berhasil di-takedown dan memicu refund.",
    });
  } catch (err: any) {
    console.error("Takedown API Error:", err);
    return NextResponse.json(
      { error: err.message || "Gagal melakukan takedown katalog." },
      { status: 500 }
    );
  }
}