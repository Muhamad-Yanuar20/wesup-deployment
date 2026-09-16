import { describe, expect, it } from "vitest";
import {
  evaluateSupplierBatchClose,
  resolveSupplierTier,
  type SupplierBatchCloseInput,
} from "@/lib/supplier-batch/transaction-lifecycle";

const baseInput = (overrides: Partial<SupplierBatchCloseInput> = {}): SupplierBatchCloseInput => ({
  status: "published",
  trigger: "supplier_manual",
  now: "2026-09-15T10:00:00.000Z",
  registrationClosesAt: "2026-09-15T12:00:00.000Z",
  registeredQuantity: 100,
  minimumQuantity: 50,
  capacityQuantity: 200,
  paymentWindowHours: 24,
  ...overrides,
});

describe("supplier batch close lifecycle", () => {
  it("allows manual close after the minimum quantity and opens payment immediately", () => {
    const decision = evaluateSupplierBatchClose(baseInput());

    expect(decision).toEqual({
      allowed: true,
      closeAt: "2026-09-15T10:00:00.000Z",
      paymentOpensAt: "2026-09-15T10:00:00.000Z",
      paymentClosesAt: "2026-09-16T10:00:00.000Z",
    });
  });

  it("rejects manual close before the minimum quantity", () => {
    const decision = evaluateSupplierBatchClose(baseInput({ registeredQuantity: 49 }));

    expect(decision).toEqual({ allowed: false, reason: "minimum_not_reached" });
  });

  it("closes automatically at capacity even before the scheduled cutoff", () => {
    const decision = evaluateSupplierBatchClose(baseInput({
      trigger: "capacity_reached",
      registeredQuantity: 200,
    }));

    expect(decision.allowed).toBe(true);
    expect(decision.closeAt).toBe("2026-09-15T10:00:00.000Z");
    expect(decision.paymentClosesAt).toBe("2026-09-16T10:00:00.000Z");
  });

  it("uses the scheduled cutoff as the effective close time", () => {
    const decision = evaluateSupplierBatchClose(baseInput({
      trigger: "registration_expired",
      now: "2026-09-15T15:00:00.000Z",
    }));

    expect(decision).toEqual({
      allowed: true,
      closeAt: "2026-09-15T12:00:00.000Z",
      paymentOpensAt: "2026-09-15T12:00:00.000Z",
      paymentClosesAt: "2026-09-16T12:00:00.000Z",
    });
  });

  it("rejects a non-published batch and an invalid duration", () => {
    expect(evaluateSupplierBatchClose(baseInput({ status: "closed" }))).toEqual({
      allowed: false,
      reason: "batch_not_open",
    });
    expect(evaluateSupplierBatchClose(baseInput({ paymentWindowHours: 5 }))).toEqual({
      allowed: false,
      reason: "invalid_payment_window",
    });
  });

  it("locks the highest qualifying tier and falls back to tier one", () => {
    const tiers = [
      { tier_number: 1, min_volume: 1, max_volume: 99, price_per_unit: 12_000 },
      { tier_number: 2, min_volume: 100, max_volume: 199, price_per_unit: 10_000 },
      { tier_number: 3, min_volume: 200, max_volume: null, price_per_unit: 8_000 },
    ];

    expect(resolveSupplierTier(tiers, 150)).toEqual(tiers[1]);
    expect(resolveSupplierTier(tiers, 0)).toEqual(tiers[0]);
  });
});
