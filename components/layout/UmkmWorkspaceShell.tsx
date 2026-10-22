"use client";
import type { ReactNode } from "react";
import { usePathname } from "next/navigation";
import { Layout } from "./Layout";
import { Alert } from "@/components/feedback";
export default function UmkmWorkspaceShell({
  children,
  suspended,
  brandHref = null,
}: {
  children: ReactNode;
  suspended: boolean;
  brandHref?: string | null;
}) {
  const onboarding = usePathname() === "/umkm/onboarding";
  const warning = suspended ? (
    <Alert tone="warning">
      Akun Anda ditangguhkan. Pesanan, pemeriksaan pembayaran, dan bantuan tetap dapat diakses. Transaksi baru belum tersedia.
    </Alert>
  ) : null;
  return onboarding ? (
    <div className="wesup-app">
      {warning}
      {children}
    </div>
  ) : (
    <Layout brandHref={brandHref}>
      {warning}
      {children}
    </Layout>
  );
}
