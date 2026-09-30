import { describe, expect, it } from "vitest";
import { calculatePaymentCountdown } from "@/lib/payments/countdown";

describe("payment countdown", () => {
  it("does not render zero before the first valid calculation", () => {
    expect(calculatePaymentCountdown(null, "2026-09-16T10:00:00.000Z", 0)).toMatchObject({ state: "loading", formatted: "--:--:--" });
  });

  it("uses the server timestamp offset instead of the device clock", () => {
    expect(calculatePaymentCountdown("2026-09-16T10:00:00.000Z", "2026-09-16T11:00:00.000Z", Date.parse("2026-09-16T09:30:00.000Z"), Date.parse("2026-09-16T09:00:00.000Z"))).toMatchObject({ state: "running", remainingMs: 30 * 60 * 1000 });
  });

  it("marks urgency and expiry from the server-relative deadline", () => {
    expect(calculatePaymentCountdown("2026-09-16T10:00:00.000Z", "2026-09-16T10:59:30.000Z", Date.parse("2026-09-16T10:00:00.000Z")).urgency).toBe("warning");
    expect(calculatePaymentCountdown("2026-09-16T10:00:00.000Z", "2026-09-16T10:00:00.000Z", Date.parse("2026-09-16T10:00:01.000Z"))).toMatchObject({ state: "expired", remainingMs: 0, formatted: "00:00:00" });
  });

  it("reports unavailable for malformed timestamps", () => {
    expect(calculatePaymentCountdown("bad", "also-bad", Date.now())).toMatchObject({ state: "unavailable", formatted: "--:--:--" });
  });
});
