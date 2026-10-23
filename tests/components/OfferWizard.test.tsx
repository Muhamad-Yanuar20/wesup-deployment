// @vitest-environment jsdom
import { act, fireEvent, render as renderBase, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import OfferWizard from "@/components/supplier/catalog/OfferWizard";
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn(), replace: vi.fn() }) }));
vi.mock("@/components/supplier/BusinessPhotoField", () => ({ default: () => <div>Foto produk</div> }));
vi.mock("@/components/supplier/catalog/steps/PickupLocationStep", () => ({ default: () => <div>Lokasi pengambilan</div> }));

import { ToastProvider } from "@/components/ui/GlobalToast";
const render = (ui: React.ReactNode) => renderBase(<ToastProvider>{ui}</ToastProvider>);

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
  it("focuses and describes the first invalid product field", async () => {
    render(<OfferWizard ownerId="supplier-test" />);
    fireEvent.click(screen.getByRole("button", { name: "Lanjut" }));
    const title = screen.getByLabelText(/Nama Produk/);
    await waitFor(() => expect(title).toHaveFocus());
    expect(title).toHaveAttribute("aria-invalid", "true");
    expect(title).toHaveAccessibleDescription("Isi nama produk.");
  });
  it("shows four steps and never asks the supplier to enter a payment opening", () => {
    render(<OfferWizard ownerId="supplier-test" />);
    expect(screen.getByLabelText("Langkah pembuatan penawaran").querySelectorAll("li")).toHaveLength(4);
    expect(screen.queryByText("Mulai Payment Window")).not.toBeInTheDocument();
  });
  it("starts fresh even when the previous local draft reached review", async () => {
    const previous = JSON.stringify({ draft: { title: "Draft lama" }, step: 4, id: "old-draft", revision: 3,
      schedule: { openingMode: "immediate", collectionDays: 7, pickupStartsAt: "", pickupEndsAt: "" } });
    localStorage.setItem("wesup:offer:supplier-test", previous);
    render(<OfferWizard ownerId="supplier-test" initialDraft={{ pickupName: "Toko supplier" }} />);
    await screen.findByRole("button", { name: /Lanjutkan Draft/ });
    expect(screen.getByLabelText(/Nama Produk/)).toHaveValue("");
    expect(screen.getByLabelText("Langkah pembuatan penawaran").querySelector('[aria-current="step"]')).toHaveTextContent("1. Produk");
    expect(localStorage.getItem("wesup:offer:supplier-test")).toBe(previous);
  });

  it("resumes a local draft only on request and retains its saving identity", async () => {
    localStorage.setItem("wesup:offer:supplier-test", JSON.stringify({ draft: { title: "Beras lama" }, step: 2,
      id: "old-draft", revision: 3, schedule: { openingMode: "immediate", collectionDays: 7, pickupStartsAt: "", pickupEndsAt: "" } }));
    render(<OfferWizard ownerId="supplier-test" />);
    fireEvent.click(await screen.findByRole("button", { name: /Lanjutkan Draft/ }));
    expect(screen.getByLabelText("Langkah pembuatan penawaran").querySelector('[aria-current="step"]')).toHaveTextContent("2. Harga");
    fireEvent.click(screen.getByRole("button", { name: "Simpan Draft" }));
    await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent("Draft tersimpan"));
    const body = vi.mocked(fetch).mock.calls[0][1]?.body as FormData;
    expect(body.get("id")).toBe("old-draft");
    expect(body.get("revision")).toBe("3");
    expect(JSON.parse(String(body.get("payload")))).toMatchObject({ title: "Beras lama", schedule: { collectionDays: 7 } });
  });

  it("preserves separate unfinished offers instead of overwriting the previous one", async () => {
    const first = render(<OfferWizard ownerId="supplier-test" />);
    fireEvent.change(screen.getByLabelText(/Nama Produk/), { target: { value: "Beras pertama" } });
    await waitFor(() => expect(Object.values(localStorage).some(v => String(v).includes("Beras pertama"))).toBe(true));
    first.unmount();
    render(<OfferWizard ownerId="supplier-test" />);
    await screen.findByRole("button", { name: /Lanjutkan Draft/ });
    expect(screen.getByLabelText(/Nama Produk/)).toHaveValue("");
    fireEvent.change(screen.getByLabelText(/Nama Produk/), { target: { value: "Beras kedua" } });
    await waitFor(() => {
      expect(Object.values(localStorage).some(v => String(v).includes("Beras pertama"))).toBe(true);
      expect(Object.values(localStorage).some(v => String(v).includes("Beras kedua"))).toBe(true);
    });
  });

  it("does not save an untouched new form to local storage", async () => {
    render(<OfferWizard ownerId="supplier-test" />);
    await act(async () => { await new Promise(resolve => setTimeout(resolve, 30)); });
    expect(localStorage.length).toBe(0);
  });

  it("leaves other suppliers' recovery drafts private", async () => {
    localStorage.setItem("wesup:offer:someone-else", JSON.stringify({ draft: { title: "Secret product" }, step: 1,
      schedule: { openingMode: "immediate", collectionDays: 1, pickupStartsAt: "", pickupEndsAt: "" } }));
    render(<OfferWizard ownerId="supplier-test" />);
    await act(async () => { await new Promise(resolve => setTimeout(resolve, 30)); });
    expect(screen.queryByText("Secret product")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Lanjutkan Draft/ })).not.toBeInTheDocument();
    expect(screen.getByLabelText(/Nama Produk/)).toHaveValue("");
  });

  it("ignores corrupt local recoveries without damaging them", async () => {
    localStorage.setItem("wesup:offer:supplier-test", '{"draft":{"title":"Corrupt"},"schedule":null,"step":99}');
    render(<OfferWizard ownerId="supplier-test" />);
    await act(async () => { await new Promise(resolve => setTimeout(resolve, 30)); });
    expect(screen.getByLabelText(/Nama Produk/)).toHaveValue("");
    expect(screen.queryByRole("button", { name: /Lanjutkan Draft/ })).not.toBeInTheDocument();
    expect(localStorage.getItem("wesup:offer:supplier-test")).toContain("Corrupt");
  });

  it("requires renewed approval when explicitly resuming the review step", async () => {
    localStorage.setItem("wesup:offer:supplier-test", JSON.stringify({ draft: { title: "Draft review" }, step: 4, reviewed: true,
      schedule: { openingMode: "immediate", collectionDays: 1, pickupStartsAt: "", pickupEndsAt: "" } }));
    render(<OfferWizard ownerId="supplier-test" />);
    fireEvent.click(await screen.findByRole("button", { name: /Lanjutkan Draft/ }));
    expect(screen.getByRole("checkbox")).not.toBeChecked();
    expect(screen.getByRole("button", { name: "Terbitkan penawaran" })).toBeDisabled();
  });

  it("loads the selected server draft instead of unrelated local data", async () => {
    localStorage.setItem("wesup:offer:supplier-test", JSON.stringify({ draft: { title: "Draft lokal lain" }, step: 4,
      schedule: { openingMode: "immediate", collectionDays: 1, pickupStartsAt: "", pickupEndsAt: "" } }));
    render(<OfferWizard ownerId="supplier-test" savedDraft={{ id: "server-draft", revision: 2, step: 1, payload: { title: "Draft server" } }} />);
    expect(screen.getByLabelText(/Nama Produk/)).toHaveValue("Draft server");
    fireEvent.click(screen.getByRole("button", { name: "Simpan Draft" }));
    await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent("Draft tersimpan"));
    expect(localStorage.getItem("wesup:offer:supplier-test")).toContain("Draft lokal lain");
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
    await waitFor(()=>expect(screen.getByRole('alert')).toHaveTextContent('Hasil penyimpanan belum terkonfirmasi'));
    expect(screen.getByRole('link',{name:/Buka versi Draft tersimpan/})).toHaveAttribute('href',expect.stringContaining('/supplier/catalog/new?draft='));
  });

  it("removes every recovery for the published offer, including its original copy, and keeps other drafts", async () => {
    const pickupDay = new Date(Date.now() + 5 * 86400000).toISOString().slice(0, 10);
    const schedule = { openingMode: "immediate" as const, collectionDays: 1,
      pickupStartsAt: `${pickupDay}T08:00:00+07:00`, pickupEndsAt: `${pickupDay}T12:00:00+07:00` };
    const payload = { title: "Penawaran selesai", description: "Sayuran segar", category: "Sayur & Buah" as const,
      capacityQuantity: 100, unit: "kg" as const, productPhotoUrl: "https://example.com/product.webp",
      pickupName: "Gudang tes", pickupAddress: "Bandung", pickupLatitude: -6.91, pickupLongitude: 107.6,
      tiers: [{ tierNumber: 1, minimumQuantity: 1, maximumQuantity: 24, pricePerUnit: 10000 },
        { tierNumber: 2, minimumQuantity: 25, maximumQuantity: null, pricePerUnit: 9000 }], schedule };
    const stored = JSON.stringify({ id: "published-offer", revision: 1, step: 4, draft: payload, schedule });
    localStorage.setItem("wesup:offer:supplier-test:draft:published-offer", stored);
    localStorage.setItem("wesup:offer:supplier-test:copy:source-batch:draft:published-offer", stored);
    localStorage.setItem("wesup:offer:supplier-test:draft:other-offer", "keep another offer");
    localStorage.setItem("wesup:offer:other-supplier:draft:published-offer", "keep another supplier");
    vi.mocked(fetch).mockResolvedValue({ ok: true, json: async () => ({ item: { revision: 2 }, batchId: "published-batch" }) } as Response);
    render(<OfferWizard ownerId="supplier-test" savedDraft={{ id: "published-offer", revision: 1, step: 4, payload }} />);
    fireEvent.click(screen.getByRole("checkbox"));
    fireEvent.click(screen.getByRole("button", { name: "Terbitkan penawaran" }));
    await waitFor(() => expect(screen.getByRole("button", { name: "Simpan Draft" })).toBeEnabled());
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(localStorage.getItem("wesup:offer:supplier-test:draft:published-offer")).toBeNull();
    expect(localStorage.getItem("wesup:offer:supplier-test:copy:source-batch:draft:published-offer")).toBeNull();
    expect(localStorage.getItem("wesup:offer:supplier-test:draft:other-offer")).toBe("keep another offer");
    expect(localStorage.getItem("wesup:offer:other-supplier:draft:published-offer")).toBe("keep another supplier");
  });
  it("opens the requested device recovery at its last step and saves with the newest server revision", async () => {
    const key = "wesup:offer:supplier-test:draft:saved-one";
    localStorage.setItem(key, JSON.stringify({ id: "", revision: 1, step: 2, draft: { title: "Perubahan lokal" }, schedule: { openingMode: "immediate", collectionDays: 1, pickupStartsAt: "", pickupEndsAt: "" } }));
    render(<OfferWizard ownerId="supplier-test" recoveryKey={key} savedDraft={{ id: "saved-one", revision: 5, step: 1, payload: { title: "Versi server" } }} />);
    await waitFor(() => expect(screen.getByLabelText("Langkah pembuatan penawaran").querySelector('[aria-current="step"]')).toHaveTextContent("2. Harga"));
    expect(screen.getByRole("status")).toHaveTextContent("Foto yang belum tersimpan perlu dipilih kembali");
    fireEvent.click(screen.getByRole("button", { name: "Simpan Draft" }));
    await waitFor(() => expect(fetch).toHaveBeenCalled());
    const body = vi.mocked(fetch).mock.calls[0][1]?.body as FormData;
    expect(body.get("id")).toBe("saved-one"); expect(body.get("revision")).toBe("5");
    expect(JSON.parse(String(body.get("payload"))).title).toBe("Perubahan lokal");
  });
  it("refuses a recovery belonging to another supplier", async () => {
    const key = "wesup:offer:other-supplier:draft:private";
    localStorage.setItem(key, JSON.stringify({ id: "", step: 1, draft: { title: "Private" }, schedule: { openingMode: "immediate", collectionDays: 1, pickupStartsAt: "", pickupEndsAt: "" } }));
    render(<OfferWizard ownerId="supplier-test" recoveryKey={key} />);
    expect(await screen.findByRole("alert")).toHaveTextContent("Draft perangkat tidak tersedia");
    expect(screen.getByLabelText(/Nama Produk/)).toHaveValue(""); expect(fetch).not.toHaveBeenCalled();
    expect(localStorage.getItem(key)).toContain("Private");
  });
  it("opens a selected copy recovery without restoring the review consent", async () => {
    const key = "wesup:offer:supplier-test:copy:source:draft:copy-one";
    localStorage.setItem(key, JSON.stringify({ id: "", step: 4, draft: { title: "Salinan pilihan" }, schedule: { openingMode: "immediate", collectionDays: 1, pickupStartsAt: "", pickupEndsAt: "" } }));
    render(<OfferWizard ownerId="supplier-test" recoveryKey={key} copySourceId="source" />);
    expect(await screen.findByRole("heading", { name: "Salinan pilihan" })).toBeVisible();
    expect(screen.getByRole("checkbox")).not.toBeChecked(); expect(screen.getByRole("button", { name: "Terbitkan penawaran" })).toBeDisabled();
  });
  it("defaults the manual target to capacity and keeps an explicit lower target", async () => {
    render(<OfferWizard ownerId="supplier-test" />);
    const capacity = screen.getByLabelText(/Kapasitas maksimum/);
    const minimum = screen.getByLabelText(/Target minimum untuk membuka pembayaran/);
    expect(minimum).toHaveValue(100);
    fireEvent.change(capacity, { target: { value: "80" } }); expect(minimum).toHaveValue(80);
    fireEvent.change(minimum, { target: { value: "40" } });
    fireEvent.change(capacity, { target: { value: "90" } }); expect(minimum).toHaveValue(40);
    fireEvent.click(screen.getByRole("button", { name: "Simpan Draft" }));
    await waitFor(() => expect(fetch).toHaveBeenCalled());
    const body = vi.mocked(fetch).mock.calls[0][1]?.body as FormData;
    expect(JSON.parse(String(body.get("payload"))).earlyPaymentMinimumQuantity).toBe(40);
  });
  it("recovers the independent target only when the saved draft is selected", async () => {
    localStorage.setItem("wesup:offer:supplier-test:draft:target", JSON.stringify({ draft: { title: "Target tersimpan", capacityQuantity: 80, earlyPaymentMinimumQuantity: 35 }, step: 1, id: "target", revision: null, schedule: { openingMode: "immediate", collectionDays: 1, pickupStartsAt: "", pickupEndsAt: "" } }));
    render(<OfferWizard ownerId="supplier-test" />);
    expect(screen.getByLabelText(/Target minimum untuk membuka pembayaran/)).toHaveValue(100);
    fireEvent.click(await screen.findByRole("button", { name: "Lanjutkan Draft Target tersimpan" }));
    expect(screen.getByLabelText(/Target minimum untuk membuka pembayaran/)).toHaveValue(35);
  });

});
