import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import {
  getViewerAccessState,
  requireApprovedSupplier,
  resolveHomePath,
  type AccessStateClient,
} from "@/lib/auth/access-state";
import { AuthError } from "@/lib/supabase/auth";
import { getServerClient } from "@/lib/supabase/server";
import { NavigationBar } from "@/components/layout/NavigationBar";
import { Footer } from "@/components/layout/Footer";

export const dynamic = "force-dynamic";

export default async function SupplierDashboardLayout({
  children,
}: {
  children: ReactNode;
}) {
  const client = await getServerClient();

  try {
    await requireApprovedSupplier(client as unknown as AccessStateClient);
  } catch (err) {
    if (err instanceof AuthError && err.status === 401) {
      redirect("/login?role=supplier");
    }

    const accessState = await getViewerAccessState(client as unknown as AccessStateClient);
    if (
      accessState?.role === "supplier" &&
      accessState.status === "active" &&
      accessState.verificationStatus !== "approved"
    ) {
      redirect("/supplier/status");
    }
    redirect(accessState ? resolveHomePath(accessState) : "/login?role=supplier");
  }

  return <div className="wesup-app flex min-h-dvh flex-col bg-wesup-paper text-wesup-ink"><a href="#main-content" className="sr-only z-50 bg-wesup-ink px-4 py-3 text-wesup-paper focus:not-sr-only focus:fixed focus:left-4 focus:top-4">Lewati ke konten utama</a><NavigationBar brandHref={null} /><main id="main-content" className="app-main min-w-0 flex-1">{children}</main><Footer variant="brand-only" /></div>;
}
