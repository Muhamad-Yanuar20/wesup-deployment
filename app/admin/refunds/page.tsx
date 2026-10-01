"use client";

import { useFeedbackResource } from "@/lib/feedback/use-resource";
import { AsyncButton } from "@/components/feedback";
import { AdminSidebar } from "@/components/admin/AdminSidebar";
import { AdminHeader } from "@/components/admin/AdminHeader";

type RefundItem = {
  id: string;
  umkmName: string;
  email: string;
  batchTitle: string;
  amount: number;
  reason: string;
  status: string;
};

export default function AdminRefundsPage() {
  const { data, loading, error: errorMessage, reload } = useFeedbackResource<RefundItem[]>("/api/admin/refunds?format=queue", "Antrean pengembalian dana belum dapat dimuat.");
  const refunds = data ?? [];

  function formatAmount(amount: number) {
    return `Rp ${Number(amount || 0).toLocaleString("id-ID")}`;
  }

  function getStatusClass(status: string) {
    switch (status.toLowerCase()) {
      case "pending":
        return "bg-amber-100 text-amber-700";

      case "approved":
      case "completed":
      case "success":
        return "bg-emerald-100 text-emerald-700";

      case "rejected":
      case "failed":
        return "bg-rose-100 text-rose-700";

      default:
        return "bg-gray-100 text-gray-700";
    }
  }

  return (
    <div className="wesup-app flex h-dvh flex-col md:flex-row overflow-hidden bg-slate-50">
      {/* Sidebar - LOCKED */}
      <AdminSidebar />

      {/* Main Area */}
      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        {/* Header - LOCKED */}
        <AdminHeader
          title="Daftar Pengembalian Dana"
          description="Kelola dan pantau antrean pengembalian dana dari transaksi yang terdampak."
        />

        {/* ONLY THIS AREA SCROLLS */}
        <main className="min-h-0 flex-1 overflow-y-auto">
          <div className="p-6">
            <div className="mb-6">
              <h1 className="text-2xl font-bold text-[#1c2321]">
                Daftar Pengembalian Dana
              </h1>

              <p className="mt-1 text-sm text-[#6b665d]">
                Kelola dan pantau antrean pengembalian dana dari
                transaksi yang terdampak.
              </p>
            </div>

            {loading ? (
              <div className="flex min-h-[300px] items-center justify-center rounded-xl border border-[#e4e1da] bg-white">
                <p className="text-sm text-[#6b665d]">
                  Memuat data refund...
                </p>
              </div>
            ) : errorMessage ? (
              <div className="rounded-xl border border-rose-200 bg-rose-50 p-5">
                <h2 className="text-sm font-semibold text-rose-700">
                  Gagal Memuat Data
                </h2>

                <p className="mt-1 text-sm text-rose-600">
                  {errorMessage}<AsyncButton onClick={() => void reload()}>Coba lagi</AsyncButton>
                </p>
              </div>
            ) : refunds.length === 0 ? (
              <div className="flex min-h-[300px] items-center justify-center rounded-xl border border-[#e4e1da] bg-white">
                <p className="text-sm text-[#6b665d]">
                  Tidak ada antrean refund saat ini.
                </p>
              </div>
            ) : (
              <div className="overflow-hidden rounded-xl border border-[#e4e1da] bg-white">
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[900px] border-collapse">
                    <thead>
                      <tr className="border-b border-[#e4e1da] bg-slate-50">
                        <th className="px-4 py-3 text-left text-[12px] font-semibold text-[#4a453c]">
                          UMKM
                        </th>

                        <th className="px-4 py-3 text-left text-[12px] font-semibold text-[#4a453c]">
                          Katalog Produk
                        </th>

                        <th className="px-4 py-3 text-right text-[12px] font-semibold text-[#4a453c]">
                          Jumlah Refund
                        </th>

                        <th className="px-4 py-3 text-left text-[12px] font-semibold text-[#4a453c]">
                          Alasan
                        </th>

                        <th className="px-4 py-3 text-center text-[12px] font-semibold text-[#4a453c]">
                          Status
                        </th>
                      </tr>
                    </thead>

                    <tbody>
                      {refunds.map((item) => (
                        <tr
                          key={item.id}
                          className="border-b border-[#eeeae2] last:border-b-0 hover:bg-slate-50/70"
                        >
                          <td className="px-4 py-4">
                            <div className="text-[13px] font-medium text-[#1c2321]">
                              {item.umkmName || "—"}
                            </div>

                            <div className="mt-0.5 text-[11px] text-[#8a847a]">
                              {item.email || "—"}
                            </div>
                          </td>

                          <td className="px-4 py-4 text-[13px] text-[#1c2321]">
                            {item.batchTitle || "—"}
                          </td>

                          <td className="px-4 py-4 text-right text-[13px] font-medium text-[#1c2321]">
                            {formatAmount(item.amount)}
                          </td>

                          <td className="max-w-[280px] px-4 py-4 text-[12px] leading-5 text-[#6b665d]">
                            {item.reason || "—"}
                          </td>

                          <td className="px-4 py-4 text-center">
                            <span
                              className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-medium ${getStatusClass(
                                item.status
                              )}`}
                            >
                              {item.status || "unknown"}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}
