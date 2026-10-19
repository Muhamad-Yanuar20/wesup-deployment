// @vitest-environment jsdom
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import SupplierFinanceClient from "@/components/supplier/finance/SupplierFinanceClient";
import SupplierModuleUnavailable from "@/components/supplier/SupplierModuleUnavailable";
import { ToastProvider } from "@/components/ui/GlobalToast";

const account = { id: "11111111-1111-4111-8111-111111111111", bank_name: "BCA", account_number: "0123456789", account_holder_name: "Usaha Bandung", is_primary: true };
const finance = { balances: { escrow: 500000, frozen: 100000, available: 200000, paidOut: 300000 }, accounts: [account], payouts: [{ id: "payout-1", amount: 300000, status: "paid", requested_at: "2026-10-19T07:00:00Z" }] };
const json = (item: unknown, status = 200) => new Response(JSON.stringify(item), { status, headers: { "content-type": "application/json" } });
beforeAll(() => {
  HTMLDialogElement.prototype.showModal = function () { this.setAttribute("open", ""); };
  HTMLDialogElement.prototype.close = function () { this.removeAttribute("open"); this.dispatchEvent(new Event("close")); };
});
afterEach(() => vi.unstubAllGlobals());

describe("Supplier finance route views", () => {
  it("shows escrow balances without bank or payout forms", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(json({ item: finance })));
    render(<ToastProvider><SupplierFinanceClient view="escrow" /></ToastProvider>);
    expect(await screen.findByRole("heading", { name: "Monitoring Escrow", level: 1 })).toBeInTheDocument();
    expect(screen.getByText("Dana ditahan")).toBeInTheDocument();
    expect(screen.getByText("Dibekukan")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Simpan rekening" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Ajukan transfer" })).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Escrow" })).toHaveAttribute("aria-current", "page");
  });

  it("keeps the bank route focused on accounts", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(json({ item: finance })));
    render(<ToastProvider><SupplierFinanceClient view="bank-account" /></ToastProvider>);
    expect(await screen.findByRole("heading", { name: "Rekening Supplier", level: 1 })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Simpan rekening" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Ajukan transfer" })).not.toBeInTheDocument();
    expect(screen.getByText("0123456789", { exact: true })).toBeInTheDocument();
  });

  it("confirms and sends a payout once while pending, then refreshes its status", async () => {
    let finish!: (response: Response) => void;
    const fetch = vi.fn().mockResolvedValueOnce(json({ item: finance })).mockImplementationOnce(() => new Promise<Response>(resolve => { finish = resolve; })).mockResolvedValue(json({ item: finance }));
    vi.stubGlobal("fetch", fetch);
    render(<ToastProvider><SupplierFinanceClient /></ToastProvider>);
    await screen.findByRole("heading", { name: "Keuangan Supplier", level: 1 });
    fireEvent.change(screen.getByLabelText("Nominal transfer (Rp)"), { target: { value: "100000" } });
    fireEvent.click(screen.getByRole("button", { name: "Ajukan transfer" }));
    const dialog = screen.getByRole("dialog", { name: "Ajukan transfer?" });
    expect(within(dialog).getByText(/dana belum ditransfer/i)).toBeInTheDocument();
    const confirm = within(dialog).getByRole("button", { name: "Ajukan transfer" });
    fireEvent.click(confirm);
    fireEvent.click(confirm);
    expect(fetch.mock.calls.filter(call => call[1]?.method === "POST")).toHaveLength(1);
    expect(JSON.parse(fetch.mock.calls[1][1].body)).toEqual({ amount: 100000, bankAccountId: account.id });
    finish(json({ ok: true, payoutId: "payout-2" }, 201));
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(await screen.findByText("Pengajuan transfer diterima.")).toBeInTheDocument();
  });

  it("does not turn a failed read into zero balances", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("Failed to fetch")));
    render(<ToastProvider><SupplierFinanceClient view="escrow" /></ToastProvider>);
    await screen.findByRole("alert");
    expect(screen.queryByText(/Rp\s*0/)).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Coba lagi" })).toBeInTheDocument();
  });

  it("distinguishes a zero balance from a missing primary account", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(json({ item: { balances: { escrow: 0, frozen: 0, available: 0, paidOut: 0 }, accounts: [], payouts: [] } })));
    render(<ToastProvider><SupplierFinanceClient /></ToastProvider>);
    expect(await screen.findByRole("button", { name: "Ajukan transfer" })).toBeDisabled();
    expect(screen.getAllByRole("definition")).toHaveLength(4);
    for (const balance of screen.getAllByRole("definition")) expect(balance).toHaveTextContent(/Rp\s*0/);
    expect(screen.getByRole("link", { name: /Kelola rekening/ })).toHaveAttribute("href", "/supplier/akun/rekening");
  });

  it("keeps the payout amount and dialog when the server reports insufficient balance", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValueOnce(json({ item: finance })).mockResolvedValue(json({ error: "Saldo tersedia tidak mencukupi.", code: "INSUFFICIENT_AVAILABLE_BALANCE" }, 409)));
    render(<ToastProvider><SupplierFinanceClient /></ToastProvider>);
    const input = await screen.findByLabelText("Nominal transfer (Rp)");
    fireEvent.change(input, { target: { value: "500000" } });
    fireEvent.click(screen.getByRole("button", { name: "Ajukan transfer" }));
    fireEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Ajukan transfer" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Saldo tersedia tidak mencukupi.");
    expect(input).toHaveValue(500000);
    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });

  it("asks before replacing the primary account and preserves the existing PUT payload", async () => {
    const fetch = vi.fn().mockResolvedValueOnce(json({ item: finance })).mockResolvedValueOnce(json({ ok: true, id: "new-account" })).mockResolvedValue(json({ item: finance }));
    vi.stubGlobal("fetch", fetch);
    render(<ToastProvider><SupplierFinanceClient view="bank-account" /></ToastProvider>);
    fireEvent.change(await screen.findByLabelText("Nama bank"), { target: { value: "BRI" } });
    fireEvent.change(screen.getByLabelText("Nomor rekening"), { target: { value: "0012345" } });
    fireEvent.change(screen.getByLabelText("Nama pemilik rekening"), { target: { value: "Pemilik Uji" } });
    fireEvent.click(screen.getByRole("button", { name: "Simpan rekening" }));
    const dialog = screen.getByRole("dialog", { name: "Ganti rekening utama?" });
    expect(fetch).toHaveBeenCalledTimes(1);
    fireEvent.click(within(dialog).getByRole("button", { name: "Simpan rekening utama" }));
    await waitFor(() => expect(fetch.mock.calls.some(call => call[1]?.method === "PUT")).toBe(true));
    const mutation = fetch.mock.calls.find(call => call[1]?.method === "PUT")!;
    expect(mutation[0]).toBe("/api/suppliers/finance/bank-account");
    expect(JSON.parse(mutation[1].body)).toEqual({ bankName: "BRI", accountNumber: "0012345", accountHolderName: "Pemilik Uji", isPrimary: true });
    await screen.findByText("Rekening tersimpan.");
  });

  it("uses the unavailable module's supplied explanation", () => {
    render(<SupplierModuleUnavailable title="Laporan" description="Pelaporan sedang dipersiapkan." />);
    expect(screen.getByText("Pelaporan sedang dipersiapkan.")).toBeInTheDocument();
  });
});
