import { NextResponse } from "next/server";
import { requireRole, toAuthResponse, type AuthClient } from "@/lib/supabase/auth";
import { getServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function GET() {
  const client = await getServerClient();
  try { await requireRole(client as unknown as AuthClient, ["supplier"]); } catch (error) { return toAuthResponse(error); }
  const result = await (client as unknown as { rpc: (name: string, args?: Record<string, unknown>) => PromiseLike<{ data: unknown; error: unknown }> }).rpc("get_supplier_finance", {});
  if (result.error) return NextResponse.json({ error: "Ringkasan keuangan belum dapat dimuat.", code: "SUPPLIER_FINANCE_READ_FAILED" }, { status: 500 });
  return NextResponse.json({ item: result.data });
}
