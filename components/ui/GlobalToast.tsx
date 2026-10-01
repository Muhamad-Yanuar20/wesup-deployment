"use client";

import { createContext, useCallback, useContext, useEffect, useReducer, useRef, useState, type ReactNode } from "react";
import { AlertCircle, CheckCircle2, CircleAlert, Info, X } from "lucide-react";
import { feedbackTones, type FeedbackTone } from "@/components/feedback/core";

export interface ToastInput { id?: string; message: string; variant?: FeedbackTone; duration?: number | null; action?: { label: string; onClick: () => void } }
interface Toast extends ToastInput { id: string; version: number }
interface ToastContextValue { toast: (input: string | ToastInput, variant?: FeedbackTone, duration?: number) => string; dismiss: (id: string) => void; update: (id: string, input: Partial<ToastInput>) => void }
const ToastContext = createContext<ToastContextValue | null>(null);
type Action = { type: "add"; toast: Toast } | { type: "remove"; id: string } | { type: "update"; id: string; input: Partial<ToastInput> };
function reducer(state: Toast[], action: Action): Toast[] {
  if (action.type === "remove") return state.filter(t => t.id !== action.id);
  if (action.type === "update") return state.map(t => t.id === action.id ? { ...t, ...action.input, id: t.id, version: t.version + 1 } : t);
  if (state.some(t => t.id === action.toast.id)) return state;
  return [...state, action.toast].slice(-3);
}
export function useToast(): ToastContextValue {
  const context = useContext(ToastContext);
  if (!context) throw new Error("useToast must be used inside <ToastProvider>");
  return context;
}
export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, dispatch] = useReducer(reducer, []);
  const dismiss = useCallback((id: string) => dispatch({ type: "remove", id }), []);
  const update = useCallback((id: string, input: Partial<ToastInput>) => dispatch({ type: "update", id, input }), []);
  const toast = useCallback((input: string | ToastInput, variant: FeedbackTone = "info", duration?: number) => {
    const options: ToastInput = typeof input === "string" ? { message: input, variant, duration } : input;
    const id = options.id ?? crypto.randomUUID();
    dispatch({ type: "add", toast: { ...options, id, version: 0, duration: options.duration !== undefined ? options.duration : options.action ? null : options.variant === "warning" || options.variant === "error" ? 8000 : 5000 } });
    return id;
  }, []);
  return <ToastContext.Provider value={{ toast, dismiss, update }}>{children}<div className="wesup-toast-region" aria-label="Umpan balik aktivitas">{toasts.map(t => <ToastItem key={`${t.id}:${t.version}`} toast={t} dismiss={dismiss} />)}</div></ToastContext.Provider>;
}
const icons = { info: Info, success: CheckCircle2, warning: CircleAlert, error: AlertCircle };
function ToastItem({ toast, dismiss }: { toast: Toast; dismiss: (id: string) => void }) {
  const [hovered, setHovered] = useState(false), [focused, setFocused] = useState(false), [hidden, setHidden] = useState(false);
  const remaining = useRef(toast.duration ?? 0);
  useEffect(() => { const change = () => setHidden(document.hidden); change(); document.addEventListener("visibilitychange", change); return () => document.removeEventListener("visibilitychange", change); }, []);
  useEffect(() => {
    if (toast.duration === null || hovered || focused || hidden) return;
    const start = Date.now();
    const timer = window.setTimeout(() => dismiss(toast.id), remaining.current);
    return () => { window.clearTimeout(timer); remaining.current = Math.max(0, remaining.current - (Date.now() - start)); };
  }, [toast.id, toast.duration, dismiss, hovered, focused, hidden]);
  const tone = toast.variant ?? "info", Icon = icons[tone];
  return <article role={tone === "error" ? "alert" : "status"} onMouseEnter={() => setHovered(true)} onMouseLeave={() => setHovered(false)} onFocusCapture={() => setFocused(true)} onBlurCapture={event => { if (!event.currentTarget.contains(event.relatedTarget)) setFocused(false); }} className={`wesup-feedback flex items-start gap-3 rounded-xl border p-4 text-sm leading-6 shadow-lg shadow-slate-900/10 ${feedbackTones[tone]}`}><Icon aria-hidden="true" className="mt-1 size-5 shrink-0" /><div className="min-w-0 flex-1"><p>{toast.message}</p>{toast.action && <button type="button" className="mt-2 min-h-11 font-semibold underline" onClick={toast.action.onClick}>{toast.action.label}</button>}</div><button type="button" onClick={() => dismiss(toast.id)} aria-label="Tutup notifikasi" className="-my-2 -mr-2 flex size-11 shrink-0 items-center justify-center rounded-lg hover:bg-white/60 focus-visible:outline-2 focus-visible:outline-offset-2"><X className="size-4" aria-hidden="true" /></button></article>;
}
