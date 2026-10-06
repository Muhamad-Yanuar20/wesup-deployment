import { describe, expect, it } from "vitest";
import { validateRegistrationPayload } from "@/lib/admin/validation";

/**
 * `parseJsonBody` returns `null` for a missing/malformed/JSON-scalar body, so
 * the validator is the route's last line of defence: a null payload must be
 * rejected as a validation error, never thrown out of the function as a
 * `TypeError` (which would surface as a 500).
 */
const VALID_BATCH_ID = "3f1d2a5c-9b7e-4a21-8c3d-1e5f6a7b8c9d";

describe("validateRegistrationPayload", () => {
  it("rejects null input without throwing", () => {
    const result = validateRegistrationPayload(null);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.fieldErrors.batchId).toBeDefined();
    }
  });

  it("rejects undefined input without throwing", () => {
    const result = validateRegistrationPayload(undefined);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.fieldErrors.batchId).toBeDefined();
    }
  });

  it("reports both batchId and quantity errors for an empty object", () => {
    const result = validateRegistrationPayload({});
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.fieldErrors.batchId).toBeDefined();
      expect(result.error.fieldErrors.quantity).toBeDefined();
    }
  });

  it("accepts a minimal valid payload and normalizes consent coordinates to null", () => {
    const result = validateRegistrationPayload({ batchId: VALID_BATCH_ID, quantity: 3 });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value).toEqual({
        batchId: VALID_BATCH_ID,
        quantity: 3,
        consentLat: null,
        consentLng: null,
        consentPolicy: { consentAccepted: true, policyVersion: "v2" },
      });
    }
  });

  it("rejects a non-integer quantity", () => {
    const result = validateRegistrationPayload({ batchId: VALID_BATCH_ID, quantity: 1.5 });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.fieldErrors.quantity).toBeDefined();
    }
  });
});
