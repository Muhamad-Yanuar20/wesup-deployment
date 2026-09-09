"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { getRoleNavigationItems, type RoleNavigationItem } from "@/lib/auth/role-navigation";
import type { UserAccessState } from "@/lib/auth/access-state";

function IconHome() {
    return <svg className="h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" d="M3 12l9-9 9 9M4 10v10a1 1 0 001 1h5V14h4v7h5a1 1 0 001-1V10" /></svg>;
}
function IconStore() {
    return <svg className="h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" d="M3 3h18l-2 9H5L3 3zM5 12v7a1 1 0 001 1h12a1 1 0 001-1v-7" /></svg>;
}
function IconClipboard() {
    return <svg className="h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" /></svg>;
}
function IconBell() {
    return <svg className="h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6 6 0 10-12 0v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" /></svg>;
}
function IconUser() {
    return <svg className="h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>;
}
function IconSupplier() {
    return <svg className="h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" /></svg>;
}
function IconLogOut() {
    return <svg className="h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" d="M15 3h4a2 2 0 012 2v14a2 2 0 01-2 2h-4m-5-4l4-4m0 0l-4-4m4 4H3" /></svg>;
}

function iconForItem(item: RoleNavigationItem) {
    if (item.label === "Beranda" || item.label === "Dashboard" || item.label === "Admin") return <IconHome />;
    if (item.label === "Marketplace" || item.label === "Katalog") return <IconStore />;
    if (item.label.startsWith("Pesanan")) return <IconClipboard />;
    if (item.label === "Notifikasi") return <IconBell />;
    return item.label === "Status" ? <IconSupplier /> : <IconUser />;
}

interface SessionResponse {
    accessState?: UserAccessState;
}

export function NavigationBar() {
    const pathname = usePathname();
    const router = useRouter();
    const [accessState, setAccessState] = useState<UserAccessState | null>(null);
    const [authenticated, setAuthenticated] = useState(false);
    const [loggingOut, setLoggingOut] = useState(false);

    useEffect(() => {
        let cancelled = false;
        void fetch("/api/auth/session", { cache: "no-store" })
            .then(async (response) => {
                if (!response.ok) return null;
                return (await response.json()) as SessionResponse;
            })
            .then((session) => {
                if (cancelled) return;
                setAuthenticated(Boolean(session?.accessState));
                setAccessState(session?.accessState ?? null);
            })
            .catch(() => {
                if (!cancelled) {
                    setAuthenticated(false);
                    setAccessState(null);
                }
            });
        return () => { cancelled = true; };
    }, []);

    async function handleLogout() {
        if (loggingOut) return;
        setLoggingOut(true);
        try {
            await fetch("/api/auth/logout", { method: "POST" });
        } finally {
            setAuthenticated(false);
            setAccessState(null);
            router.replace("/");
            router.refresh();
            setLoggingOut(false);
        }
    }

    const navItems = getRoleNavigationItems(accessState);

    return (
        <header className="sticky top-0 z-40 w-full border-b border-slate-200 bg-white/95 backdrop-blur-sm">
            <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
                <Link href="/" className="flex items-center gap-2 text-slate-900 transition-opacity hover:opacity-80" aria-label="Wesup - Kembali ke Beranda">
                    <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-600 text-sm font-bold text-white shadow-sm shadow-blue-600/20" aria-hidden="true">W</span>
                    <span className="text-lg font-extrabold tracking-tight">Wesup</span>
                </Link>

                <nav aria-label="Navigasi utama" className="hidden items-center gap-1 md:flex">
                    {navItems.map((item) => <NavLink key={`${item.href}-${item.label}`} item={item} pathname={pathname} />)}
                    {authenticated && <LogoutButton onClick={handleLogout} disabled={loggingOut} />}
                </nav>

                <div className="flex items-center gap-2 text-sm text-slate-400 md:hidden"><span>Menu</span></div>
            </div>

            <nav aria-label="Navigasi bawah (mobile)" className="fixed bottom-0 left-0 right-0 z-40 flex items-center justify-around border-t border-slate-200 bg-white px-2 py-2 md:hidden">
                {navItems.slice(0, 5).map((item) => <NavLink key={`${item.href}-${item.label}`} item={item} pathname={pathname} mobile />)}
                {authenticated && <LogoutButton onClick={handleLogout} disabled={loggingOut} mobile />}
            </nav>
        </header>
    );
}

function NavLink({ item, pathname, mobile = false }: { item: RoleNavigationItem; pathname: string; mobile?: boolean }) {
    const isActive = item.href === "/" ? pathname === "/" : pathname === item.href || pathname.startsWith(`${item.href}/`);
    return (
        <Link href={item.href} aria-current={isActive ? "page" : undefined} className={cn(
            mobile
                ? "flex min-h-11 flex-1 flex-col items-center justify-center gap-0.5 rounded-md py-1.5 text-[10px] font-medium transition-colors"
                : "flex min-h-11 items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
            isActive ? "bg-blue-50 text-blue-700" : "text-slate-600 hover:bg-slate-100 hover:text-slate-900",
        )}>
            <span className={cn("flex items-center gap-1", isActive && "text-blue-700")}>{iconForItem(item)}</span>
            <span>{item.label}</span>
        </Link>
    );
}

function LogoutButton({ onClick, disabled, mobile = false }: { onClick: () => void; disabled: boolean; mobile?: boolean }) {
    return (
        <button type="button" onClick={onClick} disabled={disabled} className={cn(
            mobile
                ? "flex min-h-11 flex-1 flex-col items-center justify-center gap-0.5 rounded-md py-1.5 text-[10px] font-medium text-slate-500 hover:text-slate-800"
                : "flex min-h-11 items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 hover:text-slate-900",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 disabled:cursor-wait disabled:opacity-50",
        )}>
            <IconLogOut />
            <span>{disabled ? "Keluar…" : "Keluar"}</span>
        </button>
    );
}