// @vitest-environment jsdom
import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useTierProgress } from "@/hooks/use-tier-progress";
import type { MarketplaceProgressResponse } from "@/lib/marketplace/types";

const INITIAL: MarketplaceProgressResponse = {
  batchId: "44444444-4444-4444-8444-444444444444",
  status: "published",
  availability: { canRegister: true, reason: null, remainingQuantity: 70 },
  registeredQuantity: 30,
  tiers: [
    { tierNumber: 1, minVolume: 1, maxVolume: 49, pricePerUnit: 25000 },
    { tierNumber: 2, minVolume: 50, maxVolume: null, pricePerUnit: 22000 },
  ],
  tierProgress: {
    currentTierNumber: 1,
    currentPricePerUnit: 25000,
    nextTierNumber: 2,
    nextTierMinVolume: 50,
    remainingToNextTier: 20,
    progressPercent: 60,
  },
  registrationClosesAt: "2099-09-15T10:00:00.000Z",
  serverTime: "2026-09-01T12:00:00.000Z",
};

function response(overrides: Partial<MarketplaceProgressResponse> = {}) {
  return new Response(JSON.stringify({ ...INITIAL, ...overrides }), {
    status: 200,
    headers: { "content-type": "application/json" },
  });
}

describe("useTierProgress", () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    vi.useFakeTimers();
    vi.stubGlobal("fetch", fetchMock);
    fetchMock.mockReset();
    Object.defineProperty(document, "visibilityState", {
      configurable: true,
      value: "visible",
    });
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("fetches immediately and every four seconds while visible", async () => {
    fetchMock.mockResolvedValue(response({ registeredQuantity: 31 }));
    const { result } = renderHook(() => useTierProgress(INITIAL.batchId, INITIAL));
    await act(async () => {
      await Promise.resolve();
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(result.current.progress.registeredQuantity).toBe(31);

    fetchMock.mockResolvedValue(response({ registeredQuantity: 32 }));
    await act(async () => {
      vi.advanceTimersByTime(4000);
      await Promise.resolve();
    });
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(result.current.progress.registeredQuantity).toBe(32);
  });

  it("does not poll while hidden and refetches on focus", async () => {
    fetchMock.mockResolvedValue(response());
    renderHook(() => useTierProgress(INITIAL.batchId, INITIAL));
    await act(async () => {
      await Promise.resolve();
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);

    Object.defineProperty(document, "visibilityState", { configurable: true, value: "hidden" });
    await act(async () => {
      vi.advanceTimersByTime(8000);
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);

    Object.defineProperty(document, "visibilityState", { configurable: true, value: "visible" });
    fetchMock.mockResolvedValue(response({ registeredQuantity: 33 }));
    await act(async () => {
      window.dispatchEvent(new Event("focus"));
      await Promise.resolve();
    });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("keeps the last successful snapshot when refresh fails", async () => {
    fetchMock.mockResolvedValue(response());
    const { result } = renderHook(() => useTierProgress(INITIAL.batchId, INITIAL));
    await act(async () => {
      await Promise.resolve();
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    fetchMock.mockRejectedValue(new Error("temporary outage"));
    await act(async () => {
      await result.current.refresh();
    });
    expect(result.current.progress.registeredQuantity).toBe(30);
    expect(result.current.error?.message).toBe("temporary outage");
  });

  it("stops the interval after the server reports a closed batch", async () => {
    fetchMock.mockResolvedValue(response({ status: "closed" }));
    renderHook(() => useTierProgress(INITIAL.batchId, INITIAL));
    await act(async () => {
      await Promise.resolve();
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    await act(async () => {
      vi.advanceTimersByTime(8000);
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("expires at the exact server deadline even with a wrong device clock and failed refresh", async () => {
    const initial = { ...INITIAL, registrationClosesAt: "2026-09-01T12:00:02.000Z" };
    fetchMock.mockRejectedValue(new Error("Koneksi terputus"));
    const { result } = renderHook(() => useTierProgress(initial.batchId, initial));
    await act(async () => { await vi.advanceTimersByTimeAsync(1999); });
    expect(result.current.progress.availability?.canRegister).toBe(true);
    await act(async () => { await vi.advanceTimersByTimeAsync(1); });
    expect(result.current.progress.availability).toMatchObject({ canRegister: false, reason: "expired" });
  });

  it("does not fetch again when a closed snapshot was already loaded by the server", () => {
    const initial = { ...INITIAL, status: "closed", availability: { canRegister: false, reason: "closed" as const, remainingQuantity: 0 } };
    renderHook(() => useTierProgress(initial.batchId, initial));
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("rechecks a full but still published batch after withdrawal restores capacity", async () => {
    const initial = { ...INITIAL, availability: { canRegister: false, reason: "full" as const, remainingQuantity: 0 } };
    fetchMock.mockResolvedValue(response());
    const { result } = renderHook(() => useTierProgress(initial.batchId, initial));
    await act(async () => { await Promise.resolve(); });
    expect(result.current.progress.availability?.canRegister).toBe(true);
  });

  it("starts a fresh explicit recheck instead of returning null during polling", async () => {
    fetchMock.mockImplementationOnce(() => new Promise(() => {})).mockResolvedValue(response());
    const { result } = renderHook(() => useTierProgress(INITIAL.batchId, INITIAL));
    await act(async () => { await result.current.refresh(); });
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(result.current.error).toBeNull();
  });

  it("does not let a pre-registration snapshot overwrite the last-slot result", async () => {
    let resolveOld!: (response: Response) => void;
    fetchMock.mockImplementationOnce(() => new Promise<Response>(resolve => { resolveOld = resolve; })).mockImplementation(() => new Promise(() => {}));
    const initial = { ...INITIAL, availability: { canRegister: true, reason: null, remainingQuantity: 1 } };
    const { result } = renderHook(() => useTierProgress(initial.batchId, initial));
    await act(async () => { result.current.applyRegistration(31); });
    await act(async () => { resolveOld(response()); });
    expect(result.current.progress.availability).toMatchObject({ canRegister: false, reason: "full" });
    expect(result.current.progress.registeredQuantity).toBe(31);
  });

  it("ignores a response for a different batch", async () => {
    fetchMock.mockResolvedValue(response({ batchId: "another-batch" }));
    const { result } = renderHook(() => useTierProgress(INITIAL.batchId, INITIAL));
    await act(async () => { await Promise.resolve(); });
    expect(result.current.error).not.toBeNull();
    expect(result.current.progress.batchId).toBe(INITIAL.batchId);
  });
});
