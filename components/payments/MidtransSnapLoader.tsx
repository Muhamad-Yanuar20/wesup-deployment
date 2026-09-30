"use client";

import Script from "next/script";
import { useEffect } from "react";
import {
  claimPaymentRecovery,
  isMidtransFramePolicyViolation,
  isUnexpectedPaymentDocumentNavigation,
  paymentRecoveryStorageKey,
} from "@/lib/payments/navigation-recovery";

export type SnapLoaderState = "loading" | "ready" | "blocked" | "error";

export interface MidtransSnapConfig {
  clientKey: string;
  scriptUrl: string;
  nonce: string | null;
}

interface SnapWindowApi {
  pay?: unknown;
}

export function getInitialSnapLoaderState(
  snap: SnapWindowApi | null | undefined = typeof window === "undefined" ? undefined : window.snap,
): SnapLoaderState {
  return typeof snap?.pay === "function" ? "ready" : "loading";
}

export default function MidtransSnapLoader({
  config,
  orderId,
  onStateChange,
  onRecoveryExhausted,
}: {
  config: MidtransSnapConfig;
  orderId?: string;
  onStateChange: (state: SnapLoaderState) => void;
  onRecoveryExhausted?: () => void;
}) {
  useEffect(() => {
    if (getInitialSnapLoaderState() === "ready") onStateChange("ready");
  }, [onStateChange]);

  useEffect(() => {
    if (typeof window === "undefined" || typeof document === "undefined") return;

    const key = orderId ? paymentRecoveryStorageKey(orderId) : null;
    let storage: Storage | null = null;
    try {
      storage = window.sessionStorage;
    } catch {
      storage = null;
    }

    const navigation = window.performance?.getEntriesByType("navigation")[0] as PerformanceNavigationTiming | undefined;
    const initialDocumentUrl = navigation?.name || null;
    if (key && storage && isUnexpectedPaymentDocumentNavigation(window.location.pathname, initialDocumentUrl)) {
      if (claimPaymentRecovery(storage, key)) {
        onStateChange("blocked");
        window.location.replace(window.location.href);
        return;
      }
    }

    const onPolicyViolation = (event: Event) => {
      const policyEvent = event as Event & { blockedURI?: string; effectiveDirective?: string };
      if (!isMidtransFramePolicyViolation(policyEvent)) return;
      onStateChange("blocked");
      if (key && storage && claimPaymentRecovery(storage, key)) {
        window.location.replace(window.location.href);
      } else {
        onRecoveryExhausted?.();
      }
    };

    document.addEventListener("securitypolicyviolation", onPolicyViolation);
    return () => document.removeEventListener("securitypolicyviolation", onPolicyViolation);
  }, [onRecoveryExhausted, onStateChange, orderId]);

  return (
    <Script
      id="midtrans-snap"
      src={config.scriptUrl}
      data-client-key={config.clientKey}
      nonce={config.nonce ?? undefined}
      strategy="afterInteractive"
      onReady={() => onStateChange("ready")}
      onError={() => onStateChange("error")}
    />
  );
}
