"use client";
import { useState } from "react";
import { DialogSurface } from "@/components/feedback/ConfirmDialog";
import { Alert, AsyncButton, FieldFeedback } from "@/components/feedback";
import { feedbackError } from "@/lib/feedback/errors";
export function TakedownModal({ batchTitle, onCancel, onConfirm }: { batchId: string; batchTitle: string; onCancel: () => void; onConfirm: (reason: string) => Promise<void> }) {
 const [reason, setReason] = useState(""), [confirmed, setConfirmed] = useState(false), [pending, setPending] = useState(false), [error, setError] = useState("");
 const invalid = Boolean(reason.length && reason.trim().length < 5);
 async function submit(event: React.FormEvent) {
  event.preventDefault(); if (pending || !confirmed || reason.trim().length < 5) return;
  setPending(true); setError("");
  try { await onConfirm(reason.trim()); } catch (e) { setError(feedbackError(e, "Penawaran belum dapat dinonaktifkan. Coba lagi.")); } finally { setPending(false); }
 }
 return <DialogSurface open title="Nonaktifkan penawaran ini?" pending={pending} onClose={onCancel}><form onSubmit={submit} className="space-y-4"><p className="text-sm leading-6 text-slate-600">{batchTitle}. Penawaran dihentikan; pesanan yang terdampak mengikuti proses pengembalian dana.</p><label className="block text-sm font-semibold">Alasan pelanggaran<textarea autoFocus required minLength={5} rows={4} disabled={pending} value={reason} onChange={e => setReason(e.target.value)} aria-invalid={invalid} aria-describedby="takedown-error" className="mt-2 w-full rounded-xl border border-slate-300 p-3" /></label><FieldFeedback id="takedown-error" error={invalid ? "Alasan harus memiliki minimal 5 karakter." : undefined} /><label className="flex items-start gap-3 text-sm leading-6"><input type="checkbox" checked={confirmed} disabled={pending} onChange={e => setConfirmed(e.target.checked)} />Saya memahami dampak penonaktifan penawaran ini.</label>{error && <Alert tone="error">{error}</Alert>}<div className="flex flex-wrap justify-end gap-3"><button type="button" disabled={pending} onClick={onCancel} className="min-h-11 rounded-xl border px-4">Batal</button><AsyncButton type="submit" pending={pending} disabled={!confirmed || reason.trim().length < 5}>Nonaktifkan penawaran</AsyncButton></div></form></DialogSurface>;
}
