import { NextResponse } from "next/server";
import { getAdminClient } from "@/lib/supabase/admin";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json().catch(() => ({}));
    const reason = body.reason || "Pendaftaran ditolak oleh admin.";

    const supabase = getAdminClient();

    // Update verification_status dan sertakan catatan penolakan
    const { error: updateError } = await supabase
      .from("supplier_profiles")
      .update({
        verification_status: "rejected",
        verification_notes: reason,
        verified_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("user_id", id);

    if (updateError) {
      console.error("Gagal update supplier_profiles:", updateError);
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, message: "Supplier ditolak." });
  } catch (err: any) {
    console.error("Reject API Error:", err);
    return NextResponse.json(
      { error: err.message || "Gagal memproses penolakan." },
      { status: 500 }
    );
  }
}