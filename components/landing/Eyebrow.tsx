import type { ReactNode } from "react";

interface EyebrowProps {
  children: ReactNode;
  className?: string;
  /** "muted" for ivory/white surfaces, "light" for ink surfaces. */
  tone?: "muted" | "light";
  /** Mirror the leading rule on the right side (used by the closing CTA). */
  trailingRule?: boolean;
}

const TONE_CLASSES = {
  muted: "text-slate-500",
  light: "text-amber-200/80",
} as const;

const RULE = <span aria-hidden="true" className="inline-block h-px w-7 bg-wesup-kraft" />;

/**
 * Mono uppercase label with a kraft hairline, the landing page's section
 * kicker. One definition so tone, tracking and rule stay consistent across
 * every section instead of drifting per call site.
 */
export function Eyebrow({ children, className = "", tone = "muted", trailingRule = false }: EyebrowProps) {
  return (
    <p
      className={`inline-flex items-center gap-2.5 font-mono text-[0.6875rem] font-medium uppercase tracking-[0.22em] ${TONE_CLASSES[tone]} ${className}`}
    >
      {RULE}
      {children}
      {trailingRule ? RULE : null}
    </p>
  );
}
