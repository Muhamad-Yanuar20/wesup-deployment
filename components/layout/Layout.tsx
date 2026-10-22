import { NavigationBar } from "@/components/layout/NavigationBar";
import { Footer } from "@/components/layout/Footer";
import { ReactNode } from "react";

interface LayoutProps {
  children: ReactNode;
  brandHref?: string | null;
  footerVariant?: "default" | "brand-only";
}

export function Layout({ children, brandHref = "/", footerVariant }: LayoutProps) {
  return (
    <div className="wesup-app flex min-h-dvh flex-col bg-wesup-paper text-wesup-ink">
      <a href="#main-content" className="sr-only z-50 bg-wesup-ink px-4 py-3 text-sm font-semibold text-wesup-paper focus:not-sr-only focus:fixed focus:left-4 focus:top-4">
        Lewati ke konten utama
      </a>
      <NavigationBar brandHref={brandHref} />
      <main id="main-content" className="app-main min-w-0 flex-1 bg-wesup-paper">
        {children}
      </main>
      <Footer variant={footerVariant} />
    </div>
  );
}
