import { validateEarlyPaymentTarget } from "@/lib/transactions/early-payment";
import { NextResponse } from "next/server";
import { getServerClient } from "@/lib/supabase/server";
import { requireRole, toAuthResponse, type AuthClient } from "@/lib/supabase/auth";
import { isUuid } from "@/lib/admin/validation";
import { transactionError, type TransactionRpcClient } from "@/lib/transactions/api";
import { buildOfferSchedule, fromWibInput, normalizePriceTiers, type OfferScheduleInput } from "@/lib/transactions/schedule";
import { validateCatalogMutation } from "@/lib/supplier-catalog/validation";
import { validateBusinessPhoto } from "@/lib/supplier-registration/contracts";

export const dynamic = "force-dynamic";
async function draftError(error:unknown,item:unknown) {
  const response=transactionError(error);
  return NextResponse.json({...await response.json(),item},{status:response.status});
}

export async function GET(request: Request) {
  const client = await getServerClient();
  try {
    const user = await requireRole(client as unknown as AuthClient, ["supplier"]);
    const id = new URL(request.url).searchParams.get("id");
    if (id && !isUuid(id)) return NextResponse.json({ error: "Draft tidak ditemukan." }, { status: 404 });
    const query = client.from("supplier_offer_drafts" as never).select("*").eq("supplier_id", user.userId);
    const result = id ? await query.eq("id", id).maybeSingle() : await query.is("published_batch_id", null).order("updated_at", { ascending: false });
    if (result.error) return transactionError(result.error);
    return NextResponse.json(id ? { item: result.data } : { items: result.data, serverTime: new Date().toISOString() });
  } catch (error) { return toAuthResponse(error); }
}

export async function POST(request: Request) {
  const client = await getServerClient();
  try { await requireRole(client as unknown as AuthClient, ["supplier"]); } catch (error) { return toAuthResponse(error); }
  try {
    const form = await request.formData();
    const id = String(form.get("id") ?? "");
    if (!isUuid(id)) return NextResponse.json({ error: "Identitas draft tidak valid." }, { status: 400 });
    const payload = JSON.parse(String(form.get("payload") ?? "{}"));
    if (!payload || typeof payload !== "object" || Array.isArray(payload)) return NextResponse.json({ error: "Draft tidak valid." }, { status: 400 });
    const step = Number(form.get("step") ?? 1);
    const rawRevision = form.get("revision");
    const revision = rawRevision === null || rawRevision === "" ? null : Number(rawRevision);
    const rpc = client as unknown as TransactionRpcClient;
    const saved = await rpc.rpc("save_supplier_offer_draft", { p_id: id, p_payload: payload, p_step: step, p_revision: revision });
    if (saved.error) return transactionError(saved.error);
    const draft = saved.data as { revision: number; published_batch_id?: string };
    if (draft.published_batch_id) return NextResponse.json({ item: draft, batchId: draft.published_batch_id });

    let schedule;
    let tiers;
    if (form.get("action") === "publish") try {
      const rawSchedule = payload.schedule as OfferScheduleInput;
      schedule = buildOfferSchedule(rawSchedule, new Date().toISOString());
      payload.schedule = { ...rawSchedule, scheduledOpensAt: rawSchedule.scheduledOpensAt ? fromWibInput(rawSchedule.scheduledOpensAt) : undefined, pickupStartsAt: fromWibInput(rawSchedule.pickupStartsAt), pickupEndsAt: fromWibInput(rawSchedule.pickupEndsAt) };
      tiers = normalizePriceTiers(payload.tiers);
    } catch (error) { return NextResponse.json({ item: draft,error: error instanceof Error ? error.message : "Jadwal belum lengkap." }, { status: 400 }); }
    if (form.get("action") === "publish") {
      const minimumError = validateEarlyPaymentTarget(payload.earlyPaymentMinimumQuantity, payload.capacityQuantity);
      if (minimumError) return NextResponse.json({ item: draft, error: minimumError }, { status: 400 });
    }
    const validation = form.get("action") === "publish" ? validateCatalogMutation({ ...payload, ...schedule, targetQuantity: tiers!.at(-1)!.minimumQuantity, tiers, paymentWindowHours: 24, productPhotoUrl: null, transactionPolicyVersion: 2 }, { allowPastTimeline: true }) : null;
    if (validation && !validation.ok) return NextResponse.json({ item: draft,error: Object.values(validation.fieldErrors)[0], fieldErrors: validation.fieldErrors }, { status: 400 });
    const photo = form.get("productPhoto");
    let photoUrl: string | null = null;
    if (photo instanceof File && photo.size) {
      const photoError = await validateBusinessPhoto(photo);
      if (photoError) return NextResponse.json({ item:draft,error: photoError }, { status: 400 });
      const path = `products/${id}/${crypto.randomUUID()}.webp`;
      const uploaded = await client.storage.from("wesup-public").upload(path, photo, { contentType: "image/webp", upsert: false });
      if (uploaded.error) return draftError(uploaded.error,draft);
      photoUrl = client.storage.from("wesup-public").getPublicUrl(path).data.publicUrl;
    } else if (typeof payload.productPhotoUrl === "string") {
      if (payload.productPhotoUrl === (saved.data as {payload?: {productPhotoUrl?:string}}).payload?.productPhotoUrl && payload.productPhotoUrl.includes(`/products/${id}/`)) photoUrl = payload.productPhotoUrl;
      // Reused images must belong to the supplier (storage policy supplies ownership).
      const existing = await client.from("batches").select("id").eq("product_photo_url", payload.productPhotoUrl).eq("supplier_id", (await requireRole(client as unknown as AuthClient, ["supplier"])).userId).limit(1);
      if (existing.data?.length) photoUrl = payload.productPhotoUrl;
    }
    if (form.get("action") === "publish" && !photoUrl) return NextResponse.json({ item:draft,error: "Unggah foto produk sebelum menerbitkan." }, { status: 400 });
    payload.productPhotoUrl = photoUrl;
    // Normalize timezone strings in the saved payload before the SQL authority derives times.
    const normalized = await rpc.rpc("save_supplier_offer_draft", { p_id: id, p_payload: payload, p_step: step, p_revision: draft.revision });
    if (normalized.error) return transactionError(normalized.error);
    if (form.get("action") !== "publish") return NextResponse.json({ item: normalized.data });
    const finalDraft = normalized.data as { revision: number };
    const published = await rpc.rpc("publish_supplier_offer", { p_draft_id: id, p_revision: finalDraft.revision, p_photo_url: photoUrl });
    if (published.error) return draftError(published.error,normalized.data);
    return NextResponse.json({ item: normalized.data, batchId: published.data });
  } catch (error) { return transactionError(error); }
}
