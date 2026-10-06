"use client";

import { useMemo, useState } from "react";
import {
  Wallet,
  ExternalLink,
  Loader2,
  Info,
  CheckCircle2,
} from "lucide-react";
import { cn } from "@/lib/utils";

export type RefundStatus =
  | "pending"
  | "waiting_bank_account"
  | "processing"
  | "completed"
  | "failed";

export type RefundTriggerType =
  | "supplier_cancel"
  | "admin_takedown"
  | "dispute_won"
  | string;

export type RefundQueueItem = {
  id: string;
  registrationId: string;
  batchId: string;
  batchTitle: string;
  umkmName: string;
  quantity: number;
  amount: number;
  triggerType: RefundTriggerType;
  status: RefundStatus;
  umkmBankAccountId: string | null;
  adminNotes: string | null;
  transferProofUrl: string | null;
  requestedAt: string;
  processedAt: string | null;
  completedAt: string | null;
};

type RefundQueueTableProps = {
  items: RefundQueueItem[];
  onMarkCompleted?: (id: string, transferProofUrl: string) => Promise<void> | void;
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatCurrency(amount: number) {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(amount);
}

function formatDate(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("id-ID", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

const TRIGGER_LABEL: Record<string, string> = {
  supplier_cancel: "Katalog Dibatalkan Supplier",
  admin_takedown: "Takedown Admin",
  dispute_won: "Menang Sengketa",
};

function triggerLabel(trigger: RefundTriggerType) {
  return TRIGGER_LABEL[trigger] ?? trigger;
}

const STATUS_STYLE: Record<RefundStatus, string> = {
  pending: "bg-slate-500/10 text-slate-600 ring-1 ring-inset ring-slate-500/25",
  waiting_bank_account:
    "bg-orange-500/10 text-orange-700 ring-1 ring-inset ring-orange-500/25",
  processing: "bg-amber-500/10 text-amber-700 ring-1 ring-inset ring-amber-500/30",
  completed: "bg-emerald-500/10 text-emerald-700 ring-1 ring-inset ring-emerald-500/30",
  failed: "bg-rose-500/10 text-rose-700 ring-1 ring-inset ring-rose-500/30",
};

const STATUS_LABEL: Record<RefundStatus, string> = {
  pending: "Pending",
  waiting_bank_account: "Menunggu Rekening",
  processing: "Diproses",
  completed: "Selesai",
  failed: "Gagal",
};

function StatusPill({ status }: { status: RefundStatus }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 font-mono text-[11px] font-medium",
        STATUS_STYLE[status]
      )}
    >
      <span className="h-1.5 w-1.5 rounded-full bg-current" />
      {STATUS_LABEL[status]}
    </span>
  );
}

