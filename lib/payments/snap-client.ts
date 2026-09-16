export interface SnapPaymentCallbacks {
  onSuccess?: (result?: unknown) => void;
  onPending?: (result?: unknown) => void;
  onError?: (result?: unknown) => void;
  onClose?: (result?: unknown) => void;
}

export interface MidtransSnapApi {
  pay: (token: string, callbacks?: SnapPaymentCallbacks) => void;
}

export type SnapPayResult =
  | { ok: true }
  | { ok: false; code: "SNAP_NOT_READY" | "SNAP_RUNTIME_ERROR" };

export function invokeSnapPay(
  snap: MidtransSnapApi | null | undefined,
  token: string,
  callbacks: SnapPaymentCallbacks,
): SnapPayResult {
  if (!snap || typeof snap.pay !== "function") {
    return { ok: false, code: "SNAP_NOT_READY" };
  }

  try {
    snap.pay(token, callbacks);
    return { ok: true };
  } catch {
    return { ok: false, code: "SNAP_RUNTIME_ERROR" };
  }
}