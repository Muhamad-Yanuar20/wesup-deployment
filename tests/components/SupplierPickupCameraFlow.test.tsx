// @vitest-environment jsdom
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, expect, it, vi } from "vitest";
import PickupScannerClient from "@/components/supplier/fulfillment/PickupScannerClient";
import { encodePickupQr } from "@/lib/supplier-fulfillment/qr-payload";
const id = "11111111-1111-4111-8111-111111111111";
const other = "22222222-2222-4222-8222-222222222222";
const token = "a".repeat(36);
const mock = vi.hoisted(() => ({ list: vi.fn(), confirm: vi.fn(), raw: "", picked: false }));
vi.mock("next/navigation", () => ({ usePathname: () => "/supplier/batch/batch/pickup", useSearchParams: () => new URLSearchParams("returnTo=%2Fsupplier%2Fpesanan") }));
vi.mock("@/components/supplier/fulfillment/PickupCamera", () => ({ default: ({ onRead }: { onRead: (text: string) => void }) => <button onClick={() => onRead(mock.raw)}>Simulate decoded frame</button> }));
vi.mock("@/lib/supplier-fulfillment/api-repository", () => ({ supplierFulfillmentApiRepository: { listOrders: mock.list, confirmPickup: mock.confirm } }));
vi.mock("@/lib/supplier-catalog/api-repository", () => ({ supplierBatchApiRepository: { getById: async () => ({ title: "Beras" }) } }));
beforeEach(() => {
  mock.picked = false; mock.raw = encodePickupQr(id, token); mock.confirm.mockReset().mockImplementation(async () => { mock.picked = true; return {}; });
  mock.list.mockReset().mockImplementation(async () => ({ orders: [{ registrationId: id, batchId: "batch", displayCode: "REG-ONE", umkmName: "UMKM Satu", status: mock.picked ? "picked_up" : "paid", canConfirmPickup: true, quantity: 2, unit: "kg", createdAt: "2026-10-22T00:00:00Z" }] }));
});
it("selects the decoded order and only confirms after an explicit click", async () => {
  render(<PickupScannerClient batchId="batch" />);
  fireEvent.click(await screen.findByRole("button", { name: "Simulate decoded frame" }));
  expect(screen.getByRole("combobox")).toHaveValue(id); expect(mock.confirm).not.toHaveBeenCalled();
  expect(screen.getByRole("link", { name: /Kembali ke pesanan/ })).toHaveAttribute("href", "/supplier/pesanan");
  fireEvent.click(screen.getByRole("button", { name: "Konfirmasi Pengambilan" }));
  await screen.findByText("Serah terima berhasil");
  expect(mock.confirm).toHaveBeenCalledExactlyOnceWith(id, { method: "qr", code: token });
  expect(mock.list).toHaveBeenCalledTimes(2);
});
it("rejects another batch's QR without sending a mutation", async () => {
  mock.raw = encodePickupQr(other, token); render(<PickupScannerClient batchId="batch" />);
  fireEvent.click(await screen.findByRole("button", { name: "Simulate decoded frame" }));
  expect(await screen.findByRole("alert")).toHaveTextContent("bukan pesanan pada batch"); expect(mock.confirm).not.toHaveBeenCalled();
});
it("resolves a lost confirmation response by reading the server without resending", async () => {
  mock.confirm.mockImplementation(async () => { mock.picked = true; throw new Error("Respons terputus"); });
  render(<PickupScannerClient batchId="batch" />); fireEvent.click(await screen.findByRole("button", { name: "Simulate decoded frame" }));
  fireEvent.click(screen.getByRole("button", { name: "Konfirmasi Pengambilan" }));
  await waitFor(() => expect(screen.getByText("Serah terima berhasil")).toBeVisible()); expect(mock.confirm).toHaveBeenCalledOnce();
});
