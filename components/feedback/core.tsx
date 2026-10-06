import type { ButtonHTMLAttributes, ReactNode } from "react";
import { AlertCircle, CheckCircle2, CircleAlert, Info, LoaderCircle, Inbox, Construction } from "lucide-react";
import { cn } from "@/lib/utils";
import "./feedback.css";

export type FeedbackTone = "info" | "success" | "warning" | "error";
export const feedbackTones = {
  info: "border-blue-200 bg-blue-50 text-blue-900",
  success: "border-emerald-200 bg-emerald-50 text-emerald-900",
  warning: "border-amber-200 bg-amber-50 text-amber-950",
  error: "border-red-200 bg-red-50 text-red-900",
} as const;
const icons = { info: Info, success: CheckCircle2, warning: CircleAlert, error: AlertCircle };

export function Alert({ children, title, tone = "info", action, className, id }: { children: ReactNode; title?: string; tone?: FeedbackTone; action?: ReactNode; className?: string; id?: string }) {
  const Icon = icons[tone];
  return <section id={id} role={tone === "error" ? "alert" : "status"} className={cn("wesup-feedback flex items-start gap-3 rounded-xl border p-4 text-sm leading-6", feedbackTones[tone], className)}>
    <Icon className="mt-1 size-5 shrink-0" aria-hidden="true" /><div className="min-w-0 flex-1">{title && <h2 className="font-semibold">{title}</h2>}<div>{children}</div>{action && <div className="mt-3 flex flex-wrap gap-3">{action}</div>}</div>
  </section>;
}
export function InlineStatus({ children, className }: { children: ReactNode; className?: string }) {
  return <p role="status" className={cn("wesup-feedback text-sm leading-6 text-slate-600", className)}>{children}</p>;
}
export function Spinner({ className }: { className?: string }) { return <LoaderCircle aria-hidden="true" className={cn("wesup-spinner size-4 shrink-0", className)} />; }
export function AsyncButton({ pending = false, pendingLabel = "Memproses…", children, className, disabled, ...props }: ButtonHTMLAttributes<HTMLButtonElement> & { pending?: boolean; pendingLabel?: string }) {
  return <button {...props} disabled={disabled || pending} aria-busy={pending || undefined} className={cn("wesup-feedback inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-blue-700 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-blue-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 disabled:cursor-not-allowed disabled:opacity-60", className)}>{pending && <Spinner />}{pending ? pendingLabel : children}</button>;
}
export function Progress({ value, max, label }: { value: number; max: number; label: string }) {
  const safeMax = Math.max(1, max), safeValue = Math.max(0, Math.min(safeMax, value));
  return <div className="wesup-feedback space-y-2"><p className="text-sm text-slate-700">{label}: {safeValue} dari {safeMax}</p><div role="progressbar" aria-label={label} aria-valuenow={safeValue} aria-valuemin={0} aria-valuemax={safeMax} aria-valuetext={`${safeValue} dari ${safeMax}`} className="h-2 overflow-hidden rounded-full bg-slate-200"><div className="h-full rounded-full bg-blue-600" style={{ width: `${safeValue / safeMax * 100}%` }} /></div></div>;
}
export function Skeleton({ className }: { className?: string }) { return <div aria-hidden="true" className={cn("animate-pulse rounded-xl bg-slate-200 motion-reduce:animate-none", className)} />; }
export function ContentSkeleton({ label = "Memuat konten…", variant = "cards" }: { label?: string; variant?: "cards" | "detail" | "form" | "table" | "map" }) {
  return <section className="wesup-feedback space-y-5" aria-busy="true" aria-label={label}><span role="status" className="sr-only">{label}</span><Skeleton className="h-8 w-1/2" />{variant === "cards" ? <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{[1,2,3].map(i => <Skeleton key={i} className="h-48" />)}</div> : variant === "form" ? <>{[1,2,3].map(i => <Skeleton key={i} className="h-16" />)}</> : <Skeleton className={variant === "map" ? "h-80" : "h-64"} />}</section>;
}
type StateProps = { title: string; description?: ReactNode; action?: ReactNode; className?: string; requestId?: string; embedded?: boolean };
function State({ title, description, action, className, requestId, embedded = false, kind }: StateProps & { kind: "empty" | "error" | "success" | "unavailable" }) {
  const Icon = kind === "success" ? CheckCircle2 : kind === "error" ? AlertCircle : kind === "unavailable" ? Construction : Inbox;
  return <section role={kind === "error" ? "alert" : "status"} className={cn("wesup-feedback text-center", embedded ? "py-4" : "rounded-2xl border border-slate-200 bg-white px-5 py-8 sm:px-8 sm:py-10", className)}><Icon aria-hidden="true" className={cn("mx-auto mb-4 size-8", kind === "success" ? "text-emerald-700" : kind === "error" ? "text-red-700" : "text-blue-700")} /><h2 className={cn("wesup-state-title leading-tight text-slate-950", embedded ? "text-xl" : "text-2xl sm:text-3xl")}>{title}</h2>{description && <div className="mx-auto mt-3 max-w-prose text-sm leading-6 text-slate-600">{description}</div>}{requestId && <p className="mt-3 text-xs text-slate-500">Kode bantuan: {requestId}</p>}{action && <div className="mt-5 flex flex-wrap justify-center gap-3">{action}</div>}</section>;
}
export function EmptyState(props: StateProps) { return <State {...props} kind="empty" />; }
export function ErrorState(props: StateProps) { return <State {...props} kind="error" />; }
export function SuccessState(props: StateProps) { return <State {...props} kind="success" />; }
export function UnavailableState(props: StateProps) { return <State {...props} kind="unavailable" />; }
export function FieldFeedback({ error, hint, id }: { error?: string; hint?: string; id: string }) { return error ? <p id={id} role="alert" className="mt-2 text-sm leading-6 text-red-700">{error}</p> : hint ? <p id={id} className="mt-2 text-sm leading-6 text-slate-600">{hint}</p> : null; }
