import Link from "next/link";
import { ShoppingBag } from "lucide-react";
import { Eyebrow } from "@/components/landing/Eyebrow";

export function AuthHeader({ title, description, eyebrow, backHref, backLabel }: { title: string; description: string; eyebrow: string; backHref?: string; backLabel?: string }) {
  return <header className="app-enter mb-10 text-center sm:mb-12">
    <Link href="/" aria-label="Wesup - Kembali ke beranda" className="group inline-flex min-h-11 items-center gap-3 text-wesup-ink focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-wesup-red"><span className="flex size-9 items-center justify-center border border-wesup-ink/20"><ShoppingBag aria-hidden="true" strokeWidth={1.5} className="size-4 text-wesup-red transition-transform duration-500 wesup-ease group-hover:-rotate-6" /></span><span className="font-landing-display text-xl">Wesup</span></Link>
    <div className="mt-8"><Eyebrow>{eyebrow}</Eyebrow></div>
    <h1 className="mt-5 font-landing-display text-3xl font-normal uppercase leading-[1.05] tracking-[0.04em] text-wesup-ink text-balance sm:text-4xl md:text-5xl">{title}</h1>
    <p className="mx-auto mt-5 max-w-xl text-[0.9375rem] leading-[1.7] text-wesup-ink-sub text-pretty">{description}</p>
    {backHref && <Link href={backHref} className="mt-3 inline-flex min-h-11 items-center text-sm font-semibold text-wesup-ink underline decoration-wesup-ink/30 underline-offset-4 transition-colors duration-300 hover:decoration-wesup-red">{backLabel ?? "← Kembali"}</Link>}
  </header>;
}
