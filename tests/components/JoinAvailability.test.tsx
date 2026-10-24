// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import JoinBatchForm from "@/components/marketplace/JoinBatchForm";
import { mapMarketplaceRpcRow } from "@/lib/marketplace/api-mapper";
const item = mapMarketplaceRpcRow({ id: "batch", can_register: true, remaining_quantity: 10 } as never);
afterEach(() => vi.unstubAllGlobals());
describe("join availability conflicts", () => {
  it("verifies a capacity conflict without automatically resending a registration", async () => {
    const fetch = vi.fn().mockResolvedValue(new Response(JSON.stringify({ code: "BATCH_CAPACITY_EXCEEDED", error: "Kapasitas tidak mencukupi" }), { status: 409 }));
    vi.stubGlobal("fetch", fetch);
    const verify = vi.fn().mockResolvedValue({ availability: { canRegister: true, remainingQuantity: 2 } });
    render(<JoinBatchForm item={item} consentGiven onSuccess={vi.fn()} onAvailabilityCheck={verify} />);
    await userEvent.click(screen.getByRole("button", { name: /daftar sekarang/i }));
    expect(await screen.findByText(/Sisa kuota 2 porsi/)).toBeVisible();
    expect(verify).toHaveBeenCalledTimes(1);
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(screen.getByRole("spinbutton")).toBeInTheDocument();
  });
  it("blocks further submissions when verification fails and allows an explicit retry", async () => {
    const fetch = vi.fn().mockResolvedValue(new Response(JSON.stringify({ error: "Pendaftaran ditutup" }), { status: 403 }));
    vi.stubGlobal("fetch", fetch);
    const verify = vi.fn().mockResolvedValueOnce(null).mockResolvedValueOnce({ availability: { canRegister: true, remainingQuantity: 2 } });
    render(<JoinBatchForm item={item} consentGiven onSuccess={vi.fn()} onAvailabilityCheck={verify} />);
    await userEvent.click(screen.getByRole("button", { name: /daftar sekarang/i }));
    await screen.findByRole("button", { name: /periksa ketersediaan lagi/i });
    expect(screen.getByRole("button", { name: /daftar sekarang/i })).toBeDisabled();
    await userEvent.click(screen.getByRole("button", { name: /periksa ketersediaan lagi/i }));
    expect(screen.getByRole("button", { name: /daftar sekarang/i })).toBeEnabled();
    expect(fetch).toHaveBeenCalledTimes(1);
  });
  it("unblocks after a newer successful background availability snapshot arrives", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({ error: "Pendaftaran ditutup" }), { status: 403 })));
    const verify = vi.fn().mockResolvedValue(null);
    const props = { consentGiven: true, onSuccess: vi.fn(), onAvailabilityCheck: verify };
    const view = render(<JoinBatchForm item={item} {...props} />);
    await userEvent.click(screen.getByRole("button", { name: /daftar sekarang/i }));
    await screen.findByRole("button", { name: /periksa ketersediaan lagi/i });
    view.rerender(<JoinBatchForm item={{ ...item, availability: { canRegister: true, reason: null, remainingQuantity: 2 } }} {...props} />);
    expect(screen.getByRole("button", { name: /daftar sekarang/i })).toBeEnabled();
  });
});
