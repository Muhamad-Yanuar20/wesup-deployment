import { NextResponse } from "next/server";
import { requireRole, toAuthResponse, type AuthClient } from "@/lib/supabase/auth";
import { getServerClient } from "@/lib/supabase/server";
import { isUuid, parseJsonBody } from "@/lib/admin/validation";

export const dynamic = "force-dynamic";

function mapError(error: unknown) {
  const code = typeof error === "object" && error !== null && "code" in error ? String((error as { code?: unknown }).code ?? "") : "";
  const message = typeof error === "object" && error !== null && "message" in error ? String((error as { message?: unknown }).message ?? "") : "";
  if (code === "P0002" || code === "42501") return NextResponse.json({ error: "Batch tidak ditemukan.", code: "BATCH_NOT_FOUND" }, { status: 404 });
  if (code === "22023") return NextResponse.json({ error: message || "Data penutupan batch tidak valid.", code: "BATCH_INVALID" }, { status: 400 });
  if (code === "55000") return NextResponse.json({ error: message || "Batch belum memenuhi syarat untuk ditutup.", code: /minimum/i.test(message) ? "MINIMUM_NOT_REACHED" : "BATCH_STATE_CONFLICT" }, { status: 409 });
  return NextResponse.json({ error: "Batch belum dapat ditutup.", code: "BATCH_CLOSE_FAILED" }, { status: 500 });
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const client = await getServerClient();
  try { await requireRole(client as unknown as AuthClient, ["supplier", "admin"]); } catch (error) { return toAuthResponse(error); }
  const { id } = await params;
  if (!isUuid(id)) return NextResponse.json({ error: "Batch tidak ditemukan.", code: "BATCH_NOT_FOUND" }, { status: 404 });
  const body = await parseJsonBody(request);
  if (body && "supplierId" in body) return NextResponse.json({ error: "supplierId tidak boleh dikirim.", code: "BATCH_INVALID" }, { status: 400 });
  try {
    const rpc = (client as unknown as { rpc: (name: string, args: Record<string, unknown>) => PromiseLike<{ data: unknown; error: unknown }> }).rpc;
    const result = await rpc("close_batch_and_issue_invoices", { p_batch_id: id, p_trigger: "supplier_manual", p_ip_address: request.headers.get("x-forwarded-for"), p_user_agent: request.headers.get("user-agent") });
    if (result.error) return mapError(result.error);
    return NextResponse.json({ ok: true, item: result.data });
  } catch (error) { return mapError(error); }
}
