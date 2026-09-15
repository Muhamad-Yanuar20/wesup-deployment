import { describe, expect, it } from "vitest";
import {
  deriveOrderPhase,
  transitionRegistrationStatus,
  type LifecycleEvent,
  type RegistrationLifecycleStatus,
} from "@/lib/orders/lifecycle";

const timeline = {
  registration_opens_at: "2026-09-01T00:00:00.000Z",
  registration_closes_at: "2026-09-02T00:00:00.000Z",
  payment_opens_at: "2026-09-03T00:00:00.000Z",
  payment_closes_at: "2026-09-04T00:00:00.000Z",
  estimated_ready_at: "2026-09-05T00:00:00.000Z",
};

describe("order lifecycle", () => {
  it.each([
    ["registered", "payment_open", "pending_payment"],
    ["pending_payment", "payment_settled", "paid"],
    ["paid", "pickup_confirmed", "picked_up"],
    ["picked_up", "escrow_released", "completed"],
    ["paid", "no_show", "no_show"],
    ["paid", "refund_required", "refund_pending"],
    ["refund_pending", "refund_completed", "refunded"],
  ] as const)("transitions %s on %s to %s", (from, event, to) => {
    expect(transitionRegistrationStatus(from, event)).toEqual({
      allowed: true,
      status: to,
    });
  });

  it("keeps terminal statuses monotonic", () => {
    const terminal: RegistrationLifecycleStatus[] = [
      "completed",
      "no_show",
      "cancelled",
      "refunded",
    ];
    const events: LifecycleEvent[] = [
      "payment_open",
      "payment_settled",
      "pickup_confirmed",
      "escrow_released",
      "refund_required",
    ];

    for (const status of terminal) {
      for (const event of events) {
        expect(transitionRegistrationStatus(status, event)).toEqual({
          allowed: false,
          reason: "terminal_status",
        });
      }
    }
  });

  it("derives the waiting-payment phase after cutoff but before payment opens", () => {
    expect(
      deriveOrderPhase(
        "registered",
        timeline,
        "2026-09-02T12:00:00.000Z",
      ),
    ).toBe("waiting_payment_window");
  });

  it("derives payment-open and payment-expired phases from server time", () => {
    expect(
      deriveOrderPhase("pending_payment", timeline, "2026-09-03T12:00:00.000Z"),
    ).toBe("payment_open");
    expect(
      deriveOrderPhase("pending_payment", timeline, "2026-09-04T00:00:00.000Z"),
    ).toBe("payment_expired");
  });

  it("does not present a stale registered row as payable after close", () => {
    expect(
      deriveOrderPhase("registered", timeline, "2026-09-04T00:00:00.000Z"),
    ).toBe("payment_expired");
  });

  it("groups completed orders into the picked-up presentation state", () => {
    expect(
      deriveOrderPhase("completed", timeline, "2026-09-06T00:00:00.000Z"),
    ).toBe("completed");
  });
});
