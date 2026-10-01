"use client";
import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { usePathname } from "next/navigation";
import type { UserAccessState } from "@/lib/auth/access-state";
import { fetchRead, resetReadRequests } from "@/lib/feedback/read-request";
const SESSION_FRESH_MS = 60_000;
interface NavigationSession {
  accessState: UserAccessState | null;
  refreshSession: () => Promise<void>;
  applySession: (state: UserAccessState) => void;
  clearSession: () => void;
}
const NavigationSessionContext = createContext<NavigationSession>({ accessState: null, refreshSession: async () => {}, applySession: () => {}, clearSession: () => {} });
export function NavigationSessionProvider({ children, initialAccessState }: { children: ReactNode; initialAccessState: UserAccessState | null }) {
  const pathname = usePathname();
  const [session, setSession] = useState({ source: initialAccessState, accessState: initialAccessState });
  const checkedAt = useRef(0);
  const request = useRef<{ generation: number; controller: AbortController | null; promise: Promise<void> | null }>({ generation: 0, controller: null, promise: null });
  if (session.source !== initialAccessState) setSession({ source: initialAccessState, accessState: initialAccessState });
  const updateSession = useCallback((state: UserAccessState | null) => {
    request.current.generation++; request.current.controller?.abort(); request.current.promise = null;
    resetReadRequests(); checkedAt.current = Date.now();
    setSession(current => ({ ...current, accessState: state }));
  }, []);
  const clearSession = useCallback(() => updateSession(null), [updateSession]);
  const applySession = useCallback((state: UserAccessState) => updateSession(state), [updateSession]);
  const refreshSession = useCallback((): Promise<void> => {
    if (request.current.promise) return request.current.promise;
    const controller = new AbortController(), generation = ++request.current.generation;
    request.current.controller = controller;
    const pending = (async () => {
      try {
        const response = await fetchRead("/api/auth/session", { signal: controller.signal });
        if (controller.signal.aborted || request.current.generation !== generation) return;
        if (response.status === 401 || response.status === 403) {
          checkedAt.current = Date.now(); resetReadRequests(); setSession(current => ({ ...current, accessState: null }));
        } else if (response.ok) {
          const body = await response.json() as { accessState?: UserAccessState };
          if (!controller.signal.aborted && request.current.generation === generation && body.accessState) {
            checkedAt.current = Date.now(); setSession(current => ({ ...current, accessState: body.accessState ?? null }));
          }
        }
      } catch { /* Transient unavailability is not logout. */ }
      finally { if (request.current.generation === generation) request.current.promise = null; }
    })();
    request.current.promise = pending;
    return pending;
  }, []);
  useEffect(() => {
    checkedAt.current = Date.now();
    request.current.generation++; request.current.controller?.abort(); request.current.promise = null;
  }, [initialAccessState]);
  useEffect(() => {
    if (Date.now() - checkedAt.current >= SESSION_FRESH_MS) void refreshSession();
  }, [pathname, refreshSession]);
  useEffect(() => {
    const check = () => { if (document.visibilityState === "visible" && Date.now() - checkedAt.current >= SESSION_FRESH_MS) void refreshSession(); };
    window.addEventListener("focus", check); document.addEventListener("visibilitychange", check);
    const timer = window.setInterval(check, SESSION_FRESH_MS);
    const active = request.current;
    return () => { window.clearInterval(timer); window.removeEventListener("focus", check); document.removeEventListener("visibilitychange", check); active.generation++; active.controller?.abort(); };
  }, [refreshSession]);
  return <NavigationSessionContext.Provider value={{ accessState: session.accessState, refreshSession, applySession, clearSession }}>{children}</NavigationSessionContext.Provider>;
}
export function useNavigationSession() { return useContext(NavigationSessionContext); }
