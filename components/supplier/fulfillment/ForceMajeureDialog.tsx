"use client";

import { useEffect, useRef } from "react";
import type React from "react";
import type { AsyncPhase } from "@/lib/supplier-fulfillment/types";

export interface ForceMajeureDialogProps {
  open: boolean;
  batchTitle: string;
  paidOrderCount: number;
  phase: AsyncPhase;
  error: string | null;
  onCancel: () => void;
  onConfirm: () => void;
  returnFocusRef: React.RefObject<HTMLButtonElement | null>;
}

export default function ForceMajeureDialog({
  open,
  batchTitle,
  paidOrderCount,
  phase,
  error,
  onCancel,
  onConfirm,
  returnFocusRef,
}: ForceMajeureDialogProps) {
  const ref = useRef<HTMLDialogElement>(null);
  const loading = phase === "loading";

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  const dismiss = () => {
    if (!loading) onCancel();
  };

  return (
    <dialog
      ref={ref}
      aria-labelledby="force-majeure-title"
      aria-describedby="force-majeure-description force-majeure-warnings"
      className="fixed left-1/2 top-1/2 m-0 max-h-[calc(100dvh-2rem)] w-[calc(100%-2rem)] max-w-lg -translate-x-1/2 -translate-y-1/2 overflow-y-auto  border border-wesup-ink/15 bg-wesup-paper p-0 text-wesup-ink  backdrop:bg-wesup-ink/40"
      onCancel={(event) => {
        event.preventDefault();
        dismiss();
      }}
      onClose={() => {
        if (loading) {
          ref.current?.showModal();
          return;
        }
        onCancel();
        if (returnFocusRef.current && !returnFocusRef.current.disabled) {
          returnFocusRef.current.focus();
        }
      }}
    >
      <form
        className="p-6 text-wesup-ink"
        onSubmit={(event) => {
          event.preventDefault();
          if (!loading) onConfirm();
        }}
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 id="force-majeure-title" className="text-xl font-bold text-wesup-red">
              Pembatalan Darurat (Force Majeure)?
            </h2>
            <p id="force-majeure-description" className="mt-2 text-sm leading-6 ">
              Batch{" "}
              <span className="font-semibold ">{batchTitle}</span>{" "}
              akan dibatalkan karena kondisi di luar kendali (mis. barang rusak atau bencana).
              Tindakan ini tidak dapat dibatalkan.
            </p>
          </div>
          <button
            type="button"
            aria-label="Tutup dialog pembatalan darurat"
            disabled={loading}
            onClick={dismiss}
            className=" p-1 text-wesup-ink-sub hover:bg-wesup-paper-sub focus:outline-none focus:ring-2 focus:outline-wesup-red disabled:cursor-not-allowed disabled:opacity-50"
          >
            <span aria-hidden="true" className="text-2xl leading-none">×</span>
          </button>
        </div>

        <div
          id="force-majeure-warnings"
          className="mt-5 space-y-2  border border-wesup-red/40 bg-wesup-paper p-4 text-sm text-wesup-red"
        >
          {paidOrderCount > 0 ? (
            <p>
              {paidOrderCount} pesanan lunas akan masuk antrean Full Refund.
            </p>
          ) : (
            <p>Belum ada pesanan lunas pada batch ini.</p>
          )}
          <p>
            UMKM yang terdaftar tidak akan dikenakan sanksi No-Show atas pembatalan ini.
          </p>
        </div>

        {error ? (
          <p role="alert" aria-live="assertive" aria-atomic="true" className="mt-3 text-sm font-medium text-wesup-red">
            {error}
          </p>
        ) : null}

        <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <button
            type="button"
            disabled={loading}
            onClick={dismiss}
            className=" border border-wesup-ink/20 px-4 py-2 text-sm font-medium text-wesup-ink disabled:cursor-not-allowed disabled:opacity-50"
          >
            Batal
          </button>
          <button
            type="submit"
            disabled={loading}
            className=" bg-wesup-red px-4 py-2 text-sm font-semibold text-wesup-paper disabled:cursor-not-allowed disabled:opacity-50"
          >
            {loading ? "Memproses…" : "Ya, Batalkan Darurat"}
          </button>
        </div>
      </form>
    </dialog>
  );
}
