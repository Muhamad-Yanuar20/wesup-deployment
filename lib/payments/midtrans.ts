import "server-only";

export type MidtransTransactionStatus = "pending" | "settlement" | "capture" | "expire" | "deny" | "cancel" | "refund" | "partial_refund" | "authorize" | string;

export interface MidtransChargeResult {
  orderId: string;
  transactionId: string | null;
  transactionStatus: MidtransTransactionStatus;
  qrCodeUrl: string | null;
  expiresAt: string | null;
  raw: Record<string, unknown>;
}

export class MidtransProviderError extends Error {
  readonly status: number;
  readonly retryable: boolean;
  constructor(message: string, status = 502, retryable = true) {
    super(message);
    this.name = "MidtransProviderError";
    this.status = status;
    this.retryable = retryable;
  }
}

interface MidtransConfig { serverKey: string; baseUrl: string; timeoutMs: number }

function config(env: NodeJS.ProcessEnv = process.env): MidtransConfig {
  const serverKey = env.MIDTRANS_SERVER_KEY?.trim();
  if (!serverKey) throw new MidtransProviderError("Midtrans server configuration is missing", 503, false);
  const production = env.MIDTRANS_IS_PRODUCTION?.trim() || "false";
  if (production !== "true" && production !== "false") throw new MidtransProviderError("MIDTRANS_IS_PRODUCTION must be true or false", 503, false);
  const defaultBase = production === "true" ? "https://api.midtrans.com" : "https://api.sandbox.midtrans.com";
  const baseUrl = (env.MIDTRANS_BASE_URL?.trim() || defaultBase).replace(/\/$/, "");
  const timeoutMs = Math.min(15_000, Math.max(1_000, Number(env.MIDTRANS_TIMEOUT_MS ?? 8_000)));
  return { serverKey, baseUrl, timeoutMs };
}

function authHeader(serverKey: string): string {
  return `Basic ${Buffer.from(`${serverKey}:`).toString("base64")}`;
}

async function request<T>(path: string, init: RequestInit = {}, env?: NodeJS.ProcessEnv): Promise<T> {
  const cfg = config(env);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), cfg.timeoutMs);
  try {
    const response = await fetch(`${cfg.baseUrl}${path}`, {
      ...init,
      signal: controller.signal,
      headers: {
        Authorization: authHeader(cfg.serverKey),
        Accept: "application/json",
        "Content-Type": "application/json",
        ...(init.headers ?? {}),
      },
    });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) {
      const message = body && typeof body === "object" && "status_message" in body ? String((body as Record<string, unknown>).status_message) : `Midtrans returned HTTP ${response.status}`;
      throw new MidtransProviderError(message, response.status >= 500 ? 502 : response.status, response.status >= 500 || response.status === 429);
    }
    return body as T;
  } catch (error) {
    if (error instanceof MidtransProviderError) throw error;
    throw new MidtransProviderError(error instanceof Error && error.name === "AbortError" ? "Midtrans request timed out" : "Midtrans request failed", 502, true);
  } finally {
    clearTimeout(timeout);
  }
}

function qrUrl(body: Record<string, unknown>): string | null {
  const actions = Array.isArray(body.actions) ? body.actions : [];
  const action = actions.find((entry) => entry && typeof entry === "object" && (entry as Record<string, unknown>).name === "generate-qr-code-v2") as Record<string, unknown> | undefined;
  const url = action?.url;
  return typeof url === "string" ? url : null;
}

export async function chargeQris(input: { orderId: string; grossAmount: number; idempotencyKey: string; expiresAt?: string | null }, env?: NodeJS.ProcessEnv): Promise<MidtransChargeResult> {
  if (!Number.isSafeInteger(input.grossAmount) || input.grossAmount <= 0) throw new MidtransProviderError("Invalid gross amount", 400, false);
  const customExpiry = input.expiresAt ? Math.ceil((Date.parse(input.expiresAt) - Date.now()) / 1000) : null;
  if (customExpiry !== null && (!Number.isFinite(customExpiry) || customExpiry <= 0)) throw new MidtransProviderError("Payment window has expired", 403, false);
  const payload: Record<string, unknown> = { payment_type: "qris", transaction_details: { order_id: input.orderId, gross_amount: input.grossAmount }, qris: { acquirer: "gopay" } };
  if (customExpiry !== null) payload.custom_expiry = { expiry_duration: customExpiry, unit: "second" };
  const body = await request<Record<string, unknown>>("/v2/charge", {
    method: "POST",
    headers: { "Idempotency-Key": input.idempotencyKey },
    body: JSON.stringify(payload),
  }, env);
  return { orderId: String(body.order_id ?? input.orderId), transactionId: typeof body.transaction_id === "string" ? body.transaction_id : null, transactionStatus: String(body.transaction_status ?? "pending"), qrCodeUrl: qrUrl(body), expiresAt: typeof body.expiry_time === "string" ? body.expiry_time : null, raw: body };
}

export async function expireTransaction(orderId: string, env?: NodeJS.ProcessEnv): Promise<MidtransChargeResult> {
  if (!orderId.trim()) throw new MidtransProviderError("Invalid order id", 400, false);
  const body = await request<Record<string, unknown>>(`/v2/${encodeURIComponent(orderId)}/expire`, { method: "POST" }, env);
  return { orderId: String(body.order_id ?? orderId), transactionId: typeof body.transaction_id === "string" ? body.transaction_id : null, transactionStatus: String(body.transaction_status ?? "expire"), qrCodeUrl: qrUrl(body), expiresAt: typeof body.expiry_time === "string" ? body.expiry_time : null, raw: body };
}

export async function getTransactionStatus(orderId: string, env?: NodeJS.ProcessEnv): Promise<MidtransChargeResult> {
  const body = await request<Record<string, unknown>>(`/v2/${encodeURIComponent(orderId)}/status`, { method: "GET" }, env);
  return { orderId: String(body.order_id ?? orderId), transactionId: typeof body.transaction_id === "string" ? body.transaction_id : null, transactionStatus: String(body.transaction_status ?? "pending"), qrCodeUrl: qrUrl(body), expiresAt: typeof body.expiry_time === "string" ? body.expiry_time : null, raw: body };
}

export function isSuccessfulTransaction(status: string): boolean {
  return status === "settlement" || status === "capture";
}

export function isExpiredTransaction(status: string): boolean {
  return status === "expire" || status === "deny" || status === "cancel";
}
