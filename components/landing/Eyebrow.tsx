import type { ReactNode } from "react";

interface EyebrowProps {
  children: ReactNode;
  className?: string;
  /** Reserved for call sites; both tones resolve to the ink-sub label on paper. */
  tone?: "muted" | "light";
  /** Mirror the leading rule on the right side (used by the closing CTA). */
  trailingRule?: boolean;
}

const TONE_CLASSES = {
  muted: "text-wesup-ink-sub",
  light: "text-wesup-ink-sub",
} as const;

// Red hairline per Swiss Industrial Print (light) — only accent.
const RULE = (
  <span aria-hidden="true" className="inline-block h-px w-6 bg-wesup-red" />
);

/**
 * Mono uppercase label with a red hairline, the landing page's section kicker.
 * One definition so tone, tracking and rule stay consistent across every
 * section instead of drifting per call site.
 */
export function Eyebrow({ children, className = "", tone = "muted", trailingRule = false }: EyebrowProps) {
  return (
    <p
      className={`inline-flex items-center gap-2 font-mono text-[0.6875rem] font-medium uppercase tracking-[0.24em] ${TONE_CLASSES[tone]} ${className}`}
    >
      {RULE}
      {children}
      {trailingRule ? RULE : null}
    </p>
  );
}
