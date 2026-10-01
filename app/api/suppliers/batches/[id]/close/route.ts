import { withRegistrationLock } from "@/lib/transactions/registration";
import { transactionError } from "@/lib/transactions/api";
import { NextResponse } from "next/server";
import { requireRole, toAuthResponse, type AuthClient } from "@/lib/supabase/auth";
import { getServerClient } from "@/lib/supabase/server";
import { isUuid, parseJsonBody } from "@/lib/admin/validation";

export const dynamic = "force-dynamic";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const client = await getServerClient();
  try { await requireRole(client as unknown as AuthClient, ["supplier", "admin"]); } catch (error) { return toAuthResponse(error); }
  const { id } = await params;
  if (!isUuid(id)) return NextResponse.json({ error: "Batch tidak ditemukan.", code: "BATCH_NOT_FOUND" }, { status: 404 });
  const body = await parseJsonBody(request);
  if (body && "supplierId" in body) return NextResponse.json({ error: "supplierId tidak boleh dikirim.", code: "BATCH_INVALID" }, { status: 400 });
  try {
    const result = await withRegistrationLock(id, async () => {
      if (!body?.confirmation) {
        const context = await (client as unknown as import("@/lib/transactions/api").TransactionRpcClient).rpc("get_early_payment_context", { p_batch_id: id });
        if (context.error) throw context.error;
        const early = context.data as { minimumQuantity?: number | null; proposal?: { status?: string } } | null;
        if (early?.minimumQuantity != null || ["pending", "rejected"].includes(early?.proposal?.status ?? "")) return { data: null, error: { code: "22023", message: "Periksa ringkasan volume dan harga sebelum membuka pembayaran." } };
      }
      const args = { p_batch_id: id, p_ip_address: request.headers.get("x-forwarded-for"), p_user_agent: request.headers.get("user-agent") };
      return body?.confirmation
        ? (client as unknown as import("@/lib/transactions/api").TransactionRpcClient).rpc("confirm_early_payment_close", { ...args, p_confirmation: body.confirmation })
        : (client as unknown as import("@/lib/transactions/api").TransactionRpcClient).rpc("close_batch_and_issue_invoices", { ...args, p_trigger: "supplier_manual" });
    });
    if (result.error) return transactionError(result.error, "Jumlah, harga, atau usulan berubah. Muat ulang transaksi dan periksa ringkasan terbaru.");
    return NextResponse.json({ ok: true, item: result.data });
  } catch (error) { return transactionError(error, "Jumlah, harga, atau usulan berubah. Muat ulang transaksi dan periksa ringkasan terbaru."); }
}
