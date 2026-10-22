"use client";

import { LogoutAction } from "@/components/auth/LogoutAction";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { getActiveNavigationIndex, getDashboardPath, getRoleNavigationItems, type RoleNavigationItem } from "@/lib/auth/role-navigation";
import { useNavigationSession } from "@/components/auth/NavigationSessionProvider";

function IconHome() {
    return <svg className="h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5} aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" d="M3 12l9-9 9 9M4 10v10a1 1 0 001 1h5V14h4v7h5a1 1 0 001-1V10" /></svg>;
}
function IconStore() {
    return <svg className="h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5} aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" d="M3 3h18l-2 9H5L3 3zM5 12v7a1 1 0 001 1h12a1 1 0 001-1v-7" /></svg>;
}
function IconClipboard() {
    return <svg className="h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5} aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" /></svg>;
}
function IconBell() {
    return <svg className="h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5} aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6 6 0 10-12 0v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" /></svg>;
}
function IconUser() {
    return <svg className="h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5} aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>;
}
function IconSupplier() {
    return <svg className="h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5} aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" /></svg>;
}
function iconForItem(item: RoleNavigationItem) {
    if (item.label === "Beranda" || item.label === "Dashboard" || item.label === "Admin") return <IconHome />;
    if (item.label === "Marketplace" || item.label === "Katalog") return <IconStore />;
    if (item.label.startsWith("Pesanan")) return <IconClipboard />;
    if (item.label === "Notifikasi") return <IconBell />;
    return item.label === "Status" ? <IconSupplier /> : <IconUser />;
}

export function NavigationBar({ brandHref = "/" }: { brandHref?: string | null } = {}) {
    const pathname = usePathname();
    const { accessState } = useNavigationSession();
    const authenticated = Boolean(accessState);

    const navItems = getRoleNavigationItems(accessState);
    const activeIndex = getActiveNavigationIndex(navItems, pathname);

    const dashboardPath = accessState?.status === "active" ? getDashboardPath(accessState) : null;
    const isDashboardRoute =
        pathname.startsWith("/umkm") ||
        pathname.startsWith("/supplier") ||
        pathname.startsWith("/admin");
    const showDashboardCta = Boolean(dashboardPath && !isDashboardRoute);

    const brandContent = (
        <>
            <span className="flex h-9 w-9 items-center justify-center border border-wesup-ink/20 bg-wesup-paper text-sm font-bold text-wesup-red" aria-hidden="true">
                W
            </span>
            <span className="font-landing-display text-xl tracking-[-0.02em]">Wesup</span>
        </>
    );

    return (
        <header className="sticky top-0 z-40 w-full border-b border-wesup-ink/15 bg-wesup-paper">
            <div className="mx-auto flex min-h-16 w-full max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
                {brandHref ? (
                    <Link
                        href={brandHref}
                        className="flex items-center gap-2 text-wesup-ink transition-opacity hover:opacity-80"
                        aria-label="Wesup - Kembali ke Beranda"
                    >
                        {brandContent}
                    </Link>
                ) : (
                    <div className="flex items-center gap-2 text-wesup-ink">{brandContent}</div>
                )}

                <nav aria-label="Navigasi utama" className="hidden items-center gap-1 lg:flex">
                    {navItems.map((item, index) => (
                        <NavLink key={`${item.href}-${item.label}`} item={item} isActive={index === activeIndex} />
                    ))}
                    {showDashboardCta && dashboardPath ? (
                        <Link
                            href={dashboardPath}
                            className="group ml-1 inline-flex min-h-10 items-center border border-wesup-ink bg-wesup-ink py-1.5 pl-4 pr-2 text-sm font-semibold text-wesup-paper transition-all duration-500 wesup-ease hover:translate-x-0.5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-wesup-red"
                        >
                            Dashboard
                            <span
                                aria-hidden="true"
                                className="ml-2.5 inline-flex h-7 w-7 items-center justify-center text-wesup-paper transition-all duration-500 wesup-ease group-hover:translate-x-0.5"
                            >
                                <ArrowRight className="h-3.5 w-3.5" strokeWidth={1.5} />
                            </span>
                        </Link>
                    ) : null}
                    {authenticated && <LogoutAction />}
                </nav>

                <div className="flex items-center gap-2 lg:hidden" aria-label="Navigasi cepat">
                    <span className="font-mono text-[0.6875rem] uppercase tracking-[0.2em] text-wesup-ink-sub">Bandung</span>
                </div>
            </div>

            <nav aria-label="Navigasi bawah (mobile)" className="fixed inset-x-0 bottom-0 z-40 flex items-stretch justify-around gap-1 border-t border-wesup-ink/15 bg-wesup-paper px-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] pt-2 lg:hidden">
                {navItems.slice(0, 5).map((item, index) => (
                    <NavLink key={`${item.href}-${item.label}`} item={item} isActive={index === activeIndex} mobile />
                ))}
            </nav>
        </header>
    );
}

function NavLink({ item, isActive, mobile = false }: { item: RoleNavigationItem; isActive: boolean; mobile?: boolean }) {
    return (
        <Link href={item.href} aria-current={isActive ? "page" : undefined} className={cn(
            mobile
                ? "flex min-h-11 min-w-0 flex-1 flex-col items-center justify-center gap-1 border-t-2 py-1.5 font-mono text-[10px] uppercase transition-colors duration-300 wesup-ease"
                : "flex min-h-11 items-center gap-2 border-b-2 px-3 py-2 font-mono text-[0.6875rem] uppercase tracking-[0.1em] transition-colors duration-300 wesup-ease",
            isActive ? "border-wesup-red bg-wesup-paper-sub text-wesup-ink" : "border-transparent text-wesup-ink-sub hover:bg-wesup-paper-sub hover:text-wesup-ink",
        )}>
            <span className={cn("flex items-center gap-1", isActive && "text-wesup-ink-sub")}>{iconForItem(item)}</span>
            <span>{item.label}</span>
        </Link>
    );
}
