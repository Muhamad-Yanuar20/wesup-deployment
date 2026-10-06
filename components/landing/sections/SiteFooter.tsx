import { ShoppingBag } from "lucide-react";

export function SiteFooter() {
  return (
    <footer className="mt-auto border-t border-slate-900/[0.06] bg-wesup-ivory py-12 pb-16 md:py-12">
      <div className="container mx-auto flex flex-col items-center justify-between gap-6 px-4 sm:px-6 md:flex-row lg:px-8">
        <div className="flex items-center gap-2.5">
          <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-slate-900 ring-1 ring-slate-900/10">
            <ShoppingBag className="h-3.5 w-3.5 text-white" strokeWidth={1.5} aria-hidden="true" />
          </span>
          <span className="font-landing-display text-lg font-medium tracking-[-0.02em] text-slate-900">
            Wesup
          </span>
        </div>
        <p className="text-center font-mono text-xs uppercase tracking-[0.18em] text-slate-500">
          &copy; {new Date().getFullYear()} Wesup · Pembelian kolektif bahan baku UMKM Bandung
        </p>
      </div>
    </footer>
  );
}
