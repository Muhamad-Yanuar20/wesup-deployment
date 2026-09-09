import type { Metadata } from "next";
import { ShoppingBag } from "lucide-react";
import { Layout } from "@/components/layout/Layout";
import { PageHeader } from "@/components/layout/PageHeader";
import { PageContainer } from "@/components/layout/PageContainer";
import OrderCenterClient from "@/components/orders/OrderCenterClient";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Pesanan UMKM | Wesup", description: "Kelola pesanan batch UMKM Anda di Wesup." };

export default function UmkmOrdersPage() {
  return <Layout><PageContainer><PageHeader title="Pesanan" description="Status, pembayaran, dan serah terima dari batch yang Anda ikuti." icon={<ShoppingBag aria-hidden="true" className="h-6 w-6" />} /><OrderCenterClient viewerRole="umkm" /></PageContainer></Layout>;
}
