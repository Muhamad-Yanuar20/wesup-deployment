export class FeedbackError extends Error {
  constructor(message: string, public readonly status = 0, public readonly code?: string, public readonly requestId?: string) {
    super(message);
    this.name = "FeedbackError";
  }
}

const technical = /HTTP\s*(?:Error|\d)|Internal Server|Failed to fetch|fetch failed|NetworkError|Load failed|permission denied|relation .* does not exist|SQL|Postgres|Supabase|invalid (?:JSON|uuid)|Unexpected token|JSON|TypeError|Error:|\bstack\b|configuration|config.*missing|ECONN|AbortError/i;
const indonesian = /\b(?:Anda|belum|tidak|gagal|sudah|periksa|pilih|masuk|koneksi|akun|jadwal|isian|kapasitas|batas|waktu|silakan|coba|rekening|pesanan|penawaran|foto|kode|draft|harga|jumlah|layanan|pengambilan|pembayaran|komplain|ulasan|terlalu|data|proses|akses|produk|lokasi|minimal|maksimal|isi|unggah|nomor|nama|email|password|pin|qr)\b/i;

export function feedbackError(reason: unknown, fallback = "Proses belum dapat diselesaikan. Coba lagi."): string {
  const message = typeof reason === "string" ? reason : reason instanceof Error ? reason.message : reason && typeof reason === "object" && "message" in reason ? String(reason.message) : "";
  return message && !technical.test(message) && indonesian.test(message) ? message : fallback;
}

export function isAbortError(reason: unknown): boolean {
  return Boolean(reason && typeof reason === "object" && "name" in reason && reason.name === "AbortError");
}

export async function readFeedbackError(response: Response, fallback: string): Promise<FeedbackError> {
  const body = await response.json().catch(() => null) as { error?: unknown; code?: unknown; requestId?: unknown } | null;
  const defaults: Record<number, string> = {
    401: "Sesi Anda berakhir. Masuk kembali untuk melanjutkan.",
    403: "Aksi ini belum tersedia untuk akun atau tahap transaksi Anda.",
    404: "Data ini tidak tersedia. Kembali ke daftar untuk melihat data terbaru.",
    409: "Data atau tahap transaksi sudah berubah. Periksa versi terbaru sebelum mencoba lagi.",
    429: "Terlalu banyak percobaan. Tunggu sebentar lalu coba lagi.",
  };
  return new FeedbackError(response.status === 401 ? defaults[401] : feedbackError(body?.error, defaults[response.status] ?? fallback), response.status,
    typeof body?.code === "string" ? body.code : undefined,
    typeof body?.requestId === "string" ? body.requestId : undefined);
}

export async function feedbackJson<T>(response: Response, fallback: string): Promise<T> {
  if (!response.ok) throw await readFeedbackError(response, fallback);
  try { return await response.json() as T; } catch { throw new FeedbackError(fallback, response.status); }
}
