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

    if (!reason) {
      return NextResponse.json(
        { error: "Alasan pelanggaran wajib diisi." },
        { status: 400 }
      );
    }

    const supabase = getAdminClient();

    // Jalankan RPC takedown_batch
    const { error } = await supabase.rpc("takedown_batch", {
      p_batch_id: id,
      p_reason: reason,
    });

    if (error) {
      console.error("Gagal takedown batch via RPC:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      message: "Katalog berhasil di-takedown dan transaksi telah dialihkan ke antrean refund.",
    });
  } catch (err: any) {
    console.error("Takedown API Error:", err);
    return NextResponse.json(
      { error: err.message || "Gagal memproses takedown." },
      { status: 500 }
    );
  }
}