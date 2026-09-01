import { describe, expect, it } from "vitest";
import { validateCreateBatch } from "@/lib/catalog/batch-validators";

function basePayload(): Record<string, unknown> {
  return {
    title: "Sayur Segar",
    category: "Vegetables",
    minQuantity: 5,
    pickupAddress: "Jl. Cihampelas 1, Bandung",
    latitude: -6.912,
    longitude: 107.609,
    registrationOpensAt: "2026-09-01T09:00:00Z",
    registrationClosesAt: "2026-09-02T09:00:00Z",
    paymentOpensAt: "2026-09-02T12:00:00Z",
    paymentClosesAt: "2026-09-03T12:00:00Z",
    estimatedReadyAt: "2026-09-04T10:00:00Z",
    tiers: [
      { minVolume: 5, maxVolume: 50, pricePerUnit: 10000 },
      { minVolume: 51, maxVolume: 200, pricePerUnit: 9000 },
    ],
  };
}

describe("validateCreateBatch", () => {
  it("accepts a valid payload", () => {
    const result = validateCreateBatch(basePayload());
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.title).toBe("Sayur Segar");
      expect(result.value.tiers).toHaveLength(2);
    }
  });

  it("rejects a non-linear timeline", () => {
    const body = basePayload();
    body.registrationClosesAt = "2026-09-05T09:00:00Z";
    const result = validateCreateBatch(body);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatch(/linear/i);
  });

  it("rejects coordinates outside the Bandung region", () => {
    const body = basePayload();
    body.latitude = -2.0;
    const result = validateCreateBatch(body);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatch(/Bandung/i);
  });

  it("rejects missing required fields", () => {
    const body = basePayload();
    delete body.title;
    const result = validateCreateBatch(body);
    expect(result.ok).toBe(false);
  });

  it("rejects overlapping tier volume ranges", () => {
    const body = basePayload();
    body.tiers = [
      { minVolume: 5, maxVolume: 100, pricePerUnit: 10000 },
      { minVolume: 60, maxVolume: 200, pricePerUnit: 9000 },
    ];
    const result = validateCreateBatch(body);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatch(/overlap/i);
  });

  it("rejects tier price inversion", () => {
    const body = basePayload();
    body.tiers = [
      { minVolume: 5, maxVolume: 50, pricePerUnit: 10000 },
      { minVolume: 51, maxVolume: 200, pricePerUnit: 12000 },
    ];
    const result = validateCreateBatch(body);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatch(/invert/i);
  });

  it("normalizes optional description and photo", () => {
    const body = basePayload();
    body.description = "   ";
    body.productPhotoUrl = "https://example.com/p.jpg";
    const result = validateCreateBatch(body);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.description).toBeUndefined();
      expect(result.value.productPhotoUrl).toBe("https://example.com/p.jpg");
    }
  });

  it("accepts a tier without maxVolume", () => {
    const body = basePayload();
    body.tiers = [{ minVolume: 5, pricePerUnit: 10000 }];
    const result = validateCreateBatch(body);
    expect(result.ok).toBe(true);
  });

  it("rejects an empty tiers array", () => {
    const body = basePayload();
    body.tiers = [];
    const result = validateCreateBatch(body);
    expect(result.ok).toBe(false);
  });
});
