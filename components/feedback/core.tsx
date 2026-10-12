import type { ButtonHTMLAttributes, ReactNode } from "react";
import { AlertCircle, ArrowRight, CheckCircle2, CircleAlert, Info, LoaderCircle, Inbox, Construction } from "lucide-react";
import { cn } from "@/lib/utils";
import "./feedback.css";

export type FeedbackTone = "info" | "success" | "warning" | "error";

/*
 * Swiss Industrial Print (light): red is signal, everything neutral is ink.
 * There is no success green / info blue / warning amber. "success" reads as a
 * flush ink-sub panel, "warning" as an ink panel with a red left rule, and
 * "error" as the only inverted red surface.
 */
export const feedbackTones = {
  info: "border-wesup-ink/20 bg-wesup-paper text-wesup-ink",
  success: "border-wesup-ink/20 bg-wesup-paper-sub text-wesup-ink",
  warning: "border-wesup-ink/20 bg-wesup-paper text-wesup-ink",
  error: "border-wesup-red bg-wesup-paper text-wesup-ink",
} as const;
const icons = { info: Info, success: CheckCircle2, warning: CircleAlert, error: AlertCircle };

function toneRuleClass(tone: FeedbackTone): string {
  return tone === "error" ? "bg-wesup-red" : tone === "warning" ? "bg-wesup-red" : "bg-wesup-ink/25";
}

