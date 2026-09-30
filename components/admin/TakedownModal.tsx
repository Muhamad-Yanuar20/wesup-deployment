"use client";

import { useState } from "react";
import { AlertTriangle, X, Loader2 } from "lucide-react";

type TakedownModalProps = {
  batchId: string;
  batchTitle: string;
  onCancel: () => void;
  onConfirm: (reason: string) => Promise<void>;
};

export function TakedownModal({
  batchTitle,
  onCancel,
  onConfirm,
}: TakedownModalProps) {
  const [reason, setReason] = useState("");
  const [isConfirmed, setIsConfirmed] = useState(false);
  const [loading, setLoading] = useState(false);

  const trimmedReason = reason.trim();

  // Alasan minimal 5 karakter + checkbox harus dicentang
  const isValid = trimmedReason.length >= 5 && isConfirmed;

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();

    if (!isValid || loading) return;

    setLoading(true);

    try {
      await onConfirm(trimmedReason);
    } catch (error) {
      console.error("Gagal melakukan takedown:", error);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-md overflow-hidden rounded-lg bg-white shadow-xl">
        {/* Header */}
        <div className="flex items-start justify-between border-b border-[#e4e1da] px-5 py-4">
          <div className="flex items-start gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-rose-100">
              <AlertTriangle className="h-5 w-5 text-rose-700" />
            </div>

            <div>
              <h2 className="text-[15px] font-semibold text-[#1c2321]">
                Takedown Katalog Produk
              </h2>

              <p className="mt-1 text-[12px] leading-5 text-[#6b665d]">
                Anda akan melakukan takedown pada katalog{" "}
                <span className="font-medium text-[#1c2321]">
                  {batchTitle}
                </span>
                . Tindakan ini akan menghentikan penawaran dan memicu
                refund otomatis jika ada transaksi yang berlangsung.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onCancel}
            disabled={loading}
            aria-label="Tutup"
            className="rounded-md p-1 text-[#6b665d] hover:bg-[#f2f0ea] hover:text-[#1c2321] disabled:cursor-not-allowed disabled:opacity-40"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-5">
          {/* Reason */}
          <div>
            <label
              htmlFor="takedown-reason"
              className="text-[13px] font-medium text-[#1c2321]"
            >
              Alasan Pelanggaran *
            </label>

            <textarea
              id="takedown-reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={3}
              placeholder="Jelaskan alasan pelanggaran (minimal 5 karakter)..."
              disabled={loading}
              className="mt-1.5 w-full resize-none rounded-md border border-[#e4e1da] bg-[#faf9f6] p-2.5 text-[13px] text-[#1c2321] outline-none placeholder:text-[#9a958b] focus:border-rose-600 focus:ring-1 focus:ring-rose-600 disabled:cursor-not-allowed disabled:opacity-60"
            />

            {reason.length > 0 && trimmedReason.length < 5 && (
              <p className="mt-1 text-[11px] text-rose-600">
                Alasan harus memiliki minimal 5 karakter.
              </p>
            )}
          </div>

          {/* Confirmation */}
          <div className="mt-4 flex items-start gap-2 rounded-md border border-amber-200 bg-amber-50/50 p-2.5">
            <input
              type="checkbox"
              id="confirm-takedown"
              checked={isConfirmed}
              onChange={(e) => setIsConfirmed(e.target.checked)}
              disabled={loading}
              className="mt-0.5 h-4 w-4 rounded border-gray-300 text-rose-600 focus:ring-rose-500 disabled:cursor-not-allowed"
            />

            <label
              htmlFor="confirm-takedown"
              className="cursor-pointer text-[12px] text-[#4a453c]"
            >
              Saya yakin untuk melakukan takedown pada katalog produk ini.
            </label>
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-2 pt-5">
            <button
              type="button"
              onClick={onCancel}
              disabled={loading}
              className="rounded-md px-3.5 py-2 text-[13px] font-medium text-[#4a453c] hover:bg-[#f2f0ea] disabled:cursor-not-allowed disabled:opacity-40"
            >
              Batal
            </button>

            <button
              type="submit"
              disabled={!isValid || loading}
              className="flex items-center gap-1.5 rounded-md bg-rose-700 px-3.5 py-2 text-[13px] font-medium text-white hover:bg-rose-800 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {loading && (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              )}

              {loading ? "Memproses..." : "Eksekusi Takedown"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}