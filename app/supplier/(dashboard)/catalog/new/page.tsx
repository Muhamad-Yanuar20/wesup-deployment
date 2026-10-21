import type { Metadata } from "next";
import { CatalogForm } from "@/components/supplier/catalog/CatalogForm";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Buat Penawaran | Wesup",
  description: "Buat katalog penawaran bahan baku baru untuk grup pembelian Wesup.",
};

export default function SupplierCatalogNewPage() {
  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-8 sm:px-6 sm:py-10 lg:px-8">
      <CatalogForm mode="create" />
    </div>
  );
}
