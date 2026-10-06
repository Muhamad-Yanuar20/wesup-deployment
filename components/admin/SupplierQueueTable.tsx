"use client";

import { useMemo, useState } from "react";
import { Check, X, MapPin, ExternalLink, Loader2, ImageOff } from "lucide-react";
import { cn } from "@/lib/utils";

export type SupplierQueueStatus = "pending" | "approved" | "rejected";

export type SupplierQueueItem = {
  id: string;
  name: string;
  email: string;
  address: string;
  locationPhotoUrl: string;
  registeredAt: string; // ISO date
  status: SupplierQueueStatus;
};

import { ConfirmDialog } from "@/components/feedback/ConfirmDialog";
import { feedbackError } from "@/lib/feedback/errors";

type SupplierQueueTableProps = {
  items: SupplierQueueItem[];
  onApprove?: (id: string) => Promise<void> | void;
  onReject?: (id: string, reason: string) => Promise<void> | void;
};

// Helper Format Public URL Supabase Storage
function resolvePhotoUrl(rawUrl: string | null | undefined): string {
  if (!rawUrl) return "/placeholder-store.png";
  if (rawUrl.startsWith("http://") || rawUrl.startsWith("https://")) {
    return rawUrl;
  }
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
  const cleanPath = rawUrl.startsWith("/") ? rawUrl.slice(1) : rawUrl;
  return `${supabaseUrl}/storage/v1/object/public/wesup-assets/${cleanPath}`;
}

function formatDate(iso: string) {
  if (!iso) return "-";
  return new Date(iso).toLocaleString("id-ID", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function StatusPill({ status }: { status: SupplierQueueStatus }) {
  const map: Record<SupplierQueueStatus, string> = {
    pending: "bg-amber-500/10 text-amber-700 ring-1 ring-inset ring-amber-500/30",
    approved: "bg-emerald-500/10 text-emerald-700 ring-1 ring-inset ring-emerald-500/30",
    rejected: "bg-rose-500/10 text-rose-700 ring-1 ring-inset ring-rose-500/30",
  };
  const label: Record<SupplierQueueStatus, string> = {
    pending: "Menunggu Survei",
    approved: "Disetujui",
    rejected: "Ditolak",
  };

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 font-mono text-[11px] font-medium",
        map[status]
      )}
    >
      <span className="h-1.5 w-1.5 rounded-full bg-current" />
      {label[status]}
    </span>
  );
}

function LocationImage({ photoUrl, alt }: { photoUrl: string; alt: string }) {
  const [error, setError] = useState(false);
  const resolved = resolvePhotoUrl(photoUrl);

  if (error || !photoUrl) {
    return (
      <div className="flex h-10 w-14 items-center justify-center rounded-md border border-[#e4e1da] bg-[#f4f2ec] text-[#8a8478]">
        <ImageOff className="h-4 w-4" />
      </div>
    );
  }

  return (
    <a
      href={resolved}
      target="_blank"
      rel="noreferrer"
      className="group flex items-center gap-1.5"
    >
      <img
        src={resolved}
        alt={alt}
        onError={() => setError(true)}
        className="h-10 w-14 rounded-md border border-[#e4e1da] object-cover"
      />
      <ExternalLink className="h-3 w-3 text-[#8a8478] opacity-0 transition-opacity group-hover:opacity-100" />
    </a>
  );
}

