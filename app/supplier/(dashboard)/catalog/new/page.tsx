import type { Metadata } from "next";
import OfferWizard, { type SavedOfferDraft } from "@/components/supplier/catalog/OfferWizard";
import { getServerClient } from "@/lib/supabase/server";
import { requireRole, type AuthClient } from "@/lib/supabase/auth";
import { isUuid } from "@/lib/admin/validation";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Buat Penawaran | Wesup",
  description: "Buat katalog penawaran bahan baku baru untuk grup pembelian Wesup.",
};

export default async function NewCatalogPage({
  searchParams,
}: {
  searchParams: Promise<{ draft?: string; copy?: string; recovery?: string }>;
}) {
  const client = await getServerClient();
  const owner = await requireRole(client as unknown as AuthClient, ["supplier"]);
  const search = await searchParams;
  const profile = await client
    .from("supplier_profiles")
    .select("business_name,address,latitude,longitude")
    .eq("user_id", owner.userId)
    .maybeSingle();
  const saved =
    search.draft && isUuid(search.draft)
      ? await client
          .from("supplier_offer_drafts" as never)
          .select("*")
          .eq("id", search.draft)
          .eq("supplier_id", owner.userId)
          .maybeSingle()
      : null;
  const savedDraft = saved?.data as SavedOfferDraft | null;
  let initialDraft = {
    pickupName: profile.data?.business_name ?? "",
    pickupAddress: profile.data?.address ?? "",
    pickupLatitude: profile.data?.latitude ?? null,
    pickupLongitude: profile.data?.longitude ?? null,
  };
  if (search.copy && isUuid(search.copy)) {
    const copy = await client
      .from("batches")
      .select(
        "title,description,category,unit,capacity_quantity,early_payment_minimum_quantity,product_photo_url,batch_tiers(tier_number,min_volume,max_volume,price_per_unit)",
      )
      .eq("id", search.copy)
      .eq("supplier_id", owner.userId)
      .maybeSingle();
    if (copy.data)
      initialDraft = {
        ...initialDraft,
        title: copy.data.title,
        description: copy.data.description,
        category: copy.data.category,
        unit: copy.data.unit,
        capacityQuantity: copy.data.capacity_quantity,
        earlyPaymentMinimumQuantity:
          copy.data.early_payment_minimum_quantity ?? copy.data.capacity_quantity,
        productPhotoUrl: copy.data.product_photo_url,
        tiers: (
          copy.data.batch_tiers as unknown as Array<{
            tier_number: number;
            min_volume: number;
            max_volume: number | null;
            price_per_unit: number;
          }>
        ).map((t) => ({
          tierNumber: t.tier_number,
          minimumQuantity: t.min_volume,
          maximumQuantity: t.max_volume,
          pricePerUnit: Number(t.price_per_unit),
        })),
      } as typeof initialDraft;
  }

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-8 sm:px-6 sm:py-10 lg:px-8">
      <header className="mb-7 border-b border-wesup-ink/15 pb-7">
        <p className="mb-5 flex items-center gap-3 font-mono text-[0.6875rem] uppercase tracking-[0.24em] text-wesup-ink-sub">
          <span aria-hidden="true" className="h-px w-6 bg-wesup-red" />
          Wesup / Katalog / Baru
        </p>
        <h1 className="font-landing-display text-3xl font-normal uppercase leading-[1.05] tracking-[0.06em] text-wesup-ink text-balance sm:text-4xl md:text-5xl">
          Buat Penawaran
        </h1>
        <p className="mt-3 max-w-xl text-sm leading-6 text-wesup-ink-sub">
          Isi detail penawaran bahan baku Anda untuk UMKM di Bandung.
        </p>
      </header>
      <OfferWizard
        key={`${owner.userId}:${savedDraft?.id ?? search.copy ?? "new"}:${search.recovery ?? ""}`}
        ownerId={owner.userId}
        initialDraft={initialDraft}
        savedDraft={savedDraft}
        copySourceId={search.copy}
        recoveryKey={typeof search.recovery === "string" ? search.recovery : undefined}
      />
    </div>
  );
}
