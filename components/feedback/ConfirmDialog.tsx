"use client";

import { useEffect, useId, useRef, type ReactNode } from "react";
import { X } from "lucide-react";
import { Alert, AsyncButton } from "./core";

export function DialogSurface({ open, title, children, onClose, pending = false, drawer = false, descriptionId }: { open: boolean; title: string; children: ReactNode; onClose: () => void; pending?: boolean; drawer?: boolean; descriptionId?: string }) {
  const ref = useRef<HTMLDialogElement>(null), opener = useRef<HTMLElement | null>(null), titleId = useId();
  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) {
      opener.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
      dialog.showModal();
    } else if (!open && dialog.open) dialog.close();
  }, [open]);
  useEffect(() => { const dialog = ref.current; return () => { if (dialog?.open) { dialog.close(); opener.current?.focus(); } }; }, []);
  return <dialog ref={ref} aria-labelledby={titleId} aria-describedby={descriptionId} aria-busy={pending || undefined} onCancel={event => { event.preventDefault(); if (!pending) onClose(); }} onClose={() => { opener.current?.focus(); if (open && !pending) onClose(); }} className={`wesup-dialog wesup-feedback fixed m-auto max-h-[calc(100dvh-2rem)] w-[calc(100%-2rem)] overflow-y-auto border border-wesup-ink/20 bg-wesup-paper p-5 text-wesup-ink sm:p-7 ${drawer ? "max-w-xl" : "max-w-lg"}`}>
    <header className="mb-5 flex items-start justify-between gap-3 border-b border-wesup-ink/10 pb-4"><div className="min-w-0"><span aria-hidden="true" className="mb-3 block h-px w-8 bg-wesup-red" /><h2 id={titleId} className="wesup-state-title text-2xl leading-[0.98] tracking-[0.05em]">{title}</h2></div><button type="button" disabled={pending} onClick={onClose} aria-label="Tutup dialog" className="-mr-2 -mt-2 flex size-11 shrink-0 items-center justify-center border border-wesup-ink/15 text-wesup-ink transition-colors duration-300 wesup-ease hover:bg-wesup-paper-sub focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-wesup-red disabled:opacity-50"><X aria-hidden="true" className="size-5" strokeWidth={1.5} /></button></header>{children}
  </dialog>;
}
export function ConfirmDialog({ open, title, description, children, confirmLabel = "Ya, lanjutkan", cancelLabel = "Kembali", pendingLabel = "Memproses…", pending = false, error, onConfirm, onCancel }: { open: boolean; title: string; description: ReactNode; children?: ReactNode; confirmLabel?: string; cancelLabel?: string; pendingLabel?: string; pending?: boolean; error?: string | null; onConfirm: () => void; onCancel: () => void }) {
  const descriptionId = useId();
  return <DialogSurface open={open} title={title} pending={pending} onClose={onCancel} descriptionId={descriptionId}><div className="space-y-4"><div id={descriptionId} className="text-sm leading-6 text-wesup-ink-sub">{description}</div>{children}{error && <Alert tone="error">{error}</Alert>}<div className="flex flex-col-reverse gap-3 pt-2 sm:flex-row sm:justify-end"><button type="button" autoFocus disabled={pending} onClick={onCancel} className="min-h-11 border border-wesup-ink/20 bg-wesup-paper px-5 py-2.5 text-sm font-semibold text-wesup-ink transition-colors duration-500 wesup-ease hover:bg-wesup-paper-sub focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-wesup-red disabled:opacity-60">{cancelLabel}</button><AsyncButton type="button" pending={pending} pendingLabel={pendingLabel} onClick={onConfirm}>{confirmLabel}</AsyncButton></div></div></DialogSurface>;
}
