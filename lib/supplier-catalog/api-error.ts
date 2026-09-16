export interface SupplierApiErrorBody {
  error?: unknown;
  code?: unknown;
  requestId?: unknown;
}

export class SupplierApiError extends Error {
  readonly status: number;
  readonly code: string | null;
  readonly requestId: string | null;

  constructor(message: string, options: { status: number; code?: string | null; requestId?: string | null }) {
    super(message);
    this.name = "SupplierApiError";
    this.status = options.status;
    this.code = options.code ?? null;
    this.requestId = options.requestId ?? null;
  }
}

export async function parseSupplierApiError(response: Response, fallback: string): Promise<SupplierApiError> {
  let body: SupplierApiErrorBody = {};
  try {
    body = await response.json() as SupplierApiErrorBody;
  } catch {
    // Keep the safe fallback when an upstream response is not JSON.
  }
  const message = typeof body.error === "string" && body.error.trim() ? body.error : fallback;
  const code = typeof body.code === "string" && body.code.trim() ? body.code : null;
  const requestId = typeof body.requestId === "string" && body.requestId.trim() ? body.requestId : null;
  return new SupplierApiError(message, { status: response.status, code, requestId });
}
