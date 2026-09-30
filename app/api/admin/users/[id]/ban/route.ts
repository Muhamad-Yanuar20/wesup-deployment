import { NextResponse } from "next/server";
import { getAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const supabase = getAdminClient();

    const { data: users, error } = await supabase
      .from("profiles")
      .select("id, full_name, email, role, is_suspended, created_at")
      .order("created_at", { ascending: false });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(users || []);
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || "Internal Server Error" },
      { status: 500 }
    );
  }
}

export async function PATCH(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const { userId, suspend } = body;

    if (!userId || typeof suspend !== "boolean") {
      return NextResponse.json(
        { error: "Parameter userId dan status suspend wajib disertakan." },
        { status: 400 }
      );
    }

    const supabase = getAdminClient();

    const { error } = await supabase
      .from("profiles")
      .update({ is_suspended: suspend } as any)
      .eq("id", userId);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      message: `Status pengguna berhasil diperbarui menjadi ${
        suspend ? "DIBEKUKAN (Suspended)" : "AKTIF"
      }`,
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || "Internal Server Error" },
      { status: 500 }
    );
  }
}