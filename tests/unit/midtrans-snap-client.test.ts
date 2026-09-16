import { describe, expect, it, vi } from "vitest";
import { invokeSnapPay } from "@/lib/payments/snap-client";

describe("Midtrans Snap client helpers", () => {
  it("opens checkout exactly once with the server-issued token", () => {
    const pay = vi.fn();
    const result = invokeSnapPay({ pay }, "server-issued-token", {});

    expect(result).toEqual({ ok: true });
    expect(pay).toHaveBeenCalledTimes(1);
    expect(pay).toHaveBeenCalledWith("server-issued-token", {});
  });

  it("returns a safe error when Snap is not ready or throws", () => {
    expect(invokeSnapPay(null, "token", {})).toEqual({ ok: false, code: "SNAP_NOT_READY" });

    const pay = vi.fn(() => {
      throw new Error("popup blocked");
    });
    expect(invokeSnapPay({ pay }, "token", {})).toEqual({ ok: false, code: "SNAP_RUNTIME_ERROR" });
  });
});
