import type { Metadata } from "next";
import { ShoppingBag } from "lucide-react";
import { Layout } from "@/components/layout/Layout";
import OrderCenterClient from "@/components/orders/OrderCenterClient";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Pesanan | Wesup",
  description: "Kelola pesanan Anda di Wesup.",
};

export default function PesananPage() {
  return (
    <Layout>
      <div className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
        <header className="mb-6">
          <h1 className="flex items-center gap-2 text-2xl font-extrabold tracking-tight text-slate-900 sm:text-3xl">
            <ShoppingBag className="text-blue-600" size={26} aria-hidden="true" />
            Pesanan
          </h1>
          <p className="mt-1 text-base text-slate-600">
            Status, pembayaran, dan serah terima dari semua batch yang Anda ikuti.
          </p>
        </header>
        <OrderCenterClient />
      </div>
    </Layout>
  );
}