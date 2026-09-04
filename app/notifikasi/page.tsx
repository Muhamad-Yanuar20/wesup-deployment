import type { Metadata } from "next";
import { Bell } from "lucide-react";
import { Layout } from "@/components/layout/Layout";
import NotificationCenterClient from "@/components/notifications/NotificationCenterClient";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Notifikasi | Wesup",
  description: "Pusat notifikasi dan pengingat aktivitas Anda di Wesup.",
};

export default function NotifikasiPage() {
  return (
    <Layout>
      <div className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
        <header className="mb-6">
          <h1 className="flex items-center gap-2 text-2xl font-extrabold tracking-tight text-slate-900 sm:text-3xl">
            <Bell className="text-blue-600" size={26} aria-hidden="true" />
            Notifikasi
          </h1>
          <p className="mt-1 text-base text-slate-600">
            Pengingat dan pembaruan aktivitas Anda di Wesup.
          </p>
        </header>
        <NotificationCenterClient />
      </div>
    </Layout>
  );
}