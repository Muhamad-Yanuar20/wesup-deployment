"use client";

import { useEffect, useRef } from "react";
import type React from "react";
import type { CancellationWarnings } from "@/lib/supplier-batch/state";
import type { AsyncPhase, SupplierBatchDetail } from "@/lib/supplier-batch/types";

export interface DeleteCatalogDialogProps {
  open: boolean;
  batch: SupplierBatchDetail;
  reason: string;
  warnings: CancellationWarnings;
  phase: AsyncPhase;
  error: string | null;
  mode?: "cancel" | "delete";
  onReasonChange: (value: string) => void;
  onCancel: () => void;
  onConfirm: () => void;
  returnFocusRef: React.RefObject<HTMLButtonElement | null>;
}

export default function DeleteCatalogDialog({
  open,
  batch,
  reason,
  warnings,
  phase,
  error,
  mode = "cancel",
  onReasonChange,
  onCancel,
  onConfirm,
  returnFocusRef,
}: DeleteCatalogDialogProps) {
  const ref = useRef<HTMLDialogElement>(null);
  const loading = phase === "loading";
  const isDraftDelete = mode === "delete";

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
      aria-labelledby="delete-catalog-title"
      aria-describedby="delete-catalog-description delete-catalog-warnings"
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
        if (returnFocusRef.current && !returnFocusRef.current.disabled) returnFocusRef.current.focus();
        else document.getElementById("supplier-batch-status")?.focus();
      }}
    >
      <form className="p-6 text-wesup-ink" onSubmit={(event) => { event.preventDefault(); if (!loading && (isDraftDelete || reason.trim())) onConfirm(); }}>
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 id="delete-catalog-title" className="text-xl font-bold">{isDraftDelete ? "Hapus draft katalog?" : "Batalkan katalog?"}</h2>
            <p id="delete-catalog-description" className="mt-2 text-sm leading-6 text-wesup-ink-sub">
              {isDraftDelete ? <>Draft <span className="font-semibold text-wesup-ink-sub">{batch.title}</span> akan dihapus permanen karena belum memiliki peserta.</> : <>Batch <span className="font-semibold text-wesup-ink-sub">{batch.title}</span> akan dibatalkan oleh pemasok. Tindakan ini tidak dapat dibatalkan.</>}
            </p>
          </div>
          <button type="button" aria-label="Tutup dialog" disabled={loading} onClick={dismiss} className=" p-1 text-wesup-ink-sub hover:bg-wesup-paper-sub focus:outline-none focus:ring-2 focus:outline-wesup-red disabled:cursor-not-allowed disabled:opacity-50"><span aria-hidden="true" className="text-2xl leading-none">×</span></button>
        </div>

        <div id="delete-catalog-warnings" className="mt-5 space-y-3  border border-wesup-ink/20 bg-wesup-paper-sub p-4 text-sm text-wesup-ink">
          {isDraftDelete ? <p>Draft tidak pernah tampil di marketplace dan dapat dihapus tanpa pembatalan peserta.</p> : <>{warnings.notifyParticipants ? <p>{warnings.participantCount} peserta akan menerima pemberitahuan pembatalan.</p> : null}{warnings.queueRefunds ? <p>{warnings.paidParticipantCount} peserta berbayar akan masuk antrean refund.</p> : null}{!warnings.notifyParticipants && !warnings.queueRefunds ? <p>Belum ada peserta yang perlu diberi tahu.</p> : null}</>}
        </div>

        {!isDraftDelete && <>
          <label htmlFor="cancellation-reason" className="mt-5 block text-sm font-semibold text-wesup-ink-sub">Alasan pembatalan</label>
          <textarea id="cancellation-reason" required value={reason} onChange={(event) => onReasonChange(event.target.value)} disabled={loading} autoFocus rows={4} className="mt-2 w-full  border border-wesup-ink/20 px-3 py-2 text-sm outline-none focus:border-wesup-red focus:ring-2  disabled:cursor-not-allowed disabled:bg-wesup-paper-sub" placeholder="Contoh: Stok pemasok tidak tersedia." />
        </>}
        {error ? <p role="alert" aria-live="assertive" aria-atomic="true" className="mt-3 text-sm font-medium text-wesup-red">{error}</p> : null}
        <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <button type="button" disabled={loading} onClick={dismiss} className=" border border-wesup-ink/20 px-4 py-2 text-sm font-medium text-wesup-ink disabled:cursor-not-allowed disabled:opacity-50">Batal</button>
          <button type="submit" disabled={loading || (!isDraftDelete && !reason.trim())} className=" bg-wesup-red px-4 py-2 text-sm font-semibold text-wesup-paper disabled:cursor-not-allowed disabled:opacity-50">{loading ? (isDraftDelete ? "Menghapus…" : "Membatalkan…") : (isDraftDelete ? "Hapus Draft" : "Batalkan Katalog")}</button>
        </div>
      </form>
    </dialog>
  );
}