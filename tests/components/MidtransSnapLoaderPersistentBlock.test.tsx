// @vitest-environment jsdom
import { act } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import MidtransSnapLoader, { type SnapLoaderState } from "@/components/payments/MidtransSnapLoader";
import { paymentRecoveryStorageKey } from "@/lib/payments/navigation-recovery";
import { renderComponent as render } from "./test-utils";

vi.mock("next/script", () => ({
  __esModule: true,
  default: () => <div data-testid="snap-script" />,
}));

describe("MidtransSnapLoader persistent CSP block", () => {
  it("exposes the direct-checkout fallback after the guarded recovery was already used", () => {
    window.sessionStorage.setItem(paymentRecoveryStorageKey("order-2"), "1");
    const states: SnapLoaderState[] = [];
    const exhausted = vi.fn();
    render(
      <MidtransSnapLoader
        orderId="order-2"
        config={{ clientKey: "client", scriptUrl: "https://app.sandbox.midtrans.com/snap/snap.js", nonce: null }}
        onStateChange={(state) => states.push(state)}
        onRecoveryExhausted={exhausted}
      />,
    );

    act(() => {
      const event = new Event("securitypolicyviolation") as Event & { blockedURI?: string; effectiveDirective?: string };
      Object.defineProperties(event, {
        blockedURI: { value: "https://app.sandbox.midtrans.com/", configurable: true },
        effectiveDirective: { value: "frame-src", configurable: true },
      });
      document.dispatchEvent(event);
    });

    expect(states).toContain("blocked");
    expect(exhausted).toHaveBeenCalledOnce();
    expect(window.sessionStorage.getItem(paymentRecoveryStorageKey("order-2"))).toBe("1");
  });
});
