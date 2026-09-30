import { NextResponse } from "next/server";

export interface TransactionRpcClient { rpc(name: string, args?: Record<string, unknown>): PromiseLike<{ data: unknown; error: { code?: string; message?: string; details?: string } | null }> }
export function transactionError(error: unknown) {
  const value = error as { code?: string; message?: string; details?: string };
  const code = value?.code ?? "TRANSACTION_UNAVAILABLE";
  const status = code === "42501" ? 403 : code === "P0002" ? 404 : ["55000", "40001", "P0001", "23505", "23514"].includes(code) ? 409 : ["22023", "22P02", "22007"].includes(code) ? 400 : 503;
  const messages: Record<string, string> = {
    "42501": "Anda belum dapat menjalankan tindakan ini.", "P0002": "Data tidak ditemukan.", "55000": "Tahap atau batas waktu berubah. Muat ulang untuk melihat tindakan yang tersedia.",
    "23514":"Penawaran berubah. Muat ulang, periksa ringkasan terbaru, lalu berikan persetujuan kembali.",
    "40001": "Draft berubah di tab lain. Muat ulang sebelum menyimpan.", "P0001": "Kapasitas penawaran tidak mencukupi.", "22023": "Periksa kembali isian dan jadwal Anda.",
  };
  return NextResponse.json({ error: messages[code] ?? "Tindakan belum dapat dipastikan. Muat ulang sebelum mencoba lagi.", code, requestId: crypto.randomUUID(), ...(code === "P0001" ? { details: { remainingQuantity: Number(value.details) || 0 } } : {}) }, { status });
}
