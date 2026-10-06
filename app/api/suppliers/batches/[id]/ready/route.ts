import { NextResponse } from "next/server";
import { requireRole, toAuthResponse, type AuthClient } from "@/lib/supabase/auth";
import { getServerClient } from "@/lib/supabase/server";
import { isUuid } from "@/lib/admin/validation";

export const dynamic = "force-dynamic";

export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const client = await getServerClient();
  try { await requireRole(client as unknown as AuthClient, ["supplier", "admin"]); } catch (error) { return toAuthResponse(error); }
  const { id } = await params;
  if (!isUuid(id)) return NextResponse.json({ error: "Batch tidak ditemukan.", code: "BATCH_NOT_FOUND" }, { status: 404 });
  const rpcClient = client as unknown as { rpc: (name: string, args: Record<string, unknown>) => PromiseLike<{ error: unknown }> };
  const result = await rpcClient.rpc("mark_supplier_batch_ready", { p_batch_id: id });
  if (result.error) {
    const code = typeof result.error === "object" && result.error !== null && "code" in result.error ? String((result.error as { code?: unknown }).code ?? "") : "";
    if (code === "P0002" || code === "42501") return NextResponse.json({ error: "Batch tidak ditemukan.", code: "BATCH_NOT_FOUND" }, { status: 404 });
    if (code === "55000") return NextResponse.json({ error: "Batch belum tertutup atau tidak siap ditandai.", code: "BATCH_STATE_CONFLICT" }, { status: 409 });
    return NextResponse.json({ error: "Batch belum dapat ditandai siap.", code: "BATCH_READY_FAILED" }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
