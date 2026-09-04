import type { Metadata } from "next";
import { User } from "lucide-react";
import { Layout } from "@/components/layout/Layout";
import AccountCenterClient from "@/components/account/AccountCenterClient";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Akun | Wesup",
  description: "Kelola profil dan pengaturan akun Anda di Wesup.",
};

export default function AkunPage() {
  return (
    <Layout>
      <div className="mx-auto w-full max-w-3xl px-4 py-8 sm:px-6 lg:px-8">
        <header className="mb-6">
          <h1 className="flex items-center gap-2 text-2xl font-extrabold tracking-tight text-slate-900 sm:text-3xl">
            <User className="text-blue-600" size={26} aria-hidden="true" />
            Akun
          </h1>
          <p className="mt-1 text-base text-slate-600">
            Profil, keamanan, dan pengaturan akun Anda.
          </p>
        </header>
        <AccountCenterClient />
      </div>
    </Layout>
  );
}