function ConfirmRefundModal({
  item,
  onCancel,
  onConfirm,
}: {
  item: RefundQueueItem;
  onCancel: () => void;
  onConfirm: (transferProofUrl: string) => void;
}) {
  const [transferProofUrl, setTransferProofUrl] = useState("");
  const trimmed = transferProofUrl.trim();

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#1c2321]/50 px-4">
      <div className="w-full max-w-md rounded-lg border border-[#e4e1da] bg-white p-5 shadow-xl">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-md bg-emerald-500/10 text-emerald-700">
            <Wallet className="h-4 w-4" />
          </div>
          <h2 className="text-[15px] font-semibold text-[#1c2321]">
            Konfirmasi Refund Selesai
          </h2>
        </div>

        <p className="mt-3 text-[13px] text-[#6b6558]">
          Menandai refund untuk{" "}
          <span className="font-medium text-[#1c2321]">{item.umkmName}</span>{" "}
          (batch: {item.batchTitle}) sebesar{" "}
          <span className="font-mono font-medium text-[#1c2321]">
            {formatCurrency(item.amount)}
          </span>{" "}
          sebagai selesai.
        </p>

        {!item.umkmBankAccountId ? (
          <div className="mt-3 flex items-start gap-2 rounded-md border border-orange-200 bg-orange-50 px-3 py-2.5 text-[12px] text-orange-800">
            <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            UMKM belum mengisi rekening tujuan. Refund tidak seharusnya
            ditandai selesai sebelum ada rekening.
          </div>
        ) : (
          <div className="mt-3 rounded-md border border-[#e4e1da] bg-[#faf9f6] px-3 py-2.5">
            <p className="font-mono text-[12px] text-[#8a8478]">
              ID Rekening: {item.umkmBankAccountId}
            </p>
            <p className="mt-1 text-[11px] text-[#8a8478]">
              Detail nomor rekening &amp; nama bank belum tersedia di panel ini
              — cek manual di tabel <code>bank_accounts</code> Supabase
              sebelum transfer.
            </p>
          </div>
        )}

        <label className="mt-4 block text-[12px] font-medium text-[#4a453c]">
          Link bukti transfer (transfer_proof_url)
        </label>
        <input
          type="text"
          value={transferProofUrl}
          onChange={(e) => setTransferProofUrl(e.target.value)}
          placeholder="https://... (screenshot/referensi bukti transfer)"
          className="mt-1.5 w-full rounded-md border border-[#e4e1da] bg-[#faf9f6] px-3 py-2 text-[13px] text-[#1c2321] outline-none focus:border-[#1c2321] focus:ring-1 focus:ring-[#1c2321]"
        />
        <p className="mt-1.5 flex items-start gap-1.5 text-[11px] text-[#8a8478]">
          <Info className="mt-0.5 h-3 w-3 shrink-0" />
          Tersimpan ke kolom <code>transfer_proof_url</code> sebagai audit trail.
        </p>

        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="rounded-md px-3.5 py-2 text-[13px] font-medium text-[#4a453c] transition-colors hover:bg-[#f2f0ea]"
          >
            Batal
          </button>
          <button
            type="button"
            disabled={!trimmed}
            onClick={() => onConfirm(trimmed)}
            className="flex items-center gap-1.5 rounded-md bg-emerald-700 px-3.5 py-2 text-[13px] font-medium text-white transition-colors hover:bg-emerald-800 disabled:cursor-not-allowed disabled:opacity-40"
          >
            <CheckCircle2 className="h-3.5 w-3.5" />
            Tandai Selesai
          </button>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main table
// ---------------------------------------------------------------------------

export function RefundQueueTable({ items, onMarkCompleted }: RefundQueueTableProps) {
  const [confirmTarget, setConfirmTarget] = useState<RefundQueueItem | null>(null);
  const [loadingId, setLoadingId] = useState<string | null>(null);

  const pendingCount = useMemo(
    () => items.filter((i) => i.status !== "completed").length,
    [items]
  );

  async function handleConfirm(transferProofUrl: string) {
    if (!confirmTarget) return;
    setLoadingId(confirmTarget.id);
    try {
      await onMarkCompleted?.(confirmTarget.id, transferProofUrl);
    } finally {
      setLoadingId(null);
      setConfirmTarget(null);
    }
  }

  return (
    <div className="rounded-lg border border-[#e4e1da] bg-white">
      <div className="flex items-center justify-between border-b border-[#e4e1da] px-5 py-3.5">
        <div>
          <h2 className="text-[14px] font-semibold text-[#1c2321]">
            Antrean Refund Manual
          </h2>
          <p className="text-[12px] text-[#8a8478]">
            Refund akibat katalog dibatalkan Supplier, takedown Admin, atau sengketa dimenangkan UMKM
          </p>
        </div>
        <span className="rounded-full bg-[#1c2321] px-2.5 py-1 font-mono text-[11px] font-medium text-white">
          {pendingCount} belum selesai
        </span>
      </div>

      {items.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-2 px-6 py-16 text-center">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#f2f0ea] text-[#8a8478]">
            <Wallet className="h-5 w-5" />
          </div>
          <p className="text-[13px] font-medium text-[#1c2321]">
            Tidak ada antrean refund saat ini
          </p>
          <p className="text-[12px] text-[#8a8478]">
            Refund akan muncul di sini setelah katalog dibatalkan atau sengketa selesai.
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-left">
            <thead>
              <tr className="border-b border-[#e4e1da] bg-[#faf9f6]">
                <th className="px-5 py-2.5 font-mono text-[11px] font-medium uppercase tracking-wide text-[#8a8478]">
                  Batch / Diminta
                </th>
                <th className="px-5 py-2.5 font-mono text-[11px] font-medium uppercase tracking-wide text-[#8a8478]">
                  UMKM
                </th>
                <th className="px-5 py-2.5 font-mono text-[11px] font-medium uppercase tracking-wide text-[#8a8478]">
                  Jumlah
                </th>
                <th className="px-5 py-2.5 font-mono text-[11px] font-medium uppercase tracking-wide text-[#8a8478]">
                  Alasan
                </th>
                <th className="px-5 py-2.5 font-mono text-[11px] font-medium uppercase tracking-wide text-[#8a8478]">
                  Rekening
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
                const canComplete =
                  (item.status === "processing" || item.status === "pending") &&
                  Boolean(item.umkmBankAccountId);

                return (
                  <tr
                    key={item.id}
                    className="border-b border-[#efece5] last:border-0 hover:bg-[#faf9f6]"
                  >
                    <td className="px-5 py-3.5">
                      <p className="text-[13px] font-medium text-[#1c2321]">
                        {item.batchTitle}
                      </p>
                      <p className="mt-0.5 font-mono text-[11px] text-[#8a8478]">
                        {formatDate(item.requestedAt)}
                      </p>
                    </td>

                    <td className="px-5 py-3.5">
                      <p className="text-[13px] font-medium text-[#1c2321]">
                        {item.umkmName}
                      </p>
                      <p className="text-[12px] text-[#8a8478]">
                        Qty: {item.quantity}
                      </p>
                    </td>

                    <td className="px-5 py-3.5">
                      <span className="font-mono text-[13px] font-medium text-[#1c2321]">
                        {formatCurrency(item.amount)}
                      </span>
                    </td>

                    <td className="px-5 py-3.5">
                      <span className="inline-flex rounded-full bg-slate-500/10 px-2.5 py-1 font-mono text-[11px] font-medium text-slate-700 ring-1 ring-inset ring-slate-500/25">
                        {triggerLabel(item.triggerType)}
                      </span>
                    </td>

                    <td className="px-5 py-3.5">
                      {item.umkmBankAccountId ? (
                        <span className="font-mono text-[11px] text-[#8a8478]">
                          {item.umkmBankAccountId.slice(0, 8)}…
                        </span>
                      ) : (
                        <span className="flex items-center gap-1.5 text-[12px] text-[#8a8478]">
                          <Info className="h-3.5 w-3.5" />
                          Belum diisi
                        </span>
                      )}
                    </td>

                    <td className="px-5 py-3.5">
                      <StatusPill status={item.status} />
                    </td>

                    <td className="px-5 py-3.5">
                      <div className="flex justify-end">
                        {item.status === "completed" ? (
                          item.transferProofUrl ? (
                            <a
                              href={item.transferProofUrl}
                              target="_blank"
                              rel="noreferrer"
                              className="flex items-center gap-1.5 text-[12px] text-[#4a453c] hover:underline"
                            >
                              <ExternalLink className="h-3 w-3" />
                              Lihat bukti
                            </a>
                          ) : (
                            <span className="text-[12px] text-[#8a8478]">Selesai</span>
                          )
                        ) : (
                          <button
                            type="button"
                            disabled={!canComplete || isLoading}
                            onClick={() => setConfirmTarget(item)}
                            title={
                              !item.umkmBankAccountId
                                ? "UMKM belum mengisi rekening tujuan"
                                : undefined
                            }
                            className="flex items-center gap-1.5 rounded-md bg-emerald-700 px-3 py-1.5 text-[12px] font-medium text-white transition-colors hover:bg-emerald-800 disabled:cursor-not-allowed disabled:opacity-40"
                          >
                            {isLoading ? (
                              <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            ) : (
                              <CheckCircle2 className="h-3.5 w-3.5" />
                            )}
                            Tandai Selesai
                          </button>
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

      {confirmTarget ? (
        <ConfirmRefundModal
          item={confirmTarget}
          onCancel={() => setConfirmTarget(null)}
          onConfirm={handleConfirm}
        />
      ) : null}
    </div>
  );
}