export function SupplierQueueTable({
  items,
  onApprove,
  onReject,
}: SupplierQueueTableProps) {
  const [approveTarget, setApproveTarget] = useState<SupplierQueueItem | null>(null);
  const [reason, setReason] = useState("");
  const [error, setError] = useState("");
  const [rejectTarget, setRejectTarget] = useState<SupplierQueueItem | null>(null);
  const [loadingId, setLoadingId] = useState<string | null>(null);

  const pendingCount = useMemo(
    () => items.filter((i) => i.status === "pending").length,
    [items]
  );

  async function handleApprove(item: SupplierQueueItem) {
    setLoadingId(item.id);
    try {
      await onApprove?.(item.id); setApproveTarget(null);
    } catch (e) { setError(feedbackError(e, "Hasil verifikasi belum terkonfirmasi. Periksa antrean sebelum mencoba lagi.")); } finally {
      setLoadingId(null);
    }
  }

  async function handleConfirmReject(reason: string) {
    if (!rejectTarget) return;
    setLoadingId(rejectTarget.id);
    try {
      await onReject?.(rejectTarget.id, reason); setRejectTarget(null);
    } catch (e) { setError(feedbackError(e, "Hasil verifikasi belum terkonfirmasi. Alasan Anda tetap tersedia.")); } finally {
      setLoadingId(null);
    }
  }

  return (
    <div className="rounded-lg border border-[#e4e1da] bg-white">
      <div className="flex items-center justify-between border-b border-[#e4e1da] px-5 py-3.5">
        <div>
          <h2 className="text-[14px] font-semibold text-[#1c2321]">
            Antrean Verifikasi Supplier
          </h2>
          <p className="text-[12px] text-[#8a8478]">
            Tinjau setelah survei fisik lokasi tempat usaha (mode MVP)
          </p>
        </div>
        <span className="rounded-full bg-[#1c2321] px-2.5 py-1 font-mono text-[11px] font-medium text-white">
          {pendingCount} menunggu
        </span>
      </div>

      {items.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-2 px-6 py-16 text-center">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#f2f0ea] text-[#8a8478]">
            <Check className="h-5 w-5" />
          </div>
          <p className="text-[13px] font-medium text-[#1c2321]">
            Tidak ada antrean saat ini
          </p>
          <p className="text-[12px] text-[#8a8478]">
            Supplier baru yang mendaftar akan muncul di sini.
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-left">
            <thead>
              <tr className="border-b border-[#e4e1da] bg-[#faf9f6]">
                <th className="px-5 py-2.5 font-mono text-[11px] font-medium uppercase tracking-wide text-[#8a8478]">
                  Supplier
                </th>
                <th className="px-5 py-2.5 font-mono text-[11px] font-medium uppercase tracking-wide text-[#8a8478]">
                  Alamat Tempat Usaha
                </th>
                <th className="px-5 py-2.5 font-mono text-[11px] font-medium uppercase tracking-wide text-[#8a8478]">
                  Foto Lokasi
                </th>
                <th className="px-5 py-2.5 font-mono text-[11px] font-medium uppercase tracking-wide text-[#8a8478]">
                  Terdaftar
                </th>
                <th className="px-5 py-2.5 font-mono text-[11px] font-medium uppercase tracking-wide text-[#8a8478]">
                  Status
                </th>
                <th className="px-5 py-2.5 text-right font-mono text-[11px] font-medium uppercase tracking-wide text-[#8a8478]">
                  Aksi
                </th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => {
                const isLoading = loadingId === item.id;
                const isPending = item.status === "pending";

                return (
                  <tr
                    key={item.id}
                    className="border-b border-[#efece5] last:border-0 hover:bg-[#faf9f6]"
                  >
                    <td className="px-5 py-3.5">
                      <p className="text-[13px] font-medium text-[#1c2321]">
                        {item.name}
                      </p>
                      <p className="text-[12px] text-[#8a8478]">{item.email}</p>
                    </td>

                    <td className="px-5 py-3.5">
                      <div className="flex max-w-[220px] items-start gap-1.5">
                        <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#8a8478]" />
                        <span className="text-[13px] text-[#4a453c]">
                          {item.address}
                        </span>
                      </div>
                    </td>

                    <td className="px-5 py-3.5">
                      <LocationImage
                        photoUrl={item.locationPhotoUrl}
                        alt={`Foto lokasi usaha ${item.name}`}
                      />
                    </td>

                    <td className="px-5 py-3.5">
                      <span className="font-mono text-[12px] text-[#6b6558]">
                        {formatDate(item.registeredAt)}
                      </span>
                    </td>

                    <td className="px-5 py-3.5">
                      <StatusPill status={item.status} />
                    </td>

                    <td className="px-5 py-3.5">
                      <div className="flex justify-end gap-2">
                        {isPending ? (
                          <>
                            <button
                              type="button"
                              disabled={isLoading}
                              onClick={() => { setError(""); setApproveTarget(item); }}
                              className="flex items-center gap-1.5 rounded-md bg-emerald-700 px-3 py-1.5 text-[12px] font-medium text-white transition-colors hover:bg-emerald-800 disabled:cursor-not-allowed disabled:opacity-50"
                            >
                              {isLoading ? (
                                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                              ) : (
                                <Check className="h-3.5 w-3.5" />
                              )}
                              Approve
                            </button>
                            <button
                              type="button"
                              disabled={isLoading}
                              onClick={() => { setError(""); setReason(""); setRejectTarget(item); }}
                              className="flex items-center gap-1.5 rounded-md border border-rose-200 bg-rose-50 px-3 py-1.5 text-[12px] font-medium text-rose-700 transition-colors hover:bg-rose-100 disabled:cursor-not-allowed disabled:opacity-50"
                            >
                              <X className="h-3.5 w-3.5" />
                              Reject
                            </button>
                          </>
                        ) : (
                          <span className="text-[12px] text-[#8a8478]">
                            Sudah diproses
                          </span>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <ConfirmDialog open={Boolean(approveTarget)} title="Setujui usaha ini?" description={`${approveTarget?.name ?? ""}. Supplier akan mendapat akses membuat penawaran setelah verifikasi disetujui.`} error={error} pending={Boolean(loadingId)} confirmLabel="Setujui Supplier" onConfirm={() => approveTarget && void handleApprove(approveTarget)} onCancel={() => setApproveTarget(null)} />
      <ConfirmDialog open={Boolean(rejectTarget)} title="Tolak pendaftaran Supplier?" description={`${rejectTarget?.name ?? ""}. Catatan berikut ditampilkan kepada Supplier.`} error={error} pending={Boolean(loadingId)} confirmLabel="Tolak Supplier" onConfirm={() => { if (reason.trim()) void handleConfirmReject(reason.trim()); else setError("Isi alasan penolakan terlebih dahulu."); }} onCancel={() => setRejectTarget(null)}><label className="block text-sm font-medium">Alasan penolakan<textarea autoFocus required value={reason} disabled={Boolean(loadingId)} onChange={e => setReason(e.target.value)} className="mt-2 w-full rounded-xl border border-slate-300 p-3" /></label></ConfirmDialog>
    </div>
  );
}