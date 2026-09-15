import { NextResponse } from "next/server";
import { isUuid, parseJsonBody } from "@/lib/admin/validation";
import { resolveActiveUmkm } from "@/lib/umkm/workspace-auth";
import { enforceRateLimit } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

function fail(error: string, code: string, status: number) { return NextResponse.json({ error, code }, { status }); }

export async function POST(request: Request, { params }: { params: Promise<{ orderId: string }> }) {
  const viewer = await resolveActiveUmkm();
  if (!viewer.client) return viewer.response;
  const { orderId } = await params;
  if (!isUuid(orderId)) return fail("Pesanan tidak ditemukan", "ORDER_NOT_FOUND", 404);
  const limited = await enforceRateLimit(request, "route", viewer.context.userId);
  if (limited) return limited;
  const body = await parseJsonBody(request);
  const score = body?.score;
  if (typeof score !== "number" || !Number.isInteger(score) || score < 1 || score > 5) return fail("Rating harus berupa angka 1 sampai 5", "INVALID_RATING", 400);
  const comment = body?.comment === undefined || body.comment === null ? null : String(body.comment).trim();
  if (comment && comment.length > 1_000) return fail("Komentar terlalu panjang", "INVALID_COMMENT", 400);
  const rpc = (viewer.client as unknown as { rpc?: (name: string, args: Record<string, unknown>) => PromiseLike<{ data?: unknown; error?: { message?: string } | null }> }).rpc;
  if (typeof rpc !== "function") return fail("Layanan rating belum siap", "INFRASTRUCTURE_UNAVAILABLE", 503);
  const result = await rpc("submit_order_rating", { p_registration_id: orderId, p_score: score, p_comment: comment });
  if (result.error) {
    const message = result.error.message ?? "Rating tidak dapat dikirim";
    if (/already|available|picked|no.?show/i.test(message)) return fail(message, "RATING_NOT_AVAILABLE", 409);
    if (/sign in|owner/i.test(message)) return fail(message, "ORDER_FORBIDDEN", 403);
    return fail("Rating belum dapat dikirim", "RATING_SUBMIT_FAILED", 500);
  }
  return NextResponse.json({ ok: true, ratingId: result.data }, { status: 201 });
}
