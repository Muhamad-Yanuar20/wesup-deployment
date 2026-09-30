import { NavigationBar } from "@/components/layout/NavigationBar";
import { Footer } from "@/components/layout/Footer";
import { ReactNode } from "react";

interface LayoutProps {
  children: ReactNode;
}

export function Layout({ children }: LayoutProps) {
  return (
    <div className="flex min-h-screen flex-col bg-slate-50">
      <a href="#main-content" className="sr-only z-50 rounded-lg bg-blue-700 px-4 py-3 text-sm font-semibold text-white focus:not-sr-only focus:fixed focus:left-4 focus:top-4">
        Lewati ke konten utama
      </a>
      <NavigationBar />
      <main id="main-content" className="flex-1 bg-gradient-to-b from-blue-50/70 via-slate-50 to-white pb-24 md:pb-0">
        {children}
      </main>
      <Footer />
    </div>
  );
}