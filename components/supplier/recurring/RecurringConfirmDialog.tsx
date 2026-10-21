"use client";

import { useEffect, useRef } from "react";
import { AlertCircle, CalendarClock, CheckCircle2, X } from "lucide-react";

interface RecurringConfirmDialogProps {
  open: boolean;
  configName: string;
  nextDate: string | null;
  onConfirm: () => void;
  onCancel: () => void;
}

export default function RecurringConfirmDialog({
  open,
  configName,
  nextDate,
  onConfirm,
  onCancel,
}: RecurringConfirmDialogProps) {
  const confirmRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (open) {
      confirmRef.current?.focus();
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onCancel();
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [open, onCancel]);

  if (!open) return null;

  const formattedDate = nextDate
    ? new Intl.DateTimeFormat("id-ID", {
        dateStyle: "medium",
        timeStyle: "short",
        timeZone: "Asia/Jakarta",
      }).format(new Date(nextDate))
    : null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirm-dialog-title"
    >
      <div className="w-full max-w-md  border border-wesup-ink/15 bg-wesup-paper p-6 ">
        <div className="mb-4 flex items-center justify-between">
          <h2
            id="confirm-dialog-title"
            className="flex items-center gap-2 text-lg font-bold text-wesup-ink"
          >
            <CalendarClock size={20} className="text-wesup-red" />
            Konfirmasi Jadwal
          </h2>
          <button
            type="button"
            onClick={onCancel}
            className=" p-1.5 text-wesup-ink-sub transition hover:bg-wesup-paper-sub hover:text-wesup-ink-sub"
            aria-label="Tutup"
          >
            <X size={18} />
          </button>
        </div>

        <div className="mb-6 space-y-3">
          <div className=" border border-wesup-ink/20 bg-wesup-paper-sub p-3">
            <div className="flex items-start gap-2">
              <AlertCircle size={16} className="mt-0.5 shrink-0 text-wesup-ink-sub" />
              <p className="text-sm text-wesup-ink">
                Anda wajib mengkonfirmasi setiap batch yang akan tayang.
                Jika tidak dikonfirmasi dalam batas waktu, batch akan
                <strong> dibatalkan otomatis</strong> oleh sistem.
              </p>
            </div>
          </div>

          <div className=" bg-wesup-paper p-3 text-sm">
            <p className="text-wesup-ink-sub">Jadwal:</p>
            <p className="font-semibold text-wesup-ink">{configName}</p>
            {formattedDate && (
              <p className="mt-1 text-xs text-wesup-ink-sub">
                Batch berikutnya tayang: <strong>{formattedDate}</strong>
              </p>
            )}
          </div>
        </div>

        <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <button
            type="button"
            onClick={onCancel}
            className="inline-flex items-center justify-center gap-2  border border-wesup-ink/15 px-4 py-2.5 text-sm font-semibold text-wesup-ink transition hover:border-wesup-red hover:bg-wesup-paper-sub hover:text-wesup-ink"
          >
            Batal
          </button>
          <button
            ref={confirmRef}
            type="button"
            onClick={onConfirm}
            className="inline-flex items-center justify-center gap-2  bg-wesup-ink px-5 py-2.5 text-sm font-semibold text-wesup-paper  transition hover:bg-wesup-red"
          >
            <CheckCircle2 size={16} />
            Konfirmasi Tayang
          </button>
        </div>
      </div>
    </div>
  );
}
