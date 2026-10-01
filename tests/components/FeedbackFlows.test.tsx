// @vitest-environment jsdom
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import SupplierFinanceClient from "@/components/supplier/finance/SupplierFinanceClient";
import AdminCatalogPage from "@/app/admin/catalog/page";
import { ToastProvider } from "@/components/ui/GlobalToast";
afterEach(() => vi.unstubAllGlobals());
describe("feedback recovery", () => {
 it("does not render a failed finance request as zero balances", async () => {
  vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("Failed to fetch")));
  render(<ToastProvider><SupplierFinanceClient /></ToastProvider>);
  await screen.findByRole("alert");
  expect(screen.queryByText(/Rp\s*0/)).not.toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Coba lagi" })).toBeInTheDocument();
 });
 it("retries a failed catalog rather than showing an empty result", async () => {
  const fetch = vi.fn().mockRejectedValueOnce(new TypeError("Failed to fetch")).mockResolvedValue(new Response("[]"));
  vi.stubGlobal("fetch", fetch);
  render(<ToastProvider><AdminCatalogPage /></ToastProvider>);
  await screen.findByRole("alert");
  expect(screen.queryByText("Belum ada katalog produk yang terdaftar.")).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Coba lagi" }));
  await waitFor(() => expect(fetch).toHaveBeenCalledTimes(2));
  await screen.findByText("Belum ada katalog produk yang terdaftar.");
 });
});
