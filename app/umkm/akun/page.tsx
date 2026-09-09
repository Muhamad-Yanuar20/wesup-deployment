import type { Metadata } from "next";
import { User } from "lucide-react";
import { Layout } from "@/components/layout/Layout";
import { PageHeader } from "@/components/layout/PageHeader";
import { PageContainer } from "@/components/layout/PageContainer";
import AccountCenterClient from "@/components/account/AccountCenterClient";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Akun UMKM | Wesup", description: "Kelola profil dan pengaturan akun UMKM Anda di Wesup." };

export default function UmkmAccountPage() {
  return <Layout><PageContainer><PageHeader title="Akun" description="Profil, data usaha, keamanan, dan pengaturan akun Anda." icon={<User aria-hidden="true" className="h-6 w-6" />} /><AccountCenterClient /></PageContainer></Layout>;
}
