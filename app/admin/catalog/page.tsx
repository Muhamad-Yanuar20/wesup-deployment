"use client";

import { useEffect, useMemo, useState } from "react";
import { AdminSidebar } from "@/components/admin/AdminSidebar";
import { AdminHeader } from "@/components/admin/AdminHeader";
import { TakedownModal } from "@/components/admin/TakedownModal";
import {
  MapPin,
  AlertOctagon,
  CheckCircle2,
} from "lucide-react";

type CatalogItem = {
  id: string;
  title: string;
  supplierName: string;
  category: string;
  minQty: number;
  unit: string;
  status: string;
  pickupAddress?: string;
  createdAt?: string;
};

export default function AdminCatalogPage() {
  const [items, setItems] = useState<CatalogItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedBatch, setSelectedBatch] =
    useState<CatalogItem | null>(null);

  async function loadCatalog() {
    try {
      setLoading(true);

      const res = await fetch("/api/admin/catalog", {
        cache: "no-store",
      });

      if (res.ok) {
        const data: CatalogItem[] = await res.json();
        setItems(data);
      }
    } catch (err) {
      console.error("Gagal memuat katalog:", err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadCatalog();
  }, []);

  const totalActive = useMemo(
    () => items.filter((item) => item.status !== "takedown").length,
    [items]
  );

  async function handleConfirmTakedown(reason: string) {
    if (!selectedBatch) return;

    const res = await fetch(
      `/api/admin/batches/${selectedBatch.id}/takedown`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ reason }),
      }
    );

    if (res.ok) {
      setSelectedBatch(null);
      await loadCatalog();
    } else {
      alert("Gagal melakukan takedown katalog.");
    }
  }

  return (
    <div className="flex h-screen overflow-hidden bg-gray-50">
      {/* Sidebar - LOCKED */}
      <AdminSidebar />

      {/* Main Area */}
      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        {/* Header - LOCKED */}
        <AdminHeader
          title="Katalog Produk"
          description="Moderasi penawaran bahan baku sebelum atau selama masa pendaftaran (mode MVP)"
        />

        {/* ONLY THIS AREA SCROLLS */}
        <main className="min-h-0 flex-1 overflow-y-auto p-6">
          {/* Header Card */}
          <div className="mb-6 flex items-center justify-between rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
            <div>
              <h1 className="text-xl font-semibold text-gray-900">
                Katalog Produk Aktif
              </h1>

              <p className="mt-1 text-sm text-gray-500">
                Moderasi penawaran bahan baku sebelum atau selama
                masa pendaftaran (mode MVP)
              </p>
            </div>

            <div className="flex items-center gap-2 rounded-full bg-emerald-50 px-3 py-1.5 text-sm font-medium text-emerald-700">
              <CheckCircle2 className="h-4 w-4" />
              {totalActive} aktif
            </div>
          </div>

          {/* Table Area */}
          <div className="overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm">
            {loading ? (
              <div className="p-6 text-center text-sm text-gray-500">
                Memuat data katalog...
              </div>
            ) : items.length === 0 ? (
              <div className="p-10 text-center">
                <AlertOctagon className="mx-auto mb-3 h-8 w-8 text-gray-400" />

                <p className="text-sm text-gray-500">
                  Belum ada katalog produk yang terdaftar.
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[900px] text-left text-sm">
                  <thead className="border-b border-gray-200 bg-gray-50">
                    <tr>
                      <th className="px-4 py-3 text-xs font-semibold text-gray-600">
                        KATALOG & SUPPLIER
                      </th>

                      <th className="px-4 py-3 text-xs font-semibold text-gray-600">
                        KATEGORI
                      </th>

                      <th className="px-4 py-3 text-xs font-semibold text-gray-600">
                        MIN. PEMBELIAN
                      </th>

                      <th className="px-4 py-3 text-xs font-semibold text-gray-600">
                        STATUS
                      </th>

                      <th className="px-4 py-3 text-xs font-semibold text-gray-600">
                        AKSI
                      </th>
                    </tr>
                  </thead>

                  <tbody className="divide-y divide-gray-100">
                    {items.map((item) => (
                      <tr
                        key={item.id}
                        className="transition-colors hover:bg-gray-50"
                      >
                        <td className="px-4 py-4">
                          <div>
                            <p className="font-medium text-gray-900">
                              {item.title}
                            </p>

                            <div className="mt-1 flex items-center gap-1.5 text-xs text-gray-500">
                              <MapPin className="h-3.5 w-3.5" />
                              <span>{item.supplierName}</span>
                            </div>
                          </div>
                        </td>

                        <td className="px-4 py-4 text-gray-700">
                          {item.category || "Bahan Baku"}
                        </td>

                        <td className="px-4 py-4 text-gray-700">
                          {item.minQty || 1} {item.unit || "unit"}
                        </td>

                        <td className="px-4 py-4">
                          {item.status === "takedown" ? (
                            <span className="inline-flex items-center rounded-full bg-rose-50 px-2.5 py-1 text-xs font-medium text-rose-700">
                              Di-takedown
                            </span>
                          ) : (
                            <span className="inline-flex items-center rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700">
                              Aktif / Published
                            </span>
                          )}
                        </td>

                        <td className="px-4 py-4">
                          {item.status !== "takedown" ? (
                            <button
                              type="button"
                              onClick={() => setSelectedBatch(item)}
                              className="inline-flex items-center justify-center rounded-md bg-rose-700 px-3.5 py-1.5 text-xs font-medium text-white transition-colors hover:bg-rose-800 focus:outline-none focus:ring-2 focus:ring-rose-500/20"
                            >
                              Takedown
                            </button>
                          ) : (
                            <span className="text-xs text-gray-400">
                              Sudah diproses
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </main>
      </div>

      {selectedBatch && (
        <TakedownModal
          batchId={selectedBatch.id}
          batchTitle={selectedBatch.title}
          onCancel={() => setSelectedBatch(null)}
          onConfirm={handleConfirmTakedown}
        />
      )}
    </div>
  );
}