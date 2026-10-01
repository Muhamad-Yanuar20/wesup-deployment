import { describe, expect, it } from "vitest";
import { validateEarlyPaymentTarget, earlyPaymentEligibility } from "@/lib/transactions/early-payment";

describe("early payment opening", () => {
  it.each([0, -1, 101, 1.5, NaN])("rejects an invalid minimum %s", value => {
    expect(validateEarlyPaymentTarget(value, 100)).toBeTruthy();
  });
  it.each([1, 40, 100])("accepts an independent target %s", value => {
    expect(validateEarlyPaymentTarget(value, 100)).toBeNull();
  });
  const base = { open: true, withinWindow: true, volume: 40, minimum: 40, participants: 2, accepted: 2, rejected: 0, requiresApproval: true };
  it("allows unanimous consent at the exact target", () => expect(earlyPaymentEligibility(base)).toEqual({ allowed: true, reason: null }));
  it("does not count partial consent as unanimous", () => expect(earlyPaymentEligibility({ ...base, accepted: 1 }).allowed).toBe(false));
  it("blocks rejection, even when the other counts are stale", () => expect(earlyPaymentEligibility({ ...base, rejected: 1 }).allowed).toBe(false));
  it("requires positive participants and actual volume after withdrawal", () => {
    expect(earlyPaymentEligibility({ ...base, volume: 39 }).allowed).toBe(false);
    expect(earlyPaymentEligibility({ ...base, participants: 0, accepted: 0 }).allowed).toBe(false);
  });
  it("original-consent offers need no new ballot", () => expect(earlyPaymentEligibility({ ...base, requiresApproval: false, accepted: 0 }).allowed).toBe(true));
  it("never authorizes after cutoff or closure", () => {
    expect(earlyPaymentEligibility({ ...base, withinWindow: false }).allowed).toBe(false);
    expect(earlyPaymentEligibility({ ...base, open: false }).allowed).toBe(false);
  });
});
