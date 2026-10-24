import type { MarketplaceAvailability } from "./types";

export function availabilityMessage(reason: MarketplaceAvailability["reason"]): string {
  if (reason === "expired") return "Masa penawaran telah berakhir";
  if (reason === "full") return "Kuota batch sudah penuh";
  if (reason === "not_open") return "Pendaftaran belum dibuka";
  return "Pendaftaran telah ditutup";
}

/** Project elapsed time from a server snapshot; the device's wall clock is irrelevant. */
export function expiredAtServerTime(serverTime: string | undefined, closesAt: string, elapsedMs: number): boolean {
  const serverMs = Date.parse(serverTime ?? "");
  const closesMs = Date.parse(closesAt);
  return Number.isFinite(serverMs) && Number.isFinite(closesMs) && serverMs + Math.max(0, elapsedMs) >= closesMs;
}
