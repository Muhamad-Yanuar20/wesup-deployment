import { NextResponse } from "next/server";
import {
  requireRole,
  toAuthResponse,
  type AuthClient,
} from "@/lib/supabase/auth";
import { getServerClient } from "@/lib/supabase/server";
import { isUuid, parseJsonBody } from "@/lib/admin/validation";

export const dynamic = "force-dynamic";

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

    const { error: batchError } = await supabase
      .from("batches")
      .update({
        status: "takedown",
        takedown_reason: reason,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id);

    if (batchError) {
      await supabase
        .from("batches")
        .update({
          status: "takedown",
          updated_at: new Date().toISOString(),
        })
        .eq("id", id);
    }

    const { data: paidRegistrations } = await supabase
      .from("registrations")
      .select("id, final_amount")
      .eq("batch_id", id)
      .eq("status", "paid");

    if (paidRegistrations && paidRegistrations.length > 0) {
      const regIds = paidRegistrations.map((r) => r.id);

      await supabase
        .from("registrations")
        .update({
          status: "refund_pending",
          updated_at: new Date().toISOString(),
        })
        .in("id", regIds);

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
      { error: "Takedown reason is required" },
      { status: 400 },
    );
  }

  const client = await getServerClient();
  try {
    await requireRole(client as unknown as AuthClient, ["admin"]);
  } catch (err) {
    return toAuthResponse(err);
  }

  const { error } = await client.rpc("takedown_batch", {
    p_batch_id: id,
    p_reason: body.reason.trim(),
    p_ip_address: req.headers.get("x-forwarded-for") ?? null,
    p_user_agent: req.headers.get("user-agent") ?? null,
  });
  if (error) {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}