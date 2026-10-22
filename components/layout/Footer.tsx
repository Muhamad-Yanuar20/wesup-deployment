import Link from "next/link";
import { ShoppingBag } from "lucide-react";

export function Footer({ variant = "default" }: { variant?: "default" | "brand-only" } = {}) {
    const year = new Date().getFullYear();

    if (variant === "brand-only") return <footer className="mt-auto border-t border-wesup-ink bg-wesup-ink text-wesup-paper"><div className="mx-auto max-w-7xl px-4 py-8 pb-[var(--app-bottom-offset)] sm:px-6 lg:px-8 lg:pb-8"><div className="flex items-center gap-2"><ShoppingBag aria-hidden="true" className="size-5 text-wesup-red-bright" strokeWidth={1.5} /><span className="font-landing-display text-xl">Wesup</span></div><p className="mt-3 max-w-xl text-sm leading-7 text-wesup-paper/80">Platform pembelian kolektif bahan baku untuk UMKM Bandung dengan sistem escrow &amp; tier diskon otomatis.</p></div></footer>;
    return (
        <footer className="mt-auto border-t border-wesup-ink bg-wesup-ink text-wesup-paper">
            <div className="mx-auto w-full max-w-7xl px-4 py-12 pb-28 sm:px-6 lg:pb-12 lg:px-8">
                <div className="grid grid-cols-1 gap-6 sm:grid-cols-[1.5fr_1fr_1fr] sm:gap-12">
                    {/* Brand column */}
                    <div className="space-y-2">
                        <div className="flex items-center gap-2">
                            <span className="flex h-8 w-8 items-center justify-center border border-wesup-paper/30 text-xs font-bold text-wesup-red-bright">
                                <ShoppingBag className="size-4" strokeWidth={1.5} aria-hidden="true" />
                            </span>
                            <span className="font-landing-display text-xl text-wesup-paper">Wesup</span>
                        </div>
                        <p className="text-sm text-wesup-paper/80 leading-7 max-w-sm">
                            Platform pembelian kolektif bahan baku untuk UMKM Bandung dengan sistem escrow &amp; tier diskon otomatis.
                        </p>
                    </div>

                    {/* Platform links */}
                    <div>
                        <h4 className="mb-3 font-mono text-[0.6875rem] uppercase tracking-[0.2em] text-wesup-paper/70">
                            Platform
                        </h4>
                        <ul className="space-y-2">
                            {[
                                { href: "/marketplace", label: "Marketplace" },
                                { href: "/umkm/pesanan", label: "Pesanan Saya" },
                                { href: "/umkm/notifikasi", label: "Notifikasi" },
                            ].map((link) => (
                                <li key={link.href}>
                                    <Link
                                        href={link.href}
                                        className="inline-flex min-h-11 items-center text-sm text-wesup-paper/80 transition-colors duration-300 hover:text-wesup-paper focus-visible:outline-wesup-red-bright"
                                    >
                                        {link.label}
                                    </Link>
                                </li>
                            ))}
                        </ul>
                    </div>

                    {/* About links */}
                    <div>
                        <h4 className="mb-3 font-mono text-[0.6875rem] uppercase tracking-[0.2em] text-wesup-paper/70">
                            Tentang
                        </h4>
                        <ul className="space-y-2">
                            {[
                                { href: "/tentang", label: "Tentang Wesup" },
                                { href: "/syarat", label: "Syarat & Ketentuan" },
                                { href: "/privasi", label: "Kebijakan Privasi" },
                            ].map((link) => (
                                <li key={link.href}>
                                    <Link
                                        href={link.href}
                                        className="inline-flex min-h-11 items-center text-sm text-wesup-paper/80 transition-colors duration-300 hover:text-wesup-paper focus-visible:outline-wesup-red-bright"
                                    >
                                        {link.label}
                                    </Link>
                                </li>
                            ))}
                        </ul>
                    </div>
                </div>

                <div className="mt-8 border-t border-wesup-paper/20 pt-5 font-mono text-[0.6875rem] uppercase leading-6 tracking-[0.14em] text-wesup-paper/70">
                    © {year} Wesup — INSEVENT 2026 · Fullstack Web Development Competition
                </div>
            </div>
        </footer>
    );
}
