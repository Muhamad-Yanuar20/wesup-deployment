import { NextResponse } from "next/server";
import { getAccessStateForUser, resolveHomePath, type AccessStateClient } from "@/lib/auth/access-state";
import { getCurrentUser, toAuthResponse, type AuthClient } from "@/lib/supabase/auth";
import { getServerClient } from "@/lib/supabase/server";
import { RequestTiming } from "@/lib/performance/server-timing";
export const dynamic = "force-dynamic";
export async function GET() {
  const timing = new RequestTiming("auth/session");
  try {
    const client = await getServerClient();
    const context = await getCurrentUser(client as unknown as AuthClient, timing);
    if (!context) return timing.finish(NextResponse.json({ error: "Sign in required" }, { status: 401 }));
    if (context.status !== "active") return timing.finish(NextResponse.json({ error: `Account is ${context.status}`, reason: context.status }, { status: 403 }));
    const accessState = await timing.measure("access", () => getAccessStateForUser(client as unknown as AccessStateClient, context));
    return timing.finish(NextResponse.json({ user: { email: context.email }, profile: { role: context.role, status: context.status, full_name: context.fullName }, accessState, homePath: resolveHomePath(accessState) }));
  } catch (error) { return timing.finish(toAuthResponse(error)); }
}
