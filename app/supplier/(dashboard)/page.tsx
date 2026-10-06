import OfferDraftList from "@/components/supplier/catalog/OfferDraftList";
import type { Metadata } from "next";
import SupplierDashboard from "@/components/supplier/dashboard/SupplierDashboard";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Dasbor Pemasok | Wesup",
  description: "Kelola penawaran, pesanan, dan aktivitas pemasok Anda di Wesup.",
};

export default function SupplierDashboardPage() {
  return (
    <main className="min-h-screen bg-gradient-to-b from-blue-50/60 via-slate-50 to-white px-4 py-6 pb-10 sm:px-6 sm:py-9 lg:px-8">
      <div className="mx-auto w-full max-w-6xl">
        <OfferDraftList /><SupplierDashboard />
      </div>
    </main>
  );
}
