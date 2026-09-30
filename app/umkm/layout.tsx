import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { getViewerAccessState, resolveHomePath, type AccessStateClient } from "@/lib/auth/access-state";
import { getServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function UmkmLayout({ children }: { children: ReactNode }) {
  const client = await getServerClient();
  const accessState = await getViewerAccessState(client as unknown as AccessStateClient);

  if (!accessState) redirect("/login?role=umkm");
  if (accessState.role !== "umkm" || accessState.status !== "active") {
    redirect(resolveHomePath(accessState));
  }

  return children;
}
