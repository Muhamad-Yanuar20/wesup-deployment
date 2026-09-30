import { NextResponse } from "next/server";
import { NextResponse } from "next/server";
import { getAdminClient } from "@/lib/supabase/admin";
import {
  requireRole,
  toAuthResponse,
  type AuthClient,
  type AuthContext,
} from "@/lib/supabase/auth";
import { getServerClient } from "@/lib/supabase/server";
import { enforceRateLimit } from "@/lib/rate-limit";
import { isUuid, parseJsonBody } from "@/lib/admin/validation";

export const dynamic = "force-dynamic";

const WINNERS = ["supplier", "umkm"] as const;

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  if (!isUuid(id)) {
    return NextResponse.json({ error: "Invalid dispute id" }, { status: 400 });
  }

  const body = await parseJsonBody(req);
  if (
    !body ||
    typeof body.winner !== "string" ||
    !WINNERS.includes(body.winner as (typeof WINNERS)[number])
  ) {
    return NextResponse.json(
      { error: "winner must be supplier or umkm" },
      { status: 400 },
    );
  }
  const notes = body.notes === undefined ? null : body.notes;
  if (notes !== null && typeof notes !== "string") {
    return NextResponse.json(
      { error: "notes must be a string" },
      { status: 400 },
    );
  }

  const client = await getServerClient();
  let authCtx: AuthContext;
  try {
    authCtx = await requireRole(client as unknown as AuthClient, ["admin"]);
  } catch (err) {
    return toAuthResponse(err);
  }

  const limited = await enforceRateLimit(req, "admin", authCtx.userId);
  if (limited) return limited;

  const { error } = await client.rpc("resolve_dispute", {
    p_dispute_id: id,
    p_winner: body.winner,
    p_notes: notes,
    p_ip_address: req.headers.get("x-forwarded-for") ?? null,
    p_user_agent: req.headers.get("user-agent") ?? null,
  });
  if (error) {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }

  return NextResponse.json({ ok: true });

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