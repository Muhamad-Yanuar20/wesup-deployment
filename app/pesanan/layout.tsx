import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { getViewerAccessState, resolveHomePath, type AccessStateClient } from "@/lib/auth/access-state";
import { getServerClient } from "@/lib/supabase/server";
export const dynamic = "force-dynamic";
export default async function PesananLayout({ children }: { children: ReactNode }) {
 const client = await getServerClient();
 const access = await getViewerAccessState(client as unknown as AccessStateClient);
 if (!access) redirect("/login?role=umkm");
 if (access.role !== "umkm" || !["active", "suspended_temporary", "suspended_permanent"].includes(access.status)) redirect(resolveHomePath(access));
 return <>{children}</>;
}
