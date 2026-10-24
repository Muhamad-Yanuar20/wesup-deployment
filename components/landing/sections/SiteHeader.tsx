"use client";

import { BrandLogo } from "@/components/brand/BrandLogo";

import { useEffect, useId, useState, type CSSProperties } from "react";
import Link from "next/link";
import { ArrowRight, Menu, X } from "lucide-react";
import { useNavigationSession } from "@/components/auth/NavigationSessionProvider";
import { getDashboardPath } from "@/lib/auth/role-navigation";

const NAV_LINKS = [
  { href: "#cara-kerja", label: "Cara kerja" },
  { href: "#features", label: "Keunggulan" },
] as const;

/**
 * Hard-edged nav bar: a single bordered strip inset from the top, no radius,
 * no translucency tricks — a paper plate on paper with an ink hairline.
 */
export function SiteHeader() {
  const menuId = useId();
  const [open, setOpen] = useState(false);
  const { accessState } = useNavigationSession();
  const dashboardPath = accessState?.status === "active" ? getDashboardPath(accessState) : null;

  // Escape and viewport-sized desktop both resolve back to the closed state;
  // the desktop nav takes over at md+, so a menu left open while resizing
  // would otherwise stay mounted over it.
  useEffect(() => {
    if (!open) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    const onResize = () => {
      if (window.innerWidth >= 768) setOpen(false);
    };

    document.addEventListener("keydown", onKeyDown);
    window.addEventListener("resize", onResize);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("resize", onResize);
    };
  }, [open]);

  return (
    <header className="pointer-events-none fixed inset-x-0 top-0 z-50">
      <div className="container mx-auto flex justify-center px-4 pt-4 sm:px-6 lg:px-8">
        <div
          data-nav-pill=""
          className="pointer-events-auto flex w-full max-w-4xl items-center justify-between gap-4 border border-wesup-ink/20 bg-wesup-paper py-1.5 pl-3 pr-2"
        >
          <Link
            href="/"
            aria-label="Wesup - Kembali ke beranda"
            className="group flex items-center gap-2.5 py-1 pl-1 pr-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-wesup-red"
          >
            <BrandLogo className="[&>span:last-child]:hidden sm:[&>span:last-child]:inline" />
          </Link>

          <nav className="hidden items-center gap-1 md:flex" aria-label="Navigasi utama">
            {NAV_LINKS.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="group px-4 py-2 text-sm font-medium text-wesup-ink-sub transition-colors duration-500 hover:text-wesup-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-wesup-red"
              >
                {item.label}
                <span
                  aria-hidden="true"
                  className="mx-4 -mt-px block h-px origin-left scale-x-0 bg-wesup-red transition-transform duration-500 wesup-ease group-hover:scale-x-100"
                />
              </Link>
            ))}
          </nav>

          <div className="flex items-center gap-1.5 sm:gap-2">
            {dashboardPath ? (
              <Link
                href={dashboardPath}
                className="group inline-flex min-h-10 items-center border border-wesup-ink bg-wesup-ink py-1.5 pl-4 pr-2 text-sm font-semibold text-wesup-paper transition-all duration-500 wesup-ease hover:translate-x-0.5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-wesup-red"
              >
                Dashboard
                <span
                  aria-hidden="true"
                  className="ml-2.5 inline-flex h-7 w-7 items-center justify-center text-wesup-paper transition-all duration-500 wesup-ease group-hover:translate-x-0.5"
                >
                  <ArrowRight className="h-3.5 w-3.5" strokeWidth={1.5} />
                </span>
              </Link>
            ) : (
              <>
                <Link
                  href="/login"
                  className="hidden min-h-10 items-center px-4 text-sm font-medium text-wesup-ink-sub transition-colors duration-500 hover:text-wesup-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-wesup-red sm:inline-flex"
                >
                  Masuk
                </Link>
                <Link
                  href="/register?role=umkm"
                  className="group inline-flex min-h-10 items-center border border-wesup-ink bg-wesup-ink py-1.5 pl-4 pr-2 text-sm font-semibold text-wesup-paper transition-all duration-500 wesup-ease hover:translate-x-0.5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-wesup-red"
                >
                  Mulai Bergabung
                  <span
                    aria-hidden="true"
                    className="ml-2.5 inline-flex h-7 w-7 items-center justify-center text-wesup-paper transition-all duration-500 wesup-ease group-hover:translate-x-0.5"
                  >
                    <ArrowRight className="h-3.5 w-3.5" strokeWidth={1.5} />
                  </span>
                </Link>
              </>
            )}

            <button
              type="button"
              aria-expanded={open}
              aria-controls={menuId}
              aria-label={open ? "Tutup menu navigasi" : "Buka menu navigasi"}
              onClick={() => setOpen((value) => !value)}
              className="inline-flex h-10 w-10 items-center justify-center border border-wesup-ink/20 bg-wesup-paper text-wesup-ink transition-colors duration-500 hover:bg-wesup-paper-sub focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-wesup-red md:hidden"
            >
              {open ? (
                <X className="h-5 w-5" strokeWidth={1.5} aria-hidden="true" />
              ) : (
                <Menu className="h-5 w-5" strokeWidth={1.5} aria-hidden="true" />
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Screen-filling menu overlay. Always mounted so aria-controls is
          never dangling; closed state is visibility + opacity driven (see
          .wesup-menu-item in globals.css), which keeps the staggered exit. */}
      <div
        id={menuId}
        data-menu-open={open}
        aria-hidden={!open}
        className="pointer-events-auto fixed inset-0 bg-wesup-paper opacity-0 transition-[opacity,visibility] duration-500 wesup-ease invisible md:hidden"
        style={open ? { opacity: 1, visibility: "visible", pointerEvents: "auto" } : undefined}
      >
        <div className="flex h-full flex-col justify-center gap-2 px-8 pb-16 pt-24">
          {NAV_LINKS.map((item, index) => (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => setOpen(false)}
              className="wesup-menu-item border border-wesup-ink/15 bg-wesup-paper px-6 py-5 font-landing-display text-2xl font-medium tracking-[0.06em] uppercase text-wesup-ink transition-colors duration-500 hover:bg-wesup-paper-sub focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-wesup-red"
              style={{ "--i": index } as CSSProperties}
            >
              {item.label}
            </Link>
          ))}
          {dashboardPath ? (
            <Link
              href={dashboardPath}
              onClick={() => setOpen(false)}
              className="wesup-menu-item mt-4 border border-wesup-ink bg-wesup-ink px-6 py-4 text-center text-base font-semibold text-wesup-paper transition-colors duration-500 hover:bg-wesup-ink-sub focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-wesup-red"
              style={{ "--i": NAV_LINKS.length } as CSSProperties}
            >
              Dashboard
            </Link>
          ) : (
            <Link
              href="/login"
              onClick={() => setOpen(false)}
              className="wesup-menu-item mt-4 border border-wesup-ink bg-wesup-ink px-6 py-4 text-center text-base font-semibold text-wesup-paper transition-colors duration-500 hover:bg-wesup-ink-sub focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-wesup-red"
              style={{ "--i": NAV_LINKS.length } as CSSProperties}
            >
              Masuk
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}
