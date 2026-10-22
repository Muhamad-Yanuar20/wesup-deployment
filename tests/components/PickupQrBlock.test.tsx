// @vitest-environment jsdom
import { act, render, screen } from "@testing-library/react";
import { expect, it, vi } from "vitest";
import PickupQrBlock from "@/components/orders/PickupQrBlock";
vi.mock("qrcode", () => ({ default: { toDataURL: vi.fn(async () => "data:image/png;base64,fixture") } }));
it("retains a generated QR even when encoding finishes before the next timer", async () => {
  render(<PickupQrBlock seed="first" />);
  await act(async () => { await new Promise(resolve => setTimeout(resolve, 30)); });
  expect(screen.getByRole("img", { name: "QR pengambilan pesanan" })).toHaveAttribute("src", "data:image/png;base64,fixture");
});
