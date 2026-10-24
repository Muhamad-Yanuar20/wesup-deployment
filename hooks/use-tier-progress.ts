"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { readApiError } from "@/lib/marketplace/api-repository";
import { deriveTierProgress } from "@/lib/marketplace/tier-progress";
import { expiredAtServerTime } from "@/lib/marketplace/availability";
import type { MarketplaceProgressResponse } from "@/lib/marketplace/types";

const POLL_INTERVAL_MS = 4_000;
function canPoll(progress: MarketplaceProgressResponse) {
  return progress.status === "published" && progress.availability?.reason !== "expired" && progress.availability?.reason !== "closed";
}
export interface UseTierProgressResult {
  progress: MarketplaceProgressResponse;
  error: Error | null;
  isRefreshing: boolean;
  refresh: () => Promise<MarketplaceProgressResponse | null>;
  applyRegistration: (registeredQuantity: number) => void;
}

export function useTierProgress(batchId: string, initialProgress: MarketplaceProgressResponse): UseTierProgressResult {
  const [progress, setProgress] = useState(initialProgress);
  const [error, setError] = useState<Error | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const progressRef = useRef(initialProgress);
  const controllerRef = useRef<AbortController | null>(null);
  const synchronizedAt = useRef(0);
  const mountedRef = useRef(true);

  const expire = useCallback(() => {
    const current = progressRef.current;
    if (!current.availability?.canRegister || !expiredAtServerTime(current.serverTime, current.registrationClosesAt, performance.now() - synchronizedAt.current)) return;
    const next = { ...current, availability: { ...current.availability, canRegister: false, reason: "expired" as const } };
    progressRef.current = next;
    setProgress(next);
  }, []);

  const refresh = useCallback(async () => {
    // Explicit rechecks after a mutation/conflict supersede any pre-action read.
    controllerRef.current?.abort();
    const controller = new AbortController();
    controllerRef.current = controller;
    if (mountedRef.current) setIsRefreshing(true);
    const startedAt = performance.now();
    try {
      const response = await fetch(`/api/batches/${encodeURIComponent(batchId)}/progress`, { signal: controller.signal, cache: "no-store" });
      if (!response.ok) throw new Error(await readApiError(response));
      const next = await response.json() as MarketplaceProgressResponse;
      if (!next || next.batchId !== batchId || typeof next.registeredQuantity !== "number" || !Array.isArray(next.tiers) || !next.tierProgress || typeof next.availability?.canRegister !== "boolean" || !Number.isFinite(Date.parse(next.serverTime))) {
        throw new Error("Ketersediaan penawaran belum dapat diperiksa.");
      }
      if (controller.signal.aborted || !mountedRef.current) return null;
      if (next.availability.canRegister && expiredAtServerTime(next.serverTime, next.registrationClosesAt, performance.now() - startedAt)) {
        next.availability = { ...next.availability, canRegister: false, reason: "expired" };
      }
      progressRef.current = next;
      synchronizedAt.current = startedAt;
      setProgress(next);
      setError(null);
      return next;
    } catch (reason) {
      if (!controller.signal.aborted && mountedRef.current) setError(reason instanceof Error ? reason : new Error("Ketersediaan penawaran belum dapat diperiksa."));
      return null;
    } finally {
      if (controllerRef.current === controller) {
        controllerRef.current = null;
        if (mountedRef.current) setIsRefreshing(false);
      }
    }
  }, [batchId]);

  useEffect(() => {
    mountedRef.current = true;
    progressRef.current = initialProgress;
    synchronizedAt.current = performance.now();
    // Synchronize the server progress read on mount, as well as on subsequent events.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (canPoll(initialProgress)) void refresh();
    const interval = window.setInterval(() => {
      expire();
      if (document.visibilityState !== "hidden" && canPoll(progressRef.current) && !controllerRef.current) void refresh();
    }, POLL_INTERVAL_MS);
    const deadlineMs = Date.parse(initialProgress.registrationClosesAt) - Date.parse(initialProgress.serverTime);
    const deadline = Number.isFinite(deadlineMs) && deadlineMs >= 0 && deadlineMs < 2_147_483_647 ? window.setTimeout(expire, deadlineMs) : null;
    const visible = () => {
      if (document.visibilityState === "hidden") return;
      expire();
      if (canPoll(progressRef.current) && !controllerRef.current) void refresh();
    };
    document.addEventListener("visibilitychange", visible);
    window.addEventListener("focus", visible);
    return () => {
      mountedRef.current = false;
      clearInterval(interval);
      if (deadline !== null) clearTimeout(deadline);
      document.removeEventListener("visibilitychange", visible);
      window.removeEventListener("focus", visible);
      controllerRef.current?.abort();
      controllerRef.current = null;
    };
  }, [batchId, initialProgress, refresh, expire]);

  // Re-arm the exact deadline when the server returns a newer snapshot.
  useEffect(() => {
    if (!progress.availability?.canRegister) return;
    const remaining = Date.parse(progress.registrationClosesAt) - Date.parse(progress.serverTime) - (performance.now() - synchronizedAt.current);
    if (!Number.isFinite(remaining) || remaining > 2_147_483_647) return;
    const timer = setTimeout(expire, Math.max(0, remaining));
    return () => clearTimeout(timer);
  }, [progress, expire]);

  const applyRegistration = useCallback((quantity: number) => {
    const current = progressRef.current;
    const safe = Number.isFinite(quantity) ? Math.max(0, Math.trunc(quantity)) : current.registeredQuantity;
    const remaining = current.availability?.remainingQuantity;
    const available = remaining == null ? null : Math.max(0, remaining - Math.max(0, safe - current.registeredQuantity));
    const next = { ...current, registeredQuantity: safe, tierProgress: deriveTierProgress(current.tiers, safe), availability: current.availability ? { ...current.availability, remainingQuantity: available, ...(available === 0 ? { canRegister: false, reason: "full" as const } : {}) } : undefined };
    progressRef.current = next;
    if (mountedRef.current) setProgress(next);
    void refresh();
  }, [refresh]);
  return { progress, error, isRefreshing, refresh, applyRegistration };
}
