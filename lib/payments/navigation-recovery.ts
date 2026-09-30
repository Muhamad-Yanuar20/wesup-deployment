export function paymentRecoveryStorageKey(orderId: string): string {
  return `wesup:snap-csp-recovery:${orderId}`;
}

export function isUnexpectedPaymentDocumentNavigation(pathname: string, initialDocumentUrl: string | null | undefined): boolean {
  if (!initialDocumentUrl) return false;
  try {
    return new URL(initialDocumentUrl, "http://localhost").pathname !== pathname;
  } catch {
    return false;
  }
}

export function claimPaymentRecovery(storage: Pick<Storage, "getItem" | "setItem">, key: string): boolean {
  if (storage.getItem(key) === "1") return false;
  storage.setItem(key, "1");
  return true;
}

export function clearPaymentRecovery(storage: Pick<Storage, "removeItem">, key: string): void {
  storage.removeItem(key);
}

export function isMidtransFramePolicyViolation(input: {
  blockedURI?: string | null;
  effectiveDirective?: string | null;
}): boolean {
  const directive = input.effectiveDirective ?? "";
  if (!new Set(["frame-src", "child-src", "default-src"]).has(directive)) return false;
  try {
    const host = new URL(input.blockedURI ?? "").hostname.toLowerCase();
    return host === "midtrans.com" || host.endsWith(".midtrans.com") || host === "veritrans.co.id" || host.endsWith(".veritrans.co.id");
  } catch {
    return false;
  }
}
