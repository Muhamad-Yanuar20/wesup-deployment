import Link from "next/link";
import { ArrowRight, ShoppingBag } from "lucide-react";

const NAV_LINKS = [
  { href: "#cara-kerja", label: "Cara kerja" },
  { href: "#features", label: "Keunggulan" },
  { href: "/beranda-umkm", label: "Panduan UMKM" },
] as const;

export function SiteHeader() {
  return (
    <header className="fixed inset-x-0 top-0 z-50 border-b border-slate-900/[0.06] bg-wesup-ivory/80 backdrop-blur-xl">
      <div className="container mx-auto flex h-16 items-center justify-between px-4 sm:px-6 lg:px-8">
        <Link
          href="/"
          className="group flex items-center gap-2.5 rounded-lg focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-blue-600"
        >
          <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-slate-900 shadow-sm shadow-slate-900/20 ring-1 ring-slate-900/10 transition-transform duration-500 wesup-ease group-hover:-rotate-6">
            <ShoppingBag className="h-4 w-4 text-white" strokeWidth={1.5} aria-hidden="true" />
          </span>
          <span className="font-landing-display text-2xl font-medium tracking-[-0.02em] text-slate-900">
            Wesup
          </span>
        </Link>

        <nav className="hidden items-center gap-1 md:flex" aria-label="Navigasi utama">
          {NAV_LINKS.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="group relative rounded-full px-4 py-2 text-sm font-medium text-slate-600 transition-colors duration-500 hover:text-slate-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-600"
            >
              {item.label}
              <span
                aria-hidden="true"
                className="absolute inset-x-4 -bottom-px h-px origin-left scale-x-0 bg-slate-900/50 transition-transform duration-500 wesup-ease group-hover:scale-x-100"
              />
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-2 sm:gap-3">
          <Link
            href="/login"
            className="hidden min-h-11 items-center rounded-full px-4 text-sm font-medium text-slate-600 transition-colors duration-500 hover:text-slate-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-600 sm:inline-flex"
          >
            Masuk
          </Link>
          <Link
            href="/register?role=umkm"
            className="group inline-flex min-h-11 items-center rounded-full bg-slate-900 py-1.5 pl-5 pr-1.5 text-sm font-semibold text-white shadow-sm shadow-slate-900/20 transition-all duration-500 wesup-ease hover:bg-slate-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 active:scale-[0.98]"
          >
            Mulai Bergabung
            <span
              aria-hidden="true"
              className="ml-3 inline-flex h-8 w-8 items-center justify-center rounded-full bg-white/10 ring-1 ring-inset ring-white/15 transition-transform duration-500 wesup-ease group-hover:translate-x-0.5"
            >
              <ArrowRight className="h-3.5 w-3.5 text-white" strokeWidth={1.5} />
            </span>
          </Link>
        </div>
      </div>
    </header>
  );
}
