import { NextResponse } from "next/server";
import { getAdminClient } from "@/lib/supabase/admin";

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => null);

    if (!body || !body.order_id) {
      return NextResponse.json(
        { error: "Payload tidak valid atau order_id tidak ditemukan." },
        { status: 400 }
      );
    }

    const { order_id, transaction_status, fraud_status } = body;
    const supabase = getAdminClient();

    // 1. Validasi keberadaan registrasi
    const { data: registration, error: fetchError } = await supabase
      .from("registrations")
      .select("id, status")
      .eq("id", order_id)
      .maybeSingle();

    if (fetchError || !registration) {
      return NextResponse.json(
        { error: `Registrasi dengan ID ${order_id} tidak ditemukan.` },
        { status: 404 }
      );
    }

    // 2. Evaluasi status transaksi Midtrans
    const isSuccess =
      (transaction_status === "capture" || transaction_status === "settlement") &&
      fraud_status !== "challenge";

    if (isSuccess) {
      const { error: updateError } = await supabase
        .from("registrations")
        .update({
          status: "paid",
          consented_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq("id", order_id);

      if (updateError) {
        console.error("Gagal update registrasi via Webhook:", updateError);
        return NextResponse.json({ error: updateError.message }, { status: 500 });
      }

      return NextResponse.json({
        success: true,
        message: "Webhook berhasil diproses. Status registrasi diperbarui ke 'paid'.",
      });
    }

    return NextResponse.json({
      success: true,
      message: `Status transaksi Midtrans '${transaction_status}', tidak ada perubahan pada registrasi.`,
    });
  } catch (err: any) {
    console.error("Midtrans Webhook Error:", err);
    return NextResponse.json(
      { error: err.message || "Internal Server Error" },
      { status: 500 }
    );
  }
}