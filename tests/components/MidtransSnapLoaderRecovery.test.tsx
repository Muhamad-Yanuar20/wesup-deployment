// @vitest-environment jsdom
import { act } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import MidtransSnapLoader, { type SnapLoaderState } from "@/components/payments/MidtransSnapLoader";
import { renderComponent as render } from "./test-utils";

vi.mock("next/script", () => ({
  __esModule: true,
  default: () => <div data-testid="snap-script" />,
}));

describe("MidtransSnapLoader CSP recovery", () => {
  it("reports blocked when a Midtrans frame violates the document CSP", () => {
    const states: SnapLoaderState[] = [];
    render(
      <MidtransSnapLoader
        orderId="order-1"
        config={{ clientKey: "client", scriptUrl: "https://app.sandbox.midtrans.com/snap/snap.js", nonce: null }}
        onStateChange={(state) => states.push(state)}
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
  });
});
