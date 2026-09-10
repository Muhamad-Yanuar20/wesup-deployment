import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export function SurfaceCard({ children, className, variant = "standard" }: { children: ReactNode; className?: string; variant?: "standard" | "interactive" | "summary" | "status" }) {
  return <section className={cn("rounded-2xl border bg-white", variant === "standard" && "border-slate-200 shadow-sm", variant === "interactive" && "border-slate-200 shadow-sm transition hover:border-blue-200 hover:shadow-md", variant === "summary" && "border-slate-200 shadow-sm", variant === "status" && "border-blue-100 bg-blue-50", className)}>{children}</section>;
}

export function StatusBadge({ children, tone = "neutral" }: { children: ReactNode; tone?: "neutral" | "info" | "success" | "warning" | "danger" }) {
  const tones = { neutral: "bg-slate-100 text-slate-700", info: "bg-blue-100 text-blue-700", success: "bg-emerald-100 text-emerald-700", warning: "bg-amber-100 text-amber-800", danger: "bg-red-100 text-red-700" } as const;
  return <span className={cn("inline-flex min-h-7 items-center rounded-full px-2.5 py-1 text-xs font-semibold", tones[tones ? tone : "neutral"])}>{children}</span>;
}

export function ActionBar({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn("flex flex-col gap-3 sm:flex-row sm:items-center", className)}>{children}</div>;
}

export function FormField({ label, htmlFor, hint, error, children }: { label: string; htmlFor: string; hint?: string; error?: string; children: ReactNode }) {
  return <div className="space-y-2"><label htmlFor={htmlFor} className="block text-sm font-semibold text-slate-900">{label}</label>{children}{hint && !error ? <p className="text-xs leading-5 text-slate-500">{hint}</p> : null}{error ? <p className="text-sm text-red-600" role="alert">{error}</p> : null}</div>;
}