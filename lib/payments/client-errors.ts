import { feedbackError } from "@/lib/feedback/errors";
export interface PaymentApiError {
  message: string;
  code?: string;
  requestId?: string;
}

type PaymentApiErrorBody = {
  error?: unknown;
  code?: unknown;
  requestId?: unknown;
  details?: {
    providerMessage?: unknown;
  } | null;
};

const friendlyMessages: Record<string, string> = {
  PAYMENT_ADMIN_CONFIG_MISSING: "Konfigurasi pembayaran server belum siap. Coba lagi setelah konfigurasi diperbaiki.",
  PAYMENT_ADMIN_INIT_FAILED: "Layanan pembayaran sedang disiapkan. Coba lagi.",
  PAYMENT_PROVIDER_UNAVAILABLE: "Provider pembayaran sedang tidak tersedia. Coba lagi.",
  PAYMENT_PROVIDER_REJECTED: "Pembayaran ditolak provider pembayaran.",
};

export function parsePaymentApiError(body: unknown, fallback: string): PaymentApiError {
  if (!body || typeof body !== "object") return { message: fallback };
  const value = body as PaymentApiErrorBody;
  const code = typeof value.code === "string" && value.code.length > 0 ? value.code : undefined;
  const requestId = typeof value.requestId === "string" && value.requestId.length > 0 ? value.requestId : undefined;
  const base = code && friendlyMessages[code] ? friendlyMessages[code] : feedbackError(value.error, fallback);
  const providerReason = typeof value.details?.providerMessage === "string" && value.details.providerMessage.trim().length > 0 ? value.details.providerMessage.trim() : null;
  const message = code === "PAYMENT_PROVIDER_REJECTED" && providerReason ? `${base} Alasan provider: ${providerReason}` : base;
  return { message, ...(code ? { code } : {}), ...(requestId ? { requestId } : {}) };
}
