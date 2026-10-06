// @vitest-environment jsdom
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import EarlyPaymentDecision from "@/components/orders/EarlyPaymentDecision";
import { ToastProvider } from "@/components/ui/GlobalToast";
import type { EarlyPaymentContext } from "@/lib/transactions/early-payment";

const context: EarlyPaymentContext = { minimumQuantity: 40, registeredQuantity: 45, participants: 2, accepted: 0, rejected: 0, hasParticipantHistory: true, canConfigure: false, canPropose: false, canOpen: false, canDecide: true, reason: null, tierNumber: 2, unitPrice: 8000, proposal: { id: "proposal", revision: 2, minimumQuantity: 40, status: "pending", decision: null } };
describe("early opening consent", () => {
  beforeEach(() => { vi.restoreAllMocks();
    HTMLDialogElement.prototype.showModal = function () { this.setAttribute("open", ""); };
    HTMLDialogElement.prototype.close = function () { this.removeAttribute("open"); };
    vi.stubGlobal("fetch", vi.fn()); });
  it("does not imply automatic opening or penalize refusal", () => {
    render(<ToastProvider><EarlyPaymentDecision orderId="order" context={context} onReload={() => {}} /></ToastProvider>);
    expect(screen.getByText(/24 jam/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Tetap gunakan aturan sebelumnya" })).toBeEnabled();
    expect(globalThis.fetch).not.toHaveBeenCalled();
  });
  it("preserves the decision controls after a lost response and offers read recovery", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("Failed to fetch")));
    const reload = vi.fn();
    render(<ToastProvider><EarlyPaymentDecision orderId="order" context={context} onReload={reload} /></ToastProvider>);
    fireEvent.click(screen.getByRole("button", { name: "Setuju pembukaan lebih awal" }));
    fireEvent.click(screen.getByRole("button", { name: "Ya, setuju" }));
    await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent(/belum terkonfirmasi/));
    expect(screen.getByRole("button", { name: "Muat ulang keputusan" })).toBeEnabled();
    expect(fetch).toHaveBeenCalledTimes(1);
  });
});
