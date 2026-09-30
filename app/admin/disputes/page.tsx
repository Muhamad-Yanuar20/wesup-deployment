"use client";

import { useEffect, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  XCircle,
  RefreshCw,
  FileText,
  User,
  Store,
  ArrowLeftRight,
} from "lucide-react";
import { AdminSidebar } from "@/components/admin/AdminSidebar";
import { AdminHeader } from "@/components/admin/AdminHeader";

interface DisputeItem {
  id: string;
  batchTitle: string;
  amount: number;
  umkmName: string;
  umkmEmail: string;
  supplierName: string;
  supplierEmail: string;
  reason: string;
  evidenceUrls: string[];
  status: string;
  resolutionNotes: string | null;
  createdAt: string;
}

export default function AdminDisputesPage() {
  const [disputes, setDisputes] = useState<DisputeItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [processingId, setProcessingId] = useState<string | null>(null);

  const fetchDisputes = async () => {
    setLoading(true);

    try {
      const res = await fetch("/api/admin/disputes", {
        cache: "no-store",
      });

      if (!res.ok) {
        throw new Error(`HTTP Error: ${res.status}`);
      }

      const data = await res.json();
      setDisputes(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error("Gagal memuat data disputes:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDisputes();
  }, []);

  const handleResolve = async (
    id: string,
    decision: "resolved_refund" | "resolved_payout" | "rejected"
  ) => {
    const confirmText =
      decision === "resolved_refund"
        ? "Setujui pengembalian dana (Refund) ke UMKM?"
        : decision === "resolved_payout"
          ? "Selesaikan sengketa dan cairkan dana ke Supplier?"
          : "Tolak klaim sengketa dari UMKM?";

    if (!confirm(confirmText)) return;

    setProcessingId(id);

    try {
      const res = await fetch(`/api/admin/disputes/${id}/resolve`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          decision,
          notes: `Keputusan arbiter admin: ${decision}`,
        }),
      });

      if (res.ok) {
        alert("Keputusan sengketa berhasil diproses!");
        await fetchDisputes();
      } else {
        const errorData = await res.json().catch(() => ({}));

        alert(
          `Gagal memproses resolusi: ${
            errorData.error || "Terjadi kesalahan."
          }`
        );
      }
    } catch (err) {
      console.error("Gagal resolve dispute:", err);
      alert("Terjadi kesalahan koneksi server.");
    } finally {
      setProcessingId(null);
    }
  };

  return (
    <div className="flex h-screen overflow-hidden bg-[#f4f2ec]">
      {/* Sidebar kiri sama seperti page lainnya */}
      <AdminSidebar />

      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <AdminHeader
          title="Arbiter & Dispute Resolution"
          description="Kelola dan selesaikan sengketa transaksi antara UMKM dan Supplier."
        />

        {/* Hanya bagian ini yang bisa scroll */}
        <main className="min-h-0 flex-1 overflow-y-auto">
          <div className="p-8">
            {loading ? (
              <div className="flex min-h-[400px] items-center justify-center">
                <RefreshCw className="h-8 w-8 animate-spin text-gray-500" />
              </div>
            ) : disputes.length === 0 ? (
              <div className="rounded-2xl border border-gray-200 bg-white p-12 text-center shadow-sm">
                <CheckCircle2 className="mx-auto mb-4 h-12 w-12 text-green-500" />
                <h2 className="text-lg font-semibold text-gray-900">
                  Tidak Ada Sengketa
                </h2>
                <p className="mt-2 text-sm text-gray-500">
                  Saat ini tidak ada sengketa transaksi yang perlu ditangani.
                </p>
              </div>
            ) : (
              <div className="space-y-6">
                {disputes.map((item) => {
                  const isProcessing = processingId === item.id;
                  const isOpen =
                    item.status === "open" || item.status === "pending";

                  return (
                    <div
                      key={item.id}
                      className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm"
                    >
                      {/* Header */}
                      <div className="flex items-center justify-between border-b border-gray-100 p-6">
                        <div className="flex items-center gap-4">
                          <div className="rounded-xl bg-red-100 p-3">
                            <AlertTriangle className="h-6 w-6 text-red-600" />
                          </div>

                          <div>
                            <h2 className="text-lg font-bold text-gray-900">
                              {item.batchTitle}
                            </h2>

                            <p className="mt-1 text-sm text-gray-500">
                              Sengketa dibuat{" "}
                              {new Date(item.createdAt).toLocaleDateString(
                                "id-ID",
                                {
                                  day: "numeric",
                                  month: "long",
                                  year: "numeric",
                                }
                              )}
                            </p>
                          </div>
                        </div>

                        <span
                          className={`rounded-full px-3 py-1 text-xs font-semibold ${
                            isOpen
                              ? "bg-yellow-100 text-yellow-700"
                              : item.status === "resolved_refund"
                                ? "bg-blue-100 text-blue-700"
                                : item.status === "resolved_payout"
                                  ? "bg-green-100 text-green-700"
                                  : "bg-gray-100 text-gray-700"
                          }`}
                        >
                          {item.status.replaceAll("_", " ").toUpperCase()}
                        </span>
                      </div>

                      {/* Content */}
                      <div className="p-6">
                        <div className="mb-6 rounded-xl bg-gray-50 p-4">
                          <p className="text-sm text-gray-500">
                            Nilai Transaksi
                          </p>

                          <p className="mt-1 text-2xl font-bold text-gray-900">
                            Rp {Number(item.amount).toLocaleString("id-ID")}
                          </p>
                        </div>

                        <div className="grid gap-6 md:grid-cols-2">
                          {/* UMKM */}
                          <div className="rounded-xl border border-gray-200 p-5">
                            <div className="mb-3 flex items-center gap-2">
                              <User className="h-5 w-5 text-blue-600" />
                              <h3 className="font-semibold text-gray-900">
                                Pelapor UMKM
                              </h3>
                            </div>

                            <p className="font-medium text-gray-900">
                              {item.umkmName}
                            </p>

                            <p className="text-sm text-gray-500">
                              {item.umkmEmail}
                            </p>
                          </div>

                          {/* Supplier */}
                          <div className="rounded-xl border border-gray-200 p-5">
                            <div className="mb-3 flex items-center gap-2">
                              <Store className="h-5 w-5 text-purple-600" />
                              <h3 className="font-semibold text-gray-900">
                                Terlapor Supplier
                              </h3>
                            </div>

                            <p className="font-medium text-gray-900">
                              {item.supplierName}
                            </p>

                            <p className="text-sm text-gray-500">
                              {item.supplierEmail}
                            </p>
                          </div>
                        </div>

                        {/* Reason */}
                        <div className="mt-6">
                          <div className="mb-2 flex items-center gap-2">
                            <FileText className="h-5 w-5 text-gray-600" />
                            <h3 className="font-semibold text-gray-900">
                              Alasan Sengketa
                            </h3>
                          </div>

                          <div className="rounded-xl bg-gray-50 p-4 text-sm leading-6 text-gray-700">
                            {item.reason}
                          </div>
                        </div>

                        {/* Evidence */}
                        {item.evidenceUrls?.length > 0 && (
                          <div className="mt-6">
                            <h3 className="mb-3 font-semibold text-gray-900">
                              Bukti Pendukung
                            </h3>

                            <div className="flex flex-wrap gap-2">
                              {item.evidenceUrls.map((url, index) => (
                                <a
                                  key={url}
                                  href={url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-blue-600 hover:bg-blue-50"
                                >
                                  Bukti {index + 1}
                                </a>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Resolution */}
                        {!isOpen && item.resolutionNotes && (
                          <div className="mt-6 rounded-xl bg-gray-50 p-4">
                            <p className="mb-1 text-sm font-semibold text-gray-900">
                              Catatan Resolusi
                            </p>
                            <p className="text-sm text-gray-600">
                              {item.resolutionNotes}
                            </p>
                          </div>
                        )}

                        {/* Actions */}
                        {isOpen && (
                          <div className="mt-8 flex flex-wrap gap-3 border-t border-gray-100 pt-6">
                            <button
                              onClick={() =>
                                handleResolve(item.id, "resolved_refund")
                              }
                              disabled={isProcessing}
                              className="flex items-center gap-2 rounded-xl bg-blue-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
                            >
                              <CheckCircle2 className="h-4 w-4" />
                              Refund ke UMKM
                            </button>

                            <button
                              onClick={() =>
                                handleResolve(item.id, "resolved_payout")
                              }
                              disabled={isProcessing}
                              className="flex items-center gap-2 rounded-xl bg-green-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-green-700 disabled:cursor-not-allowed disabled:opacity-50"
                            >
                              <ArrowLeftRight className="h-4 w-4" />
                              Cairkan ke Supplier
                            </button>

                            <button
                              onClick={() =>
                                handleResolve(item.id, "rejected")
                              }
                              disabled={isProcessing}
                              className="flex items-center gap-2 rounded-xl border border-red-200 bg-white px-5 py-3 text-sm font-semibold text-red-600 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50"
                            >
                              <XCircle className="h-4 w-4" />
                              Tolak Sengketa
                            </button>

                            {isProcessing && (
                              <RefreshCw className="my-auto h-5 w-5 animate-spin text-gray-400" />
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}