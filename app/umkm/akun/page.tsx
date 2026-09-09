import type { Metadata } from "next";
import Link from "next/link";
import { User } from "lucide-react";
import { Layout } from "@/components/layout/Layout";
import { PageHeader } from "@/components/layout/PageHeader";
import { PageContainer } from "@/components/layout/PageContainer";
import AccountCenterClient from "@/components/account/AccountCenterClient";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Akun UMKM | Wesup", description: "Kelola profil dan pengaturan akun UMKM Anda di Wesup." };

export default function UmkmAccountPage() {
  return <Layout><PageContainer><PageHeader title="Akun" description="Profil, data usaha, keamanan, dan pengaturan akun Anda." icon={<User aria-hidden="true" className="h-6 w-6" />} /><Link href="/umkm/onboarding" className="mb-6 inline-flex min-h-11 items-center rounded-lg bg-blue-700 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2">Lengkapi profil usaha</Link><AccountCenterClient /></PageContainer></Layout>;
}
