import { ShoppingBag } from "lucide-react";

export function SiteFooter() {
  return (
    <footer className="mt-auto border-t border-wesup-ink bg-wesup-ink py-12 pb-16">
      <div className="container mx-auto flex flex-col items-center justify-between gap-6 px-4 sm:px-6 md:flex-row lg:px-8">
        <div className="flex items-center gap-2.5">
          <span className="flex h-7 w-7 items-center justify-center border border-wesup-paper/30">
            <ShoppingBag className="h-3.5 w-3.5 text-wesup-red-bright" strokeWidth={1.5} aria-hidden="true" />
          </span>
          <span className="font-landing-display text-lg font-medium tracking-[-0.02em] text-wesup-paper">
            Wesup
          </span>
        </div>
        <p className="text-center font-mono text-xs uppercase tracking-[0.18em] text-wesup-paper/60">
          &copy; {new Date().getFullYear()} Wesup · Pembelian kolektif bahan baku UMKM Bandung
        </p>
      </div>
    </footer>
  );
}
