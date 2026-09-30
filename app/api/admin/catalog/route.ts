import { NextResponse } from "next/server";
import { getAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const supabase = getAdminClient();

    const { data, error } = await supabase
      .from("batches")
      .select(`
        id,
        title,
        description,
        category,
        min_quantity,
        unit,
        status,
        created_at,
        profiles:supplier_id (
          full_name
        )
      `)
      .order("created_at", { ascending: false });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const catalog = (data || []).map((item: any) => ({
      id: item.id,
      title: item.title,
      supplierName: item.profiles?.full_name || "Supplier",
      category: item.category,
      minQty: item.min_quantity,
      unit: item.unit,
      status: item.status,
    }));

    return NextResponse.json(catalog);
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Internal Server Error" }, { status: 500 });
  }
}