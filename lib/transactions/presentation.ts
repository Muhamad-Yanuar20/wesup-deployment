import { formatTransactionDate } from "./schedule";
import type { PaymentProgressState } from "@/lib/payments/progress";

export interface TransactionPresentationInput {
  policyVersion?: number; status: string; now: string; orderId: string;
  registrationClosesAt?: string | null; paymentOpensAt?: string | null; paymentClosesAt?: string | null;
  pickupStartsAt?: string | null; pickupEndsAt?: string | null; readyAt?: string | null;
  pendingAttempt?: boolean; hasDispute?: boolean; needsRefundAccount?: boolean;
  paymentState?: PaymentProgressState;
  complaintDeadlineAt?: string | null; supplierDelayed?: boolean;
}
export type TransactionPhase = "waiting_payment_window" | "payment_open" | "payment_verifying" | "payment_expired" | "paid_waiting_ready" | "ready_for_pickup" | "supplier_delayed" | "picked_up" | "completed" | "no_show" | "cancelled" | "refund_pending" | "refunded" | "disputed";
export interface TransactionPresentation {
  phase: TransactionPhase; label: string; explanation: string; deadlineAt: string | null;
  group: "needs_action" | "ongoing" | "completed" | "cancelled";
  primaryAction: { label: string; href: string }; blockedReason: string | null;
}

export function deriveTransactionPresentation(input: TransactionPresentationInput): TransactionPresentation {
  const href = `/umkm/pesanan/${input.orderId}`;
  const now = Date.parse(input.now);
  const hasPassed = (value?: string | null) => Boolean(value && now >= Date.parse(value));
  const result = (phase: TransactionPhase, label: string, explanation: string, deadlineAt: string | null = null,
    action = "Lihat detail pesanan", group: TransactionPresentation["group"] = "ongoing", blockedReason: string | null = null): TransactionPresentation => ({
    phase, label, explanation, deadlineAt, group, primaryAction: { label: action, href }, blockedReason,
  });
  if (input.status === "refund_pending") return result("refund_pending", "Pengembalian dana diproses", "Dana akan dikembalikan melalui transfer manual oleh Admin.", null, input.needsRefundAccount ? "Isi rekening pengembalian" : "Lacak pengembalian dana", input.needsRefundAccount ? "needs_action" : "ongoing");
  if (input.status === "refunded") return result("refunded", "Dana sudah dikembalikan", "Pengembalian dana telah dicatat oleh Admin.", null, "Lihat detail pesanan", "completed");
  if (input.status === "cancelled" || input.status === "no_show") return result(input.status, input.status === "no_show" ? "Batas pengambilan terlewat" : "Pesanan dibatalkan", input.status === "no_show" ? "Dana diberikan kepada supplier sesuai komitmen pengambilan." : "Lihat alasan pembatalan dan langkah berikutnya.", null, "Lihat detail pesanan", "cancelled");
  if (input.hasDispute) return result("disputed", "Komplain ditinjau", "Dana ditahan selama Admin meninjau bukti.", null, "Lacak komplain");
  if (input.status === "completed") return result("completed", "Pesanan selesai", "Masa pemeriksaan selesai. Anda dapat memberikan ulasan.", null, "Lihat detail pesanan", "completed");
  if (input.status === "picked_up") return result("picked_up", "Barang sudah diambil", `Periksa kondisi barang. Komplain tersedia sampai ${formatTransactionDate(input.complaintDeadlineAt)}.`, input.complaintDeadlineAt ?? null);
  if (input.status === "paid") {
    if (!hasPassed(input.pickupStartsAt)) return result("paid_waiting_ready", "Lunas · barang disiapkan", `Jangan berangkat dulu. Pengambilan mulai ${formatTransactionDate(input.pickupStartsAt)}.`, input.pickupStartsAt ?? null, "Lihat jadwal", "ongoing", "Periode pengambilan belum dimulai.");
    const late = input.policyVersion === 2 && (input.supplierDelayed || !input.readyAt || Date.parse(input.readyAt) > Date.parse(input.pickupStartsAt ?? ""));
    if (late) return result("supplier_delayed", "Supplier terlambat", "Anda boleh menunggu jadwal baru atau meminta pengembalian dana penuh. Tidak ada penalti pengambilan.", input.pickupEndsAt ?? null, "Pilih kelanjutan pesanan", "needs_action", "Supplier belum siap pada waktu yang dijanjikan.");
    return result("ready_for_pickup", "Siap diambil", `Ambil barang sebelum ${formatTransactionDate(input.pickupEndsAt)}.`, input.pickupEndsAt ?? null, "Tampilkan QR/PIN", "needs_action");
  }
  if (input.pendingAttempt && (input.status === "pending_payment" || hasPassed(input.paymentOpensAt))) return result("payment_verifying", "Status pembayaran belum terkonfirmasi", "Periksa status ke Midtrans. Jangan membayar ulang sebelum hasil pemeriksaan tersedia.", input.paymentClosesAt ?? null, "Periksa status", "needs_action");
  if (hasPassed(input.paymentClosesAt)) return result("payment_expired", "Batas bayar terlewat", "Status akhir dan konsekuensi ditentukan setelah pembayaran diperiksa.", null, "Lihat detail pesanan", "cancelled");
  if (hasPassed(input.paymentOpensAt) && input.paymentState === "awaiting_payment") return result("payment_open", "Menunggu pembayaran", `Metode pembayaran sudah dipilih. Selesaikan pembayaran sebelum ${formatTransactionDate(input.paymentClosesAt)}.`, input.paymentClosesAt ?? null, "Lanjutkan pembayaran", "needs_action");
  if (hasPassed(input.paymentOpensAt) && input.paymentState === "failed") return result("payment_open", "Pembayaran belum berhasil", `Percobaan sebelumnya gagal atau kedaluwarsa. Anda dapat mencoba kembali sebelum ${formatTransactionDate(input.paymentClosesAt)}.`, input.paymentClosesAt ?? null, "Coba bayar lagi", "needs_action");
  if (hasPassed(input.paymentOpensAt)) return result("payment_open", "Harga final · waktunya bayar", `Bayar sebelum ${formatTransactionDate(input.paymentClosesAt)}.`, input.paymentClosesAt ?? null, "Bayar sekarang", "needs_action");
  return result("waiting_payment_window", "Pengumpulan pesanan", `Harga belum final. Pembayaran dibuka ${formatTransactionDate(input.paymentOpensAt)}.`, input.registrationClosesAt ?? null, "Lihat pesanan", "ongoing", "Harga final dikunci pada batas pengumpulan.");
}
