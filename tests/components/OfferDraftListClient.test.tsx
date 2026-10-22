// @vitest-environment jsdom
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, expect, it, vi } from "vitest";
import OfferDraftListClient from "@/components/supplier/catalog/OfferDraftListClient";
import type { AccountOfferDraft } from "@/lib/supplier-catalog/draft-list";

const resource = vi.hoisted(() => ({ data: { items: [] as AccountOfferDraft[] }, loading: false, error: "", reload: vi.fn() }));
vi.mock("@/lib/feedback/use-resource", () => ({ useFeedbackResource: () => resource }));
const schedule = { openingMode: "immediate", collectionDays: 1, pickupStartsAt: "", pickupEndsAt: "" } as const;
const key = "wesup:offer:owner:draft:one";
const saveLocal = (title = "Beras perangkat") => localStorage.setItem(key, JSON.stringify({ id: "one", revision: 1, step: 2, updatedAt: 1, draft: { title }, schedule }));
beforeEach(() => { localStorage.clear(); resource.data = { items: [] }; resource.error = ""; resource.loading = false; resource.reload.mockClear(); });

it("merges identical server and device drafts into one account entry", async () => {
  saveLocal("Beras");
  resource.data.items = [{ id: "one", step: 2, revision: 2, payload: { title: "Beras", schedule } }];
  render(<OfferDraftListClient ownerId="owner" />);
  await waitFor(() => expect(screen.getByRole("list").children).toHaveLength(1));
  expect(screen.getByText("Tersimpan di akun")).toBeVisible();
  expect(screen.queryByRole("link", { name: "Pulihkan perubahan perangkat" })).not.toBeInTheDocument();
});

it("offers explicit choices when device content differs from the saved account draft", async () => {
  saveLocal();
  resource.data.items = [{ id: "one", step: 1, revision: 2, payload: { title: "Beras akun", schedule } }];
  render(<OfferDraftListClient ownerId="owner" />);
  const local = await screen.findByRole("link", { name: "Pulihkan perubahan perangkat" });
  expect(screen.getByRole("list").children).toHaveLength(1);
  expect(screen.getByRole("link", { name: "Lanjutkan draft tersimpan" })).toHaveAttribute("href", "/supplier/catalog/new?draft=one");
  const url = new URL(local.getAttribute("href")!, "https://wesup.test");
  expect(url.searchParams.get("recovery")).toBe(key);
  expect(url.searchParams.get("draft")).toBe("one");
});

it("keeps local offers and retry visible during an account API failure", async () => {
  saveLocal(); resource.error = "Server tidak tersedia";
  render(<OfferDraftListClient ownerId="owner" />);
  expect(await screen.findByText("Beras perangkat")).toBeVisible();
  expect(screen.getByText("Hanya di perangkat ini")).toBeVisible();
  fireEvent.click(screen.getByRole("button", { name: "Coba lagi" }));
  expect(resource.reload).toHaveBeenCalledOnce();
});

it("keeps account offers visible when device storage is unavailable", async () => {
  resource.data.items = [{ id: "one", step: 1, revision: 1, payload: { title: "Beras akun" } }];
  const get = vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => { throw new Error("Denied"); });
  localStorage.setItem(key, "fixture");
  try {
    render(<OfferDraftListClient ownerId="owner" />);
    expect(await screen.findByText(/Draft perangkat belum dapat dibaca/)).toBeVisible();
    expect(screen.getByText("Beras akun")).toBeVisible();
  } finally { get.mockRestore(); }
});

it("refreshes local entries on storage events and account reads on focus", async () => {
  render(<OfferDraftListClient ownerId="owner" />);
  await act(async () => {});
  saveLocal(); fireEvent(window, new StorageEvent("storage", { key }));
  expect(await screen.findByText("Beras perangkat")).toBeVisible();
  localStorage.removeItem(key); fireEvent(window, new Event("focus"));
  await waitFor(() => expect(screen.queryByText("Beras perangkat")).not.toBeInTheDocument());
  expect(resource.reload).toHaveBeenCalledOnce();
});

it("never includes another supplier's device offer", async () => {
  saveLocal();
  render(<OfferDraftListClient ownerId="other-owner" />);
  await act(async () => {});
  expect(screen.queryByText("Beras perangkat")).not.toBeInTheDocument();
});
