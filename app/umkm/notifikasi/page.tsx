import type { Metadata } from "next";
import { Bell } from "lucide-react";
import { Layout } from "@/components/layout/Layout";
import { PageHeader } from "@/components/layout/PageHeader";
import { PageContainer } from "@/components/layout/PageContainer";
import NotificationCenterClient from "@/components/notifications/NotificationCenterClient";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Notifikasi UMKM | Wesup", description: "Pusat notifikasi aktivitas UMKM Anda di Wesup." };

export default function UmkmNotificationsPage() {
  return <Layout><PageContainer><PageHeader title="Notifikasi" description="Pengingat dan pembaruan aktivitas UMKM Anda di Wesup." icon={<Bell aria-hidden="true" className="h-6 w-6" />} /><NotificationCenterClient /></PageContainer></Layout>;
}
