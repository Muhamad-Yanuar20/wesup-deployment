// @vitest-environment jsdom
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { LogoutAction } from "@/components/auth/LogoutAction";
const router = vi.hoisted(() => ({ replace: vi.fn(), refresh: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => router }));
beforeEach(() => {
 vi.clearAllMocks();
 HTMLDialogElement.prototype.showModal = function() { this.setAttribute("open", ""); };
 HTMLDialogElement.prototype.close = function() { this.removeAttribute("open"); };
});
afterEach(() => vi.unstubAllGlobals());
describe("confirmed logout", () => {
 it("retains the dialog and session when logout cannot be verified", async () => {
  vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("Failed to fetch")));
  render(<LogoutAction />); fireEvent.click(screen.getByRole("button", { name: "Keluar" }));
  fireEvent.click(screen.getAllByRole("button", { name: "Keluar" }).at(-1)!);
  await screen.findByRole("alert"); expect(router.replace).not.toHaveBeenCalled(); expect(screen.getByRole("dialog")).toBeInTheDocument();
 });
 it("does not mistake a suspended authenticated account for a signed-out account", async () => {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValueOnce(new Response("{}", { status: 500 })).mockResolvedValueOnce(new Response("{}", { status: 403 })));
  render(<LogoutAction />); fireEvent.click(screen.getByRole("button", { name: "Keluar" })); fireEvent.click(screen.getAllByRole("button", { name: "Keluar" }).at(-1)!);
  await screen.findByRole("alert"); expect(router.replace).not.toHaveBeenCalled();
 });
 it("verifies a lost mutation response without repeating the POST", async () => {
  const fetch = vi.fn().mockRejectedValueOnce(new TypeError("Failed to fetch")).mockResolvedValueOnce(new Response("{}", { status: 401 }));
  vi.stubGlobal("fetch", fetch); render(<LogoutAction />); fireEvent.click(screen.getByRole("button", { name: "Keluar" })); fireEvent.click(screen.getAllByRole("button", { name: "Keluar" }).at(-1)!);
  await waitFor(() => expect(router.replace).toHaveBeenCalledWith("/")); expect(fetch).toHaveBeenCalledTimes(2); expect(fetch.mock.calls[1][0]).toBe("/api/auth/session");
 });
});
