import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { isUuid } from "@/lib/admin/validation";
import { getAdminClient } from "@/lib/supabase/admin";
import { resolveActiveUmkm } from "@/lib/umkm/workspace-auth";
import { enforceRateLimit } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";
const MAX_FILE_BYTES = 10 * 1024 * 1024;
const ALLOWED_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

function fail(error: string, code: string, status: number, details?: unknown) { return NextResponse.json({ error, code, ...(details === undefined ? {} : { details }) }, { status }); }

export async function POST(request: Request, { params }: { params: Promise<{ orderId: string }> }) {
  const viewer = await resolveActiveUmkm();
  if (!viewer.client) return viewer.response;
  const { orderId } = await params;
  if (!isUuid(orderId)) return fail("Pesanan tidak ditemukan", "ORDER_NOT_FOUND", 404);
  const limited = await enforceRateLimit(request, "route", viewer.context.userId);
  if (limited) return limited;
  let form: FormData;
  try { form = await request.formData(); } catch { return fail("Form komplain tidak valid", "INVALID_FORM", 400); }
  const category = String(form.get("category") ?? form.get("complaintCategory") ?? "").toLowerCase();
  if (category !== "cacat" && category !== "busuk") return fail("Kategori komplain wajib cacat atau busuk", "INVALID_COMPLAINT_CATEGORY", 400);
  const descriptionValue = form.get("description");
  const description = descriptionValue === null ? "" : String(descriptionValue).trim();
  if (description.length > 2_000) return fail("Deskripsi komplain terlalu panjang", "INVALID_DESCRIPTION", 400);
  const files = form.getAll("photos").filter((value): value is File => typeof File !== "undefined" && value instanceof File && value.size > 0);
  if (files.length < 1 || files.length > 5) return fail("Unggah 1 sampai 5 foto bukti", "PHOTO_REQUIRED", 400);
  for (const file of files) {
    if (!ALLOWED_TYPES.has(file.type) || file.size > MAX_FILE_BYTES) return fail("Foto harus JPEG, PNG, atau WebP maksimal 10 MB", "INVALID_PHOTO", 400);
  }

  let admin;
  try { admin = getAdminClient(); } catch { return fail("Penyimpanan bukti belum siap", "STORAGE_UNAVAILABLE", 503); }
  const uploaded: string[] = [];
  try {
    for (const file of files) {
      const extension = file.type === "image/png" ? "png" : file.type === "image/webp" ? "webp" : "jpg";
      const path = `disputes/${viewer.context.userId}/${orderId}/${randomUUID()}.${extension}`;
      const bytes = Buffer.from(await file.arrayBuffer());
      const upload = await admin.storage.from("wesup-assets").upload(path, bytes, { contentType: file.type, upsert: false });
      if (upload.error) throw new Error("photo upload failed");
      uploaded.push(path);
    }
    const rpc = (viewer.client as unknown as { rpc: (name: string, args: Record<string, unknown>) => PromiseLike<{ data?: unknown; error?: { message?: string } | null }> }).rpc;
    const result = await rpc("submit_order_complaint", { p_registration_id: orderId, p_complaint_category: category, p_description: description, p_photo_urls: uploaded });
    if (result.error) {
      const message = result.error.message ?? "Komplain tidak dapat diajukan";
      const status = /closed|window|already|rating/i.test(message) ? 409 : /sign in|owner/i.test(message) ? 403 : 500;
      await admin.storage.from("wesup-assets").remove(uploaded).catch(() => undefined);
      return fail(message, status === 409 ? "COMPLAINT_WINDOW_CLOSED" : "COMPLAINT_SUBMIT_FAILED", status);
    }
    return NextResponse.json({ ok: true, disputeId: result.data, photoUrls: uploaded }, { status: 201 });
  } catch (error) {
    await admin.storage.from("wesup-assets").remove(uploaded).catch(() => undefined);
    return fail(error instanceof Error && error.message === "photo upload failed" ? "Bukti foto belum dapat diunggah" : "Komplain belum dapat diajukan", "COMPLAINT_SUBMIT_FAILED", 503);
  }
}
