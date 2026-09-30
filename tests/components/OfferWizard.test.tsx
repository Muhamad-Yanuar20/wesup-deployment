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
  it('keeps a copied offer separate from another unfinished local draft',async()=>{
    localStorage.setItem('wesup:offer:supplier-test',JSON.stringify({draft:{title:'Draft lama'},step:1,schedule:{openingMode:'immediate',collectionDays:1,pickupStartsAt:'',pickupEndsAt:''}}));
    render(<OfferWizard ownerId="supplier-test" initialDraft={{title:'Penawaran serupa'}} copySourceId="source-batch" />);
    await waitFor(()=>expect(screen.getByLabelText(/Nama Produk/)).toHaveValue('Penawaran serupa'));
    expect(localStorage.getItem('wesup:offer:supplier-test')).toContain('Draft lama');
  });
  it('offers the saved server draft when the save response is lost',async()=>{
    vi.mocked(fetch).mockRejectedValue(new Error('Respons jaringan hilang'));
    render(<OfferWizard ownerId="supplier-test" />);fireEvent.click(screen.getByRole('button',{name:'Simpan Draft'}));
    await waitFor(()=>expect(screen.getByRole('alert')).toHaveTextContent('Respons jaringan hilang'));
    expect(screen.getByRole('link',{name:/Buka versi Draft tersimpan/})).toHaveAttribute('href',expect.stringContaining('/supplier/catalog/new?draft='));
  });
});