export function Alert({ children, title, tone = "info", action, className, id }: { children: ReactNode; title?: string; tone?: FeedbackTone; action?: ReactNode; className?: string; id?: string }) {
  const Icon = icons[tone];
  return <section id={id} role={tone === "error" ? "alert" : "status"} className={cn("wesup-feedback relative flex items-start gap-3 border p-4 pl-5 text-sm leading-6", feedbackTones[tone], className)}>
    <span aria-hidden="true" className={cn("absolute inset-y-0 left-0 w-0.5", toneRuleClass(tone))} />
    <Icon className={cn("mt-1 size-5 shrink-0", tone === "error" ? "text-wesup-red" : "text-wesup-ink-sub")} aria-hidden="true" /><div className="min-w-0 flex-1">{title && <h2 className="font-semibold uppercase tracking-[0.04em]">{title}</h2>}<div>{children}</div>{action && <div className="mt-3 flex flex-wrap gap-3">{action}</div>}</div>
  </section>;
}
export function InlineStatus({ children, className }: { children: ReactNode; className?: string }) {
  return <p role="status" className={cn("wesup-feedback text-sm leading-6 text-wesup-ink-sub", className)}>{children}</p>;
}
export function Spinner({ className }: { className?: string }) { return <LoaderCircle aria-hidden="true" className={cn("wesup-spinner size-4 shrink-0", className)} />; }
export function AsyncButton({ pending = false, pendingLabel = "Memproses…", children, className, disabled, ...props }: ButtonHTMLAttributes<HTMLButtonElement> & { pending?: boolean; pendingLabel?: string }) {
  return <button {...props} disabled={disabled || pending} aria-busy={pending || undefined} className={cn("wesup-feedback inline-flex min-h-11 items-center justify-center gap-2 border border-wesup-ink bg-wesup-ink px-5 py-2.5 text-[0.9375rem] font-semibold tracking-[-0.01em] text-wesup-paper transition-all duration-500 wesup-ease hover:border-wesup-red hover:bg-wesup-red hover:translate-x-0.5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-wesup-red disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:border-wesup-ink disabled:hover:bg-wesup-ink disabled:hover:translate-x-0", className)}>{pending && <Spinner />}{pending ? pendingLabel : children}</button>;
}
export function Progress({ value, max, label }: { value: number; max: number; label: string }) {
  const safeMax = Math.max(1, max), safeValue = Math.max(0, Math.min(safeMax, value));
  return <div className="wesup-feedback space-y-2"><p className="font-mono text-xs uppercase tracking-[0.18em] text-wesup-ink-sub">{label}: <span className="tabular-nums">{safeValue}</span> / <span className="tabular-nums">{safeMax}</span></p><div role="progressbar" aria-label={label} aria-valuenow={safeValue} aria-valuemin={0} aria-valuemax={safeMax} aria-valuetext={`${safeValue} dari ${safeMax}`} className="h-px w-full bg-wesup-ink/20"><div className="h-[3px] -translate-y-px bg-wesup-red transition-[width] duration-300 wesup-ease" style={{ width: `${safeValue / safeMax * 100}%` }} /></div></div>;
}
export function Skeleton({ className }: { className?: string }) { return <div aria-hidden="true" className={cn("animate-pulse bg-wesup-paper-sub motion-reduce:animate-none", className)} />; }
export function ContentSkeleton({ label = "Memuat konten…", variant = "cards" }: { label?: string; variant?: "cards" | "detail" | "form" | "table" | "map" }) {
  return <section className="wesup-feedback space-y-5" aria-busy="true" aria-label={label}><span role="status" className="sr-only">{label}</span><Skeleton className="h-8 w-1/2" />{variant === "cards" ? <div className="grid gap-px bg-wesup-ink/10 sm:grid-cols-2 lg:grid-cols-3">{[1,2,3].map(i => <Skeleton key={i} className="h-48" />)}</div> : variant === "form" ? <>{[1,2,3].map(i => <Skeleton key={i} className="h-16" />)}</> : <Skeleton className={variant === "map" ? "h-80" : "h-64"} />}</section>;
}
type StateProps = { title: string; description?: ReactNode; action?: ReactNode; className?: string; requestId?: string; embedded?: boolean };
function State({ title, description, action, className, requestId, embedded = false, kind }: StateProps & { kind: "empty" | "error" | "success" | "unavailable" }) {
  const Icon = kind === "success" ? CheckCircle2 : kind === "error" ? AlertCircle : kind === "unavailable" ? Construction : Inbox;
  const glyphTone = kind === "error" ? "border-wesup-red text-wesup-red" : "border-wesup-ink/20 text-wesup-ink-sub";
  const ruleTone = kind === "error" ? "bg-wesup-red" : "bg-wesup-ink/25";
  return <section role={kind === "error" ? "alert" : "status"} className={cn("wesup-feedback text-center", embedded ? "py-4" : "border border-wesup-ink/15 bg-wesup-paper px-5 py-8 sm:px-8 sm:py-10", className)}>
    {!embedded && <span aria-hidden="true" className={cn("mx-auto mb-5 block h-px w-10", ruleTone)} />}
    <span className={cn("mx-auto mb-4 flex size-10 items-center justify-center border", glyphTone)} aria-hidden="true"><Icon className="size-5" strokeWidth={1.5} /></span>
    <h2 className={cn("wesup-state-title leading-[0.98] tracking-[0.06em] text-wesup-ink", embedded ? "text-xl" : "text-2xl sm:text-3xl")}>{title}</h2>
    {description && <div className="mx-auto mt-3 max-w-prose text-sm leading-6 text-wesup-ink-sub">{description}</div>}
    {requestId && <p className="mt-3 font-mono text-xs uppercase tracking-[0.14em] text-wesup-ink-sub">Kode bantuan: <span className="tabular-nums">{requestId}</span></p>}
    {action && <div className="mt-5 flex flex-wrap justify-center gap-3">{action}</div>}
  </section>;
}
export function EmptyState(props: StateProps) { return <State {...props} kind="empty" />; }
export function ErrorState(props: StateProps) { return <State {...props} kind="error" />; }
export function SuccessState(props: StateProps) { return <State {...props} kind="success" />; }
export function UnavailableState(props: StateProps) { return <State {...props} kind="unavailable" />; }
export function FieldFeedback({ error, hint, id }: { error?: string; hint?: string; id: string }) { return error ? <p id={id} role="alert" className="mt-2 text-sm leading-6 text-wesup-red">{error}</p> : hint ? <p id={id} className="mt-2 text-xs leading-5 text-wesup-ink-sub">{hint}</p> : null; }

/** Shared trailing-arrow disc that rides inside primary CTAs. */
export function ArrowDisc({ className }: { className?: string }) {
  return <span aria-hidden="true" className={cn("inline-flex size-7 shrink-0 items-center justify-center transition-transform duration-500 wesup-ease group-hover:translate-x-0.5", className)}><ArrowRight className="size-3.5" strokeWidth={1.5} /></span>;
}
