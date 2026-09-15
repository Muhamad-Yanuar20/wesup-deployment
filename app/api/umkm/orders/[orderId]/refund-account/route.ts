import { NextResponse } from "next/server";
import { isUuid, parseJsonBody } from "@/lib/admin/validation";
import { resolveActiveUmkm } from "@/lib/umkm/workspace-auth";
import { enforceRateLimit } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

function fail(error: string, code: string, status: number) { return NextResponse.json({ error, code }, { status }); }

export async function PUT(request: Request, { params }: { params: Promise<{ orderId: string }> }) {
  const viewer = await resolveActiveUmkm();
  if (!viewer.client) return viewer.response;
  const { orderId } = await params;
  if (!isUuid(orderId)) return fail("Pesanan tidak ditemukan", "ORDER_NOT_FOUND", 404);
  const limited = await enforceRateLimit(request, "route", viewer.context.userId);
  if (limited) return limited;
  const body = await parseJsonBody(request);
  const bankName = typeof body?.bankName === "string" ? body.bankName.trim() : "";
  const accountNumber = typeof body?.accountNumber === "string" ? body.accountNumber.replace(/\s+/g, "") : "";
  const accountHolderName = typeof body?.accountHolderName === "string" ? body.accountHolderName.trim() : "";
  if (!bankName || !/^[0-9]{6,24}$/.test(accountNumber) || !accountHolderName || accountHolderName.length > 120) return fail("Data rekening refund tidak valid", "INVALID_REFUND_ACCOUNT", 400);
  const rpc = (viewer.client as unknown as { rpc?: (name: string, args: Record<string, unknown>) => PromiseLike<{ data?: unknown; error?: { message?: string } | null }> }).rpc;
  if (typeof rpc !== "function") return fail("Layanan refund belum siap", "INFRASTRUCTURE_UNAVAILABLE", 503);
  const result = await rpc("attach_refund_bank_account", { p_registration_id: orderId, p_bank_name: bankName, p_account_number: accountNumber, p_account_holder_name: accountHolderName });
  if (result.error) {
    const message = result.error.message ?? "Rekening refund belum dapat disimpan";
    if (/not eligible|refund/i.test(message)) return fail(message, "REFUND_NOT_ELIGIBLE", 409);
    if (/sign in|owner/i.test(message)) return fail(message, "ORDER_FORBIDDEN", 403);
    return fail("Rekening refund belum dapat disimpan", "REFUND_ACCOUNT_FAILED", 500);
  }
  return NextResponse.json({ ok: true, bankAccountId: result.data });
}
