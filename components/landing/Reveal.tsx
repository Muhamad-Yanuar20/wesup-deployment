"use client";

import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";

/**
 * Scroll-entry reveal for the landing page.
 *
 * The element ships in the `hidden` state (opacity 0, translated down, blurred)
 * and flips to `shown` once an IntersectionObserver reports it crossing the
 * viewport. Fail-open on every degraded path, because an invisible section is
 * worse than a static one:
 * - reduced motion  -> shown outright, no observer is ever constructed
 * - no IO support    -> shown outright
 *
 * Animation is transform + opacity (+ a one-shot blur) only, per the landing
 * performance rules: never top/left/width/height, and nothing that keeps
 * repainting after it settles.
 */
interface RevealProps {
  children: ReactNode;
  /** Stagger inside a group; applied as the transition-delay of the reveal. */
  delayMs?: number;
  className?: string;
}

export function Reveal({ children, delayMs, className = "" }: RevealProps) {
  const nodeRef = useRef<HTMLDivElement>(null);
  const [state, setState] = useState<"hidden" | "shown">("hidden");

  useEffect(() => {
    const node = nodeRef.current;
    if (!node) return;

    const prefersReducedMotion =
      typeof window.matchMedia === "function" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    if (prefersReducedMotion || typeof IntersectionObserver === "undefined") {
      // Deferred so the reveal is a reaction to the environment, not a
      // synchronous state write inside the effect body. Microtasks flush before
      // the browser paints, so the flip is imperceptible.
      queueMicrotask(() => setState("shown"));
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setState("shown");
          observer.disconnect();
        }
      },
      { rootMargin: "0px 0px -8% 0px", threshold: 0.1 },
    );

    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  const style: CSSProperties | undefined =
    delayMs !== undefined ? { transitionDelay: `${delayMs}ms` } : undefined;

  return (
    <div
      ref={nodeRef}
      data-reveal={state}
      style={style}
      className={`wesup-reveal ${className}`.trim()}
    >
      {children}
    </div>
  );
}
