import type { ReactNode } from "react";
import { Eyebrow } from "@/components/landing/Eyebrow";

interface PageHeaderProps {
  title: string;
  description?: string;
  icon?: ReactNode;
  eyebrow?: string;
  actions?: ReactNode;
}

export function PageHeader({ title, description, icon, eyebrow, actions }: PageHeaderProps) {
  return (
    <header className="app-enter mb-8 flex flex-col gap-5 border-b border-wesup-ink/15 pb-7 sm:mb-12 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0">
        <Eyebrow className="mb-5">{eyebrow ?? "Wesup / Bandung"}</Eyebrow>
        <h1 className="flex items-center gap-3 font-landing-display text-3xl font-normal uppercase leading-[1.05] tracking-[0.06em] text-wesup-ink text-balance sm:text-4xl md:text-5xl">
          {icon ? <span className="hidden h-10 w-10 shrink-0 items-center justify-center border border-wesup-ink/20 text-wesup-red sm:flex" aria-hidden="true">{icon}</span> : null}
          <span className="min-w-0 break-words">{title}</span>
        </h1>
        {description ? <p className="mt-4 max-w-2xl text-[0.9375rem] leading-[1.7] text-wesup-ink-sub text-pretty">{description}</p> : null}
      </div>
      {actions ? <div className="shrink-0">{actions}</div> : null}
    </header>
  );
}
