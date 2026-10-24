
import { BrandLogo } from "@/components/brand/BrandLogo";

export function SiteFooter() {
  return (
    <footer className="mt-auto border-t border-wesup-ink bg-wesup-ink py-12 pb-16">
      <div className="container mx-auto flex flex-col items-center justify-between gap-6 px-4 sm:px-6 md:flex-row lg:px-8">
        <div className="flex items-center gap-2.5">
          <BrandLogo inverted />
        </div>
        <p className="text-center font-mono text-xs uppercase tracking-[0.18em] text-wesup-paper/60">
          &copy; {new Date().getFullYear()} Wesup · Pembelian kolektif bahan baku UMKM Bandung
        </p>
      </div>
    </footer>
  );
}
