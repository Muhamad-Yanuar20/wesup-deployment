import { NextResponse } from "next/server";
import { getAdminClient } from "@/lib/supabase/admin";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = getAdminClient();

    const { error: updateError } = await supabase
      .from("supplier_profiles")
      .update({
        verification_status: "approved",
        verified_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("user_id", id);

    if (updateError) {
      console.error("Gagal update supplier_profiles:", updateError);
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }

    await supabase
      .from("profiles")
      .update({ role: "supplier", updated_at: new Date().toISOString() })
      .eq("id", id);

    return NextResponse.json({ success: true, message: "Supplier disetujui." });
  } catch (err: any) {
    console.error("Approve API Error:", err);
    return NextResponse.json(
      { error: err.message || "Gagal memproses persetujuan." },
      { status: 500 }
    );
  }
}