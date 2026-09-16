export type PaymentCountdownState = "loading" | "running" | "expired" | "unavailable";
export type PaymentCountdownUrgency = "normal" | "warning" | "critical";

export interface PaymentCountdownResult {
  state: PaymentCountdownState;
  remainingMs: number | null;
  formatted: string;
  urgency: PaymentCountdownUrgency;
}

function formatRemaining(remainingMs: number): string {
  const totalSeconds = Math.max(0, Math.ceil(remainingMs / 1000));
  const hours = String(Math.floor(totalSeconds / 3600)).padStart(2, "0");
  const minutes = String(Math.floor((totalSeconds % 3600) / 60)).padStart(2, "0");
  const seconds = String(totalSeconds % 60).padStart(2, "0");
  return `${hours}:${minutes}:${seconds}`;
}

export function calculatePaymentCountdown(serverTime: string | null | undefined, deadline: string | null | undefined, nowMs = Date.now(), clientSyncMs = nowMs): PaymentCountdownResult {
  if (!serverTime || !deadline) return { state: "loading", remainingMs: null, formatted: "--:--:--", urgency: "normal" };
  const serverMs = Date.parse(serverTime);
  const deadlineMs = Date.parse(deadline);
  if (!Number.isFinite(serverMs) || !Number.isFinite(deadlineMs)) return { state: "unavailable", remainingMs: null, formatted: "--:--:--", urgency: "normal" };
  const serverRelativeNow = serverMs + (nowMs - clientSyncMs);
  const remainingMs = Math.max(0, deadlineMs - serverRelativeNow);
  if (remainingMs <= 0) return { state: "expired", remainingMs: 0, formatted: "00:00:00", urgency: "critical" };
  const urgency: PaymentCountdownUrgency = remainingMs < 10 * 60 * 1000 ? "critical" : remainingMs < 60 * 60 * 1000 ? "warning" : "normal";
  return { state: "running", remainingMs, formatted: formatRemaining(remainingMs), urgency };
}
