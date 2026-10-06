import { describe, expect, it } from "vitest";
import { calculateRecoveryDeadline, isRecoveryCandidate } from "../../scripts/recover-supplier-transaction-incident.mjs";

describe("supplier transaction incident recovery", () => {
  it("limits restoration to at most 100 orders in each explicit batch",()=>{
    expect(isRecoveryCandidate({status:"published",registrationClosedAt:"2026-09-11T03:36:00Z",now:"2026-09-16T10:00:00Z",registeredOrderCount:101,invoicesIssuedAt:null}).reason).toBe("RECOVERY_ROW_LIMIT");
  });
  it("calculates a database-time recovery deadline", () => {
    expect(calculateRecoveryDeadline("2026-09-16T10:00:00.000Z", 24)).toBe("2026-09-17T10:00:00.000Z");
  });

  it("allows only an expired published batch with registered orders and no invoice", () => {
    expect(isRecoveryCandidate({
      status: "published",
      registrationClosedAt: "2026-09-11T03:36:00.000Z",
      now: "2026-09-16T10:00:00.000Z",
      invoicesIssuedAt: null,
      registeredOrderCount: 2,
      nonRegisteredOrderCount: 0,
    })).toEqual({ eligible: true });
    expect(isRecoveryCandidate({
      status: "closed",
      registrationClosedAt: "2026-09-11T03:36:00.000Z",
      now: "2026-09-16T10:00:00.000Z",
      invoicesIssuedAt: null,
      registeredOrderCount: 2,
      nonRegisteredOrderCount: 0,
    }).eligible).toBe(false);
  });
});
