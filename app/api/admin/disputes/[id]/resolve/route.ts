import { NextResponse } from "next/server";
import { getAdminClient } from "@/lib/supabase/admin";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json().catch(() => ({}));
    const { decision, notes } = body; // decision: 'resolved_refund' | 'resolved_payout' | 'rejected'

    if (!decision || !["resolved_refund", "resolved_payout", "rejected"].includes(decision)) {
      return NextResponse.json(
        { error: "Keputusan resolusi tidak valid." },
        { status: 400 }
      );
    }

    const supabase = getAdminClient();

    const { data: dispute, error: disputeError } = await supabase
      .from("disputes")
      .select("id, registration_id, status")
      .eq("id", id)
      .single();

    if (disputeError || !dispute) {
      return NextResponse.json(
        { error: "Data sengketa tidak ditemukan." },
        { status: 404 }
      );
    }

  // Tentukan kandidat nilai status (misal 'resolved_refund' vs 'refund')
  let primaryStatus = decision;
  let fallbackStatus = decision;

  if (decision === "resolved_refund") fallbackStatus = "refund";
  if (decision === "resolved_payout") fallbackStatus = "payout";
  if (decision === "rejected") fallbackStatus = "resolved_rejected";

  const updatePayload: any = {
    status: primaryStatus,
    updated_at: new Date().toISOString(),
  };

  if (notes) {
    updatePayload.resolution_notes = notes;
  }

    // 1. Coba update status utama
    let { error: updateDisputeError } = await supabase
      .from("disputes")
      .update(updatePayload as any)
      .eq("id", id);

    // Jika gagal karena Enum mismatch, coba fallback status
    if (updateDisputeError && updateDisputeError.message.includes("enum")) {
      const retryResult = await supabase
        .from("disputes")
        .update({ ...updatePayload, status: fallbackStatus } as any)
        .eq("id", id);
      
      updateDisputeError = retryResult.error;
    }

    if (updateDisputeError) {
      console.error("Gagal update status dispute:", updateDisputeError);
      return NextResponse.json({ error: updateDisputeError.message }, { status: 500 });
    }

    // 2. Jika keputusan REFUND -> Masukkan ke Antrean Refund Admin
    if (decision === "resolved_refund") {
      const { data: reg } = await supabase
        .from("registrations")
        .select("id, batch_id, final_amount")
        .eq("id", dispute.registration_id)
        .single();

      if (reg) {
        await supabase
          .from("registrations")
          .update({
            status: "refund_pending",
            updated_at: new Date().toISOString(),
          })
          .eq("id", reg.id);

        const refundPayload = {
          registration_id: reg.id,
          batch_id: reg.batch_id,
          trigger_type: "takedown",
          amount: Number(reg.final_amount || 0),
          status: "pending",
          created_at: new Date().toISOString(),
        };

        await supabase.from("refund_requests").insert(refundPayload as any);
      }
    }

    return NextResponse.json({
      success: true,
      message: `Sengketa berhasil diselesaikan dengan keputusan: ${decision}`,
    });
  } catch (err: any) {
    console.error("Resolve Dispute Error:", err);
    return NextResponse.json(
      { error: err.message || "Internal Server Error" },
      { status: 500 }
    );
  }
}