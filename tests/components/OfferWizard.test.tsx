// @vitest-environment jsdom
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import OfferWizard from "@/components/supplier/catalog/OfferWizard";
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn(), replace: vi.fn() }) }));
vi.mock("@/components/supplier/BusinessPhotoField", () => ({ default: () => <div>Foto produk</div> }));
vi.mock("@/components/supplier/catalog/steps/PickupLocationStep", () => ({ default: () => <div>Lokasi pengambilan</div> }));

describe("guided supplier offer", () => {
  beforeEach(() => { window.localStorage.clear(); vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => ({ item: { id: "draft", revision: 1 } }) })); });
  it("offers a partial draft on the very first step without requiring a schedule", async () => {
    render(<OfferWizard ownerId="supplier-test" />);
    expect(screen.getByRole("button", { name: "Simpan Draft" })).toBeEnabled();
    fireEvent.change(screen.getByLabelText(/Nama Produk/), { target: { value: "Beras" } });
    fireEvent.click(screen.getByRole("button", { name: "Simpan Draft" }));
    await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent("Draft tersimpan"));
    const body = vi.mocked(fetch).mock.calls[0][1]?.body as FormData;
    expect(JSON.parse(String(body.get("payload"))).title).toBe("Beras");
  });
  it("shows four steps and never asks the supplier to enter a payment opening", () => {
    render(<OfferWizard ownerId="supplier-test" />);
    expect(screen.getByLabelText("Langkah pembuatan penawaran").querySelectorAll("li")).toHaveLength(4);
    expect(screen.queryByText("Mulai Payment Window")).not.toBeInTheDocument();
  });
});
