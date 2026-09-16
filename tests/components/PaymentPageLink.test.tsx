// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { screen } from "@testing-library/react";
import PaymentPageLink from "@/components/payments/PaymentPageLink";
import { renderComponent as render } from "./test-utils";

describe("PaymentPageLink", () => {
  it("uses a native anchor so the payment document receives its route CSP", () => {
    render(<PaymentPageLink href="/pesanan/order-1/bayar">Bayar Sekarang</PaymentPageLink>);
    const link = screen.getByRole("link", { name: "Bayar Sekarang" });
    expect(link.tagName).toBe("A");
    expect(link).toHaveAttribute("href", "/pesanan/order-1/bayar");
  });
});
