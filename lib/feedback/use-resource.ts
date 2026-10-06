"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { fetchRead } from "./read-request";
import { feedbackError, feedbackJson, isAbortError } from "./errors";

/** GET-only lifecycle: refresh preserves the last confirmed data. */
export function useFeedbackResource<T>(url: string, fallback: string) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const request = useRef({ generation: 0, controller: null as AbortController | null });
  const reload = useCallback(async () => {
    request.current.controller?.abort();
    const controller = new AbortController();
    const generation = ++request.current.generation;
    request.current.controller = controller;
    setLoading(true); setError("");
    try {
      const response = await fetchRead(url, { cache: "no-store", signal: controller.signal });
      const value = await feedbackJson<T>(response, fallback);
      if (!controller.signal.aborted && generation === request.current.generation) setData(value);
    } catch (reason) {
      if (!controller.signal.aborted && generation === request.current.generation && !isAbortError(reason)) setError(feedbackError(reason, fallback));
    } finally {
      if (!controller.signal.aborted && generation === request.current.generation) setLoading(false);
    }
  }, [url, fallback]);
  useEffect(() => {
    const state = request.current;
    const generation = ++state.generation;
    queueMicrotask(() => { if (generation === request.current.generation) { setData(null); void reload(); } });
    return () => { state.generation++; state.controller?.abort(); };
  }, [reload]);
  return { data, error, loading, reload };
}
