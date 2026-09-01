import { isIsoTimestamp } from "@/lib/admin/validation";

export interface TierInput {
  minVolume: number;
  maxVolume?: number | null;
  pricePerUnit: number;
}

export interface CreateBatchPayload {
  title: string;
  description?: string;
  category: string;
  minQuantity: number;
  productPhotoUrl?: string;
  pickupAddress: string;
  latitude: number;
  longitude: number;
  registrationOpensAt: string;
  registrationClosesAt: string;
  paymentOpensAt: string;
  paymentClosesAt: string;
  estimatedReadyAt: string;
  tiers: TierInput[];
  recurringConfigId?: string;
}

export type ValidationResult =
  | { ok: true; value: CreateBatchPayload }
  | { ok: false; error: string };

const BANDUNG_BOUNDS = {
  minLat: -7.1,
  maxLat: -6.5,
  minLng: 107.4,
  maxLng: 107.9,
};

export function validateCreateBatch(body: Record<string, unknown>): ValidationResult {
  const required = [
    "title",
    "category",
    "minQuantity",
    "pickupAddress",
    "latitude",
    "longitude",
    "registrationOpensAt",
    "registrationClosesAt",
    "paymentOpensAt",
    "paymentClosesAt",
    "estimatedReadyAt",
    "tiers",
  ] as const;

  for (const key of required) {
    if (body[key] === undefined || body[key] === null || body[key] === "") {
      return { ok: false, error: `${key} is required` };
    }
  }

  const title = String(body.title).trim();
  if (!title) return { ok: false, error: "title is required" };

  const category = String(body.category).trim();
  if (!category) return { ok: false, error: "category is required" };

  const minQuantity = Number(body.minQuantity);
  if (!Number.isInteger(minQuantity) || minQuantity <= 0) {
    return { ok: false, error: "minQuantity must be a positive integer" };
  }

  const pickupAddress = String(body.pickupAddress).trim();
  if (!pickupAddress) return { ok: false, error: "pickupAddress is required" };

  const latitude = Number(body.latitude);
  const longitude = Number(body.longitude);
  if (Number.isNaN(latitude) || Number.isNaN(longitude)) {
    return { ok: false, error: "latitude and longitude must be numbers" };
  }
  if (
    latitude < BANDUNG_BOUNDS.minLat ||
    latitude > BANDUNG_BOUNDS.maxLat ||
    longitude < BANDUNG_BOUNDS.minLng ||
    longitude > BANDUNG_BOUNDS.maxLng
  ) {
    return { ok: false, error: "location is outside the Bandung operating region" };
  }

  const strings = [
    "registrationOpensAt",
    "registrationClosesAt",
    "paymentOpensAt",
    "paymentClosesAt",
    "estimatedReadyAt",
  ] as const;
  const times: Record<string, string> = {};
  for (const key of strings) {
    const value = String(body[key]);
    if (!isIsoTimestamp(value)) {
      return { ok: false, error: `${key} must be a valid ISO timestamp` };
    }
    times[key] = value;
  }

  if (
    !(
      Date.parse(times.registrationOpensAt) < Date.parse(times.registrationClosesAt) &&
      Date.parse(times.registrationClosesAt) < Date.parse(times.paymentOpensAt) &&
      Date.parse(times.paymentOpensAt) < Date.parse(times.paymentClosesAt) &&
      Date.parse(times.paymentClosesAt) < Date.parse(times.estimatedReadyAt)
    )
  ) {
    return {
      ok: false,
      error: "timeline must be linear: open < close < payment open < payment close < ready",
    };
  }

  if (!Array.isArray(body.tiers) || body.tiers.length === 0) {
    return { ok: false, error: "at least one tier is required" };
  }

  const tiers: TierInput[] = [];
  let prevMin = 0;
  let prevMax = 0;
  let prevPrice = 0;
  for (const raw of body.tiers as unknown[]) {
    const t = raw as Record<string, unknown>;
    const minVolume = Number(t.minVolume);
    const pricePerUnit = Number(t.pricePerUnit);
    if (!Number.isInteger(minVolume) || minVolume <= 0 || !(pricePerUnit > 0)) {
      return { ok: false, error: "each tier requires a positive minVolume and pricePerUnit" };
    }
    if (minVolume <= prevMin) {
      return { ok: false, error: "tier volume ranges must be strictly increasing" };
    }
    if (prevMax > 0 && minVolume <= prevMax) {
      return { ok: false, error: "tier volume ranges must not overlap" };
    }
    if (pricePerUnit > prevPrice && prevPrice > 0) {
      return { ok: false, error: "tier price must not invert (higher volume cannot cost more per unit)" };
    }
    const maxVolumeRaw = t.maxVolume;
    let maxVolume: number | null = null;
    if (maxVolumeRaw !== undefined && maxVolumeRaw !== null && maxVolumeRaw !== "") {
      maxVolume = Number(maxVolumeRaw);
      if (!Number.isInteger(maxVolume) || maxVolume < minVolume) {
        return { ok: false, error: "maxVolume must be >= minVolume" };
      }
    }
    tiers.push({ minVolume, maxVolume, pricePerUnit });
    prevMin = minVolume;
    prevMax = maxVolume ?? minVolume;
    prevPrice = pricePerUnit;
  }

  const productPhotoUrl =
    typeof body.productPhotoUrl === "string" && body.productPhotoUrl.trim() !== ""
      ? body.productPhotoUrl
      : undefined;
  const description =
    typeof body.description === "string" && body.description.trim() !== ""
      ? body.description
      : undefined;
  const recurringConfigId =
    typeof body.recurringConfigId === "string" && body.recurringConfigId.trim() !== ""
      ? body.recurringConfigId
      : undefined;

  return {
    ok: true,
    value: {
      title,
      description,
      category,
      minQuantity,
      productPhotoUrl,
      pickupAddress,
      latitude,
      longitude,
      registrationOpensAt: times.registrationOpensAt,
      registrationClosesAt: times.registrationClosesAt,
      paymentOpensAt: times.paymentOpensAt,
      paymentClosesAt: times.paymentClosesAt,
      estimatedReadyAt: times.estimatedReadyAt,
      tiers,
      recurringConfigId,
    },
  };
}
