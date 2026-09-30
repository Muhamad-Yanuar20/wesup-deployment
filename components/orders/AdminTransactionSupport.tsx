"use client";
import { useCallback, useEffect, useState, type FormEvent } from "react";
interface SupportRequest { id: string; user_id: string; registration_id: string | null; batch_id: string | null; message: string }
export default function AdminTransactionSupport() {
  const [items, setItems] = useState<SupportRequest[]>([]);
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);
  const load = useCallback(async () => {
    try { const response = await fetch("/api/admin/transaction-support", { cache: "no-store" }); const body = await response.json(); if (!response.ok) throw Error(body.error); setItems(body.items ?? []); } catch (error) { setStatus(error instanceof Error ? error.message : "Bantuan belum dapat dimuat."); }
  }, []);
  useEffect(() => { const timer=setTimeout(()=>{void load();},0);return()=>clearTimeout(timer); }, [load]);
  async function resolve(event: FormEvent<HTMLFormElement>, id: string) {
    event.preventDefault(); const data = new FormData(event.currentTarget); setBusy(true); setStatus("");
    try { const response = await fetch("/api/admin/transaction-support", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ id, note: data.get("note"), exemptPayment: data.has("exempt"), restoreAccess: data.has("restore") }) }); const body = await response.json(); if (!response.ok) throw Error(body.error); setStatus("Keputusan disimpan dan pengguna diberi notifikasi."); await load(); } catch (error) { setStatus(error instanceof Error ? error.message : "Coba lagi."); } finally { setBusy(false); }
  }
  return <section className="mt-8 space-y-4 rounded-2xl border border-slate-700 p-5"><h2 className="text-xl font-bold">Bantuan dan keberatan transaksi</h2><p role="status">{status}</p>{!items.length && <p>Belum ada permintaan yang perlu diperiksa.</p>}{items.map(item => <form key={item.id} onSubmit={event => resolve(event, item.id)} className="space-y-3 rounded-xl bg-slate-900 p-4"><p className="break-words">{item.message}</p><p className="break-all text-xs text-slate-400">Pengguna {item.user_id} · Transaksi {item.registration_id ?? item.batch_id}</p><label className="block">Hasil pemeriksaan<textarea name="note" required minLength={10} maxLength={2000} className="mt-2 w-full rounded-lg border border-slate-600 bg-slate-950 p-3" /></label>{item.registration_id && <><label className="flex gap-2"><input type="checkbox" name="exempt" />Gangguan terverifikasi: bebaskan penalti pembayaran pesanan ini</label><label className="flex gap-2"><input type="checkbox" name="restore" />Pulihkan akses sesuai jumlah pelanggaran yang masih berlaku</label></>}<button disabled={busy} className="min-h-11 rounded-lg bg-blue-700 px-4">Simpan keputusan</button></form>)}</section>;
}
