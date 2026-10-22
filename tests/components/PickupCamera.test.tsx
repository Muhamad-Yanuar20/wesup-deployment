// @vitest-environment jsdom
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, expect, it, vi } from "vitest";
import PickupCamera from "@/components/supplier/fulfillment/PickupCamera";
const mocks = vi.hoisted(() => ({ stop: vi.fn(), decode: vi.fn() }));
vi.mock("@zxing/browser", () => ({ BrowserQRCodeReader: class { decodeFromStream = mocks.decode; } }));
beforeEach(() => { mocks.stop.mockClear(); mocks.decode.mockReset().mockResolvedValue({ stop: mocks.stop }); Object.defineProperty(window, "isSecureContext", { configurable: true, value: true }); });
it("requests video only after activation and releases media when leaving", async () => {
  const stopTrack = vi.fn(); const get = vi.fn(async () => ({ getTracks: () => [{ stop: stopTrack }] }));
  Object.defineProperty(navigator, "mediaDevices", { configurable: true, value: { getUserMedia: get } });
  const view = render(<PickupCamera onRead={vi.fn()} resetKey="one" />);
  await act(async () => {}); expect(get).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole("button", { name: "Aktifkan kamera" }));
  await screen.findByRole("button", { name: "Hentikan kamera" });
  expect(get).toHaveBeenCalledWith({ audio: false, video: { facingMode: { ideal: "environment" } } });
  view.unmount(); expect(stopTrack).toHaveBeenCalled(); expect(mocks.stop).toHaveBeenCalled();
});
it("ignores a media request resolving after cancellation and stops its tracks", async () => {
  let resolve!: (value: unknown) => void; const pending = new Promise(r => { resolve = r; }); const stop = vi.fn();
  const get = vi.fn(() => pending); Object.defineProperty(navigator, "mediaDevices", { configurable: true, value: { getUserMedia: get } });
  render(<PickupCamera onRead={vi.fn()} resetKey="one" />); await act(async () => {});
  fireEvent.click(screen.getByRole("button", { name: "Aktifkan kamera" })); await waitFor(() => expect(get).toHaveBeenCalled());
  fireEvent.click(screen.getByRole("button", { name: "Batalkan kamera" }));
  await act(async () => resolve({ getTracks: () => [{ stop }] }));
  expect(stop).toHaveBeenCalled(); expect(mocks.decode).not.toHaveBeenCalled();
});
it("offers PIN guidance after permission denial", async () => {
  Object.defineProperty(navigator, "mediaDevices", { configurable: true, value: { getUserMedia: vi.fn().mockRejectedValue(new DOMException("Denied", "NotAllowedError")) } });
  render(<PickupCamera onRead={vi.fn()} resetKey="one" />); await act(async () => {});
  fireEvent.click(screen.getByRole("button", { name: "Aktifkan kamera" }));
  expect(await screen.findByRole("alert")).toHaveTextContent("Izin kamera ditolak");
});
