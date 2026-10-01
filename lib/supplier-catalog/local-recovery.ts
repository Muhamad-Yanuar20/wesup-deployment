import type { CatalogDraft } from "@/lib/supplier-catalog/types";
import type { OfferScheduleInput } from "@/lib/transactions/schedule";

export interface LocalOfferRecovery {
  key: string;
  id: string;
  revision: number | null;
  step: number;
  draft: Partial<CatalogDraft>;
  schedule: OfferScheduleInput;
  updatedAt: number;
}

export function offerRecoveryScope(ownerId: string, copySourceId?: string) {
  return `wesup:offer:${ownerId}${copySourceId ? `:copy:${copySourceId}` : ""}`;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function validDate(value: unknown): value is string {
  return typeof value === "string" && (value === "" || Number.isFinite(Date.parse(value)));
}

function parseRecovery(key: string, raw: string): LocalOfferRecovery | null {
  try {
    const value: unknown = JSON.parse(raw);
    if (!isRecord(value) || !isRecord(value.draft) || !isRecord(value.schedule)) return null;
    if (!Number.isInteger(value.step) || Number(value.step) < 1 || Number(value.step) > 4) return null;
    const schedule = value.schedule;
    if (!["immediate", "scheduled"].includes(String(schedule.openingMode)) ||
      ![1, 2, 3, 7].includes(Number(schedule.collectionDays)) || typeof schedule.collectionDays !== "number" ||
      !validDate(schedule.pickupStartsAt) || !validDate(schedule.pickupEndsAt) ||
      (schedule.scheduledOpensAt !== undefined && !validDate(schedule.scheduledOpensAt))) return null;

    // Recover only known, renderable fields. Full business validation still runs
    // on Continue / Publish; partial drafts are intentionally allowed here.
    const draft: Record<string, unknown> = {};
    for (const field of ["title", "category", "description", "unit", "pickupName", "pickupAddress"] as const) {
      if (value.draft[field] !== undefined) {
        if (typeof value.draft[field] !== "string") return null;
        draft[field] = value.draft[field];
      }
    }
    for (const field of ["targetQuantity", "capacityQuantity", "earlyPaymentMinimumQuantity", "paymentWindowHours", "pickupLatitude", "pickupLongitude"] as const) {
      const fieldValue = value.draft[field];
      if (fieldValue !== undefined) {
        if (fieldValue !== null && (typeof fieldValue !== "number" || !Number.isFinite(fieldValue))) return null;
        if (fieldValue === null && field !== "pickupLatitude" && field !== "pickupLongitude") return null;
        draft[field] = fieldValue;
      }
    }
    for (const field of ["registrationOpensAt", "registrationClosesAt", "paymentOpensAt", "paymentClosesAt", "estimatedReadyAt"] as const) {
      if (value.draft[field] !== undefined) {
        if (!validDate(value.draft[field])) return null;
        draft[field] = value.draft[field];
      }
    }
    if (value.draft.productPhotoUrl !== undefined) {
      if (value.draft.productPhotoUrl !== null && typeof value.draft.productPhotoUrl !== "string") return null;
      draft.productPhotoUrl = value.draft.productPhotoUrl;
    }
    if (value.draft.tiers !== undefined) {
      if (!Array.isArray(value.draft.tiers) || value.draft.tiers.length === 0 || value.draft.tiers.some(tier =>
        !isRecord(tier) || ["tierNumber", "minimumQuantity", "pricePerUnit"].some(field =>
          typeof tier[field] !== "number" || !Number.isFinite(tier[field])) ||
        (tier.maximumQuantity !== null && (typeof tier.maximumQuantity !== "number" || !Number.isFinite(tier.maximumQuantity))))) return null;
      draft.tiers = value.draft.tiers;
    }
    return {
      key, draft: draft as Partial<CatalogDraft>,
      schedule: schedule as unknown as OfferScheduleInput,
      step: Number(value.step),
      id: typeof value.id === "string" ? value.id : "",
      revision: typeof value.revision === "number" && Number.isInteger(value.revision) && value.revision > 0 ? value.revision : null,
      updatedAt: typeof value.updatedAt === "number" && Number.isFinite(value.updatedAt) ? value.updatedAt : 0,
    };
  } catch {
    return null;
  }
}

export function listOfferRecoveries(storage: Storage, scope: string): LocalOfferRecovery[] {
  const recoveries: LocalOfferRecovery[] = [];
  for (let index = 0; index < storage.length; index++) {
    const key = storage.key(index);
    // The unsuffixed key is the legacy single-draft format. Copy drafts and
    // drafts belonging to another owner are never included in this scope.
    if (!key || (key !== scope && !key.startsWith(`${scope}:draft:`))) continue;
    const raw = storage.getItem(key);
    const recovery = raw ? parseRecovery(key, raw) : null;
    if (recovery) recoveries.push(recovery);
  }
  return recoveries.sort((a, b) => b.updatedAt - a.updatedAt);
}

export function removeOfferRecoveries(storage: Storage, ownerId: string, draftId: string) {
  const scope = offerRecoveryScope(ownerId);
  const keys: string[] = [];
  for (let index = 0; index < storage.length; index++) {
    const key = storage.key(index);
    if (!key || (key !== scope && !key.startsWith(`${scope}:draft:`) && !key.startsWith(`${scope}:copy:`))) continue;
    const raw = storage.getItem(key);
    if (key.endsWith(`:draft:${draftId}`) || (raw && parseRecovery(key, raw)?.id === draftId)) keys.push(key);
  }
  keys.forEach(key => storage.removeItem(key));
}
