import type { Metadata } from "next";
import OfferWizard, { type SavedOfferDraft } from "@/components/supplier/catalog/OfferWizard";
import { getServerClient } from "@/lib/supabase/server";
import { requireRole, type AuthClient } from "@/lib/supabase/auth";
import { isUuid } from "@/lib/admin/validation";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Buat Penawaran Baru | Wesup",
  description: "Buat penawaran bahan baku baru untuk UMKM di Bandung.",
};

export default async function NewCatalogPage({ searchParams }: { searchParams: Promise<{ draft?: string; copy?: string }> }) {
  const client = await getServerClient();
  const owner = await requireRole(client as unknown as AuthClient, ["supplier"]);
  const search = await searchParams;
  const profile = await client.from("supplier_profiles").select("business_name,address,latitude,longitude").eq("user_id", owner.userId).maybeSingle();
  const saved = search.draft && isUuid(search.draft) ? await client.from("supplier_offer_drafts" as never).select("*").eq("id", search.draft).eq("supplier_id", owner.userId).maybeSingle() : null;
  const savedDraft = saved?.data as SavedOfferDraft | null;
  let initialDraft = { pickupName: profile.data?.business_name ?? "", pickupAddress: profile.data?.address ?? "", pickupLatitude: profile.data?.latitude ?? null, pickupLongitude: profile.data?.longitude ?? null };
  if (search.copy && isUuid(search.copy)) {
    const copy = await client.from("batches").select("title,description,category,unit,capacity_quantity,product_photo_url,batch_tiers(tier_number,min_volume,max_volume,price_per_unit)").eq("id",search.copy).eq("supplier_id",owner.userId).maybeSingle();
    if(copy.data) initialDraft = { ...initialDraft, title:copy.data.title,description:copy.data.description,category:copy.data.category,unit:copy.data.unit,capacityQuantity:copy.data.capacity_quantity,productPhotoUrl:copy.data.product_photo_url,tiers:(copy.data.batch_tiers as unknown as Array<{tier_number:number;min_volume:number;max_volume:number|null;price_per_unit:number}>).map(t=>({tierNumber:t.tier_number,minimumQuantity:t.min_volume,maximumQuantity:t.max_volume,pricePerUnit:Number(t.price_per_unit)})) } as typeof initialDraft;
  }
  return (
    <main className="min-h-screen bg-slate-50 px-4 py-8 sm:px-6 sm:py-10 lg:px-8">
      <div className="mx-auto w-full max-w-6xl">
        <header className="mb-8 text-center sm:mb-10">
          <span className="inline-flex rounded-full border border-blue-200 bg-white/80 px-3 py-1 text-xs font-bold uppercase tracking-[0.2em] text-blue-700 shadow-sm">
            Penawaran Baru
          </span>
          <h1 className="mt-4 text-3xl font-extrabold tracking-tight text-slate-950 sm:text-4xl">
            Buat Penawaran
          </h1>
          <p className="mx-auto mt-3 max-w-2xl text-base leading-7 text-slate-600 sm:text-lg">
            Isi detail penawaran bahan baku Anda untuk UMKM di Bandung.
          </p>
        </header>
        <OfferWizard key={savedDraft?.id ?? search.copy ?? "new"} ownerId={owner.userId} initialDraft={initialDraft} savedDraft={savedDraft} copySourceId={search.copy} />
      </div>
    </main>
  );
}
