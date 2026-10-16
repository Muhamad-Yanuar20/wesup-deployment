"use client";
import { useState, type FormEvent } from "react";
import { useFeedbackResource } from "@/lib/feedback/use-resource";
import { feedbackError, feedbackJson } from "@/lib/feedback/errors";
import { Alert, AsyncButton, ContentSkeleton, EmptyState, ErrorState } from "@/components/feedback";
import { ConfirmDialog } from "@/components/feedback/ConfirmDialog";
import { useToast } from "@/components/ui/GlobalToast";
interface SupportRequest { id: string; user_id: string; registration_id: string | null; batch_id: string | null; message: string }
type Decision = { id: string; note: string; exemptPayment: boolean; restoreAccess: boolean };
export default function AdminTransactionSupport() {
 const { data, loading, error: readError, reload } = useFeedbackResource<{ items: SupportRequest[] }>("/api/admin/transaction-support", "Permintaan bantuan belum dapat dimuat.");
 const [decision, setDecision] = useState<Decision | null>(null), [pending, setPending] = useState(false), [error, setError] = useState("");
 const { toast } = useToast();
 function review(event: FormEvent<HTMLFormElement>, id: string) {
  event.preventDefault(); const form = new FormData(event.currentTarget); setError("");
  setDecision({ id, note: String(form.get("note")), exemptPayment: form.has("exempt"), restoreAccess: form.has("restore") });
 }
 async function resolve() {
  if (!decision || pending) return; setPending(true); setError("");
  try { const response = await fetch("/api/admin/transaction-support", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(decision) }); await feedbackJson(response, "Hasil pemeriksaan belum terkonfirmasi. Periksa permintaan terbaru sebelum mengirim ulang."); setDecision(null); toast("Hasil pemeriksaan tersimpan.", "success"); await reload(); }
  catch (e) { setError(feedbackError(e, "Hasil pemeriksaan belum terkonfirmasi. Catatan Anda tetap tersedia.")); }
  finally { setPending(false); }
 }
 if (!data && loading) return <ContentSkeleton label="Memuat permintaan bantuan…" />;
 if (!data) return <ErrorState title="Permintaan bantuan belum dapat dimuat." description={readError} action={<AsyncButton onClick={() => void reload()}>Coba lagi</AsyncButton>} />;
 return <section className="mt-8 space-y-4"><h2 className="wesup-state-title text-2xl text-wesup-ink">Bantuan dan keberatan transaksi</h2>{readError && <Alert tone="warning" action={<button onClick={() => void reload()} className="underline">Coba perbarui</button>}>Keputusan tersimpan, tetapi daftar belum diperbarui. Data terakhir ditampilkan.</Alert>}{!data.items.length && <section className="border border-wesup-ink/15 bg-wesup-paper"><EmptyState title="Belum ada permintaan yang perlu diperiksa." /></section>}{data.items.map(item => <form key={item.id} onSubmit={event => review(event, item.id)} className="space-y-4 border border-wesup-ink/15 bg-wesup-paper p-5 text-sm text-wesup-ink-sub"><p className="break-words leading-6 text-wesup-ink">{item.message}</p><p className="break-all font-mono text-[0.6875rem] uppercase tracking-[0.14em] text-wesup-ink-sub">Pengguna {item.user_id} · Transaksi {item.registration_id ?? item.batch_id}</p><label className="block font-mono text-[0.6875rem] font-medium uppercase tracking-[0.2em] text-wesup-ink-sub">Hasil pemeriksaan<textarea name="note" required minLength={10} maxLength={2000} className="mt-2 w-full border border-wesup-ink/20 bg-wesup-paper px-4 py-2.5 text-sm text-wesup-ink caret-wesup-ink outline-none transition-colors duration-300 wesup-ease placeholder:text-wesup-ink-sub/50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-wesup-red" /></label>{item.registration_id && <><label className="flex items-start gap-3 text-wesup-ink"><input type="checkbox" name="exempt" className="mt-1 size-4 accent-wesup-red" />Gangguan terverifikasi: bebaskan penalti pembayaran pesanan ini</label><label className="flex items-start gap-3 text-wesup-ink"><input type="checkbox" name="restore" className="mt-1 size-4 accent-wesup-red" />Pulihkan akses sesuai jumlah pelanggaran yang masih berlaku</label></>}<AsyncButton disabled={pending && decision?.id === item.id}>Periksa keputusan</AsyncButton></form>)}<ConfirmDialog open={Boolean(decision)} title="Simpan hasil pemeriksaan dan perubahan akses ini?" description={<div className="space-y-2"><p>{decision?.note}</p><p>{decision?.exemptPayment ? "Penalti pembayaran dibebaskan." : "Tidak mengubah penalti pembayaran."}</p><p>{decision?.restoreAccess ? "Akses diperiksa dan dipulihkan sesuai pelanggaran yang masih berlaku." : "Tidak meminta pemulihan akses."}</p></div>} pending={pending} error={error} onConfirm={() => void resolve()} onCancel={() => setDecision(null)} /></section>;
}
