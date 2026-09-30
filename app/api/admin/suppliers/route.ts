import { NextResponse } from "next/server";
import { getAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const supabase = getAdminClient();

    // 1. Fetch data dari supplier_profiles
    const { data: suppliersData, error: supplierError } = await supabase
      .from("supplier_profiles")
      .select("user_id, business_name, address, business_photo_url, verification_status, created_at")
      .order("created_at", { ascending: false });

    if (supplierError) {
      console.error("Error supplier_profiles:", supplierError);
      return NextResponse.json({ error: supplierError.message }, { status: 500 });
    }

    if (!suppliersData || suppliersData.length === 0) {
      return NextResponse.json([]);
    }

    // 2. Ambil semua email dari tabel profiles berdasarkan user_id
    const userIds = suppliersData.map((s) => s.user_id);
    const { data: profilesData } = await supabase
      .from("profiles")
      .select("id, email")
      .in("id", userIds);

    // Buat map email untuk lookup cepat
    const emailMap = new Map<string, string>();
    (profilesData || []).forEach((p) => {
      if (p.email) emailMap.set(p.id, p.email);
    });

    // 3. Gabungkan data
    const suppliers = suppliersData.map((item) => ({
      id: item.user_id,
      name: item.business_name,
      email: emailMap.get(item.user_id) || "—",
      address: item.address,
      locationPhotoUrl: item.business_photo_url,
      registeredAt: item.created_at,
      status: item.verification_status,
    }));

    return NextResponse.json(suppliers);
  } catch (err: any) {
    console.error("API Internal Error:", err);
    return NextResponse.json({ error: err.message || "Internal Server Error" }, { status: 500 });
  }
}