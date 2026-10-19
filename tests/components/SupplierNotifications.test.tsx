// @vitest-environment jsdom
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import SupplierNotificationsClient from "@/components/supplier/SupplierNotificationsClient";
import { ToastProvider } from "@/components/ui/GlobalToast";

const notification = { id: "notification-1", type: "batch_update", title: "Batch diperbarui", message: "Jadwal pickup sudah tersedia.", readAt: null, createdAt: "2026-10-19T07:00:00Z", href: "/supplier" };
afterEach(() => vi.unstubAllGlobals());

describe("Supplier notification read state", () => {
  it("waits for PATCH confirmation before marking notifications read", async () => {
    let finish!: (response: Response) => void;
    const fetch = vi.fn().mockResolvedValueOnce(new Response(JSON.stringify({ notifications: [notification] }))).mockImplementationOnce(() => new Promise<Response>(resolve => { finish = resolve; }));
    vi.stubGlobal("fetch", fetch);
    render(<ToastProvider><SupplierNotificationsClient /></ToastProvider>);
    fireEvent.click(await screen.findByRole("button", { name: "Tandai semua dibaca" }));
    expect(screen.getByLabelText("Belum dibaca")).toBeInTheDocument();
    await act(async () => { finish(new Response(JSON.stringify({ ok: true }))); });
    await waitFor(() => expect(screen.queryByLabelText("Belum dibaca")).not.toBeInTheDocument());
    expect(screen.getByText("Semua sudah dibaca")).toBeInTheDocument();
  });

  it("keeps unread notifications and offers retry when PATCH fails", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValueOnce(new Response(JSON.stringify({ notifications: [notification] }))).mockResolvedValue(new Response(JSON.stringify({ error: "Coba lagi." }), { status: 500 })));
    render(<ToastProvider><SupplierNotificationsClient /></ToastProvider>);
    fireEvent.click(await screen.findByRole("button", { name: "Tandai semua dibaca" }));
    await screen.findByRole("alert");
    expect(screen.getByLabelText("Belum dibaca")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Tandai semua dibaca" })).toBeEnabled();
    expect(screen.getByRole("link", { name: /Batch diperbarui/ })).toHaveAttribute("href", "/supplier");
  });
});
