import { requireRole, toAuthResponse, type AuthClient } from "@/lib/supabase/auth";
import { getServerClient } from "@/lib/supabase/server";
import { enforceRateLimit } from "@/lib/rate-limit";
export async function authorizeAdminQueue(request: Request) {
  const client = await getServerClient();
  try {
    const auth = await requireRole(client as unknown as AuthClient, ["admin"]);
    return await enforceRateLimit(request, "admin", auth.userId);
  } catch (error) { return toAuthResponse(error); }
}
