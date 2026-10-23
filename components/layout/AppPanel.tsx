import type { ReactNode } from "react";
import { CardFrame } from "@/components/landing/CardFrame";

/** Landing's nested paper enclosure, shared by application content groups. */
export function AppPanel({ children, className = "", panelClassName = "" }: { children: ReactNode; className?: string; panelClassName?: string }) {
  return <CardFrame className={`min-w-0 border border-wesup-ink/15 bg-wesup-paper-sub ${className}`} panelClassName={`min-w-0 border border-wesup-ink/10 bg-wesup-paper p-5 sm:p-8 ${panelClassName}`}>{children}</CardFrame>;
}
