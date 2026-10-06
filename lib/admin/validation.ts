const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isUuid(value: string): boolean {
  return UUID_PATTERN.test(value);
}

export async function parseJsonBody(
  req: Request,
): Promise<Record<string, unknown> | null> {
  try {
    const body = await req.json();
    return body && typeof body === "object" ? body : null;
  } catch {
    return null;
  }
}

export function isIsoTimestamp(value: string): boolean {
  return !Number.isNaN(Date.parse(value));
}

export function isHttpUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

export function parsePositiveInt(value: string | null): number | null {
  if (value === null || value.trim() === "") return null;
  if (!/^\d+$/.test(value.trim())) return null;
  const n = Number(value);
  return Number.isSafeInteger(n) ? n : null;
}

export interface ConsentPolicyInput {
  consentAccepted?: unknown;
  policyVersion?: unknown;
}

export interface ConsentPolicy {
  consentAccepted: true;
  policyVersion: "v2";
}

export interface ConsentPolicyValidationError {
  message: string;
  fieldErrors: Record<string, string[]>;
}

export function parseConsentPolicy(
  input: ConsentPolicyInput | null | undefined,
): { ok: true; value: ConsentPolicy } | { ok: false; error: ConsentPolicyValidationError } {
  const fieldErrors: Record<string, string[]> = {};

  const ca = input?.consentAccepted;
  const pv = input?.policyVersion;

  if (ca !== undefined && ca !== null) {
    if (ca !== true) {
      fieldErrors.consentAccepted = ["consentAccepted must be true"];
    }
  }

  if (pv !== undefined && pv !== null) {
    if (pv !== "v2") {
      fieldErrors.policyVersion = ["policyVersion must be 'v2'"];
    }
  }

  if (Object.keys(fieldErrors).length > 0) {
    return {
      ok: false,
      error: {
        message: "Invalid consent policy",
        fieldErrors,
      },
    };
  }

  return {
    ok: true,
    value: {
      consentAccepted: true,
      policyVersion: "v2",
    },
  };
}

export interface RegistrationPayloadInput {
  batchId?: unknown;
  quantity?: unknown;
  consentLat?: unknown;
  consentLng?: unknown;
  consentAccepted?: unknown;
  policyVersion?: unknown;
}

export interface RegistrationPayload {
  batchId: string;
  quantity: number;
  consentLat: number | null;
  consentLng: number | null;
  consentPolicy: ConsentPolicy;
}

export function validateRegistrationPayload(
  input: RegistrationPayloadInput | null | undefined,
): { ok: true; value: RegistrationPayload } | { ok: false; error: ConsentPolicyValidationError } {
  const fieldErrors: Record<string, string[]> = {};

  if (!input || typeof input.batchId !== "string" || !isUuid(input.batchId)) {
    fieldErrors.batchId = ["Invalid batchId"];
  }
  if (typeof input?.quantity !== "number" || !Number.isSafeInteger(input.quantity) || input.quantity <= 0) {
    fieldErrors.quantity = ["Invalid quantity"];
  }

  let consentLat: number | null = null;
  let consentLng: number | null = null;
  if (input?.consentLat !== undefined && input.consentLat !== null) {
    if (typeof input.consentLat !== "number" || !Number.isFinite(input.consentLat)) {
      fieldErrors.consentLat = ["Invalid consentLat"];
    } else {
      consentLat = input.consentLat;
    }
  }
  if (input?.consentLng !== undefined && input.consentLng !== null) {
    if (typeof input.consentLng !== "number" || !Number.isFinite(input.consentLng)) {
      fieldErrors.consentLng = ["Invalid consentLng"];
    } else {
      consentLng = input.consentLng;
    }
  }

  const consentPolicy = parseConsentPolicy({
    consentAccepted: input?.consentAccepted,
    policyVersion: input?.policyVersion,
  });
  if (!consentPolicy.ok) {
    for (const [k, v] of Object.entries(consentPolicy.error.fieldErrors)) {
      fieldErrors[k] = [...(fieldErrors[k] ?? []), ...v];
    }
  }

  if (input == null || Object.keys(fieldErrors).length > 0) {
    return {
      ok: false,
      error: {
        message: "Invalid registration payload",
        fieldErrors,
      },
    };
  }

  return {
    ok: true,
    value: {
      batchId: input.batchId as string,
      quantity: input.quantity as number,
      consentLat,
      consentLng,
      consentPolicy: consentPolicy.ok ? consentPolicy.value : { consentAccepted: true as const, policyVersion: "v2" as const },
    },
  };
}
