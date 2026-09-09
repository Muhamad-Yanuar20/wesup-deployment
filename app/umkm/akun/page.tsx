import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { User } from "lucide-react";
import { Layout } from "@/components/layout/Layout";
import { PageHeader } from "@/components/layout/PageHeader";
import { PageContainer } from "@/components/layout/PageContainer";
import { getCurrentUser, type AuthClient } from "@/lib/supabase/auth";
import { getServerClient } from "@/lib/supabase/server";
import UmkmAccountClient from "@/components/umkm/UmkmAccountClient";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Akun UMKM | Wesup", description: "Kelola profil dan pengaturan akun UMKM Anda di Wesup." };

export default async function UmkmAccountPage() {
  const client = await getServerClient();
  const viewer = await getCurrentUser(client as unknown as AuthClient);
  if (!viewer) redirect("/login?role=umkm&returnTo=/umkm/akun");
  return <Layout><PageContainer><PageHeader title="Akun" description="Profil dan data usaha Anda di Wesup." icon={<User aria-hidden="true" className="h-6 w-6" />} /><UmkmAccountClient fullName={viewer.fullName} email={viewer.email} /></PageContainer></Layout>;
}