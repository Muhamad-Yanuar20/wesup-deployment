"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard,
  Users,
  ClipboardCheck,
  ShieldAlert,
  Wallet,
  ScrollText,
  Store,
} from "lucide-react";

type AdminSidebarProps = {
  pendingSuppliersCount?: number;
};

export function AdminSidebar({ pendingSuppliersCount }: AdminSidebarProps) {
  const pathname = usePathname();

  const NAV_ITEMS = [
    { label: "Ringkasan", href: "/admin", icon: LayoutDashboard },
    {
      label: "Antrean Supplier",
      href: "/admin/suppliers",
      icon: ClipboardCheck,
      badge: pendingSuppliersCount,
    },
    { label: "Manajemen Pengguna", href: "/admin/users", icon: Users },
    { label: "Katalog & Moderasi", href: "/admin/catalog", icon: Store },
    { label: "Sengketa Escrow", href: "/admin/disputes", icon: ShieldAlert },
    { label: "Antrean Refund", href: "/admin/refunds", icon: Wallet },
    { label: "Log Aktivitas", href: "/admin/audit-log", icon: ScrollText },
  ];

  return (
    <aside className="flex h-screen w-64 shrink-0 flex-col border-r border-slate-800 bg-[#12181f]">
      {/* Brand */}
      <div className="flex h-16 items-center gap-2.5 border-b border-slate-800 px-5">
        <div className="flex h-8 w-8 items-center justify-center rounded-md bg-amber-500/15 text-amber-400">
          <span className="font-mono text-sm font-semibold">W</span>
        </div>
        <div className="leading-tight">
          <p className="font-mono text-[13px] font-semibold tracking-wide text-slate-100">
            WeSUP
          </p>
          <p className="text-[11px] text-slate-500">Admin Console</p>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto px-3 py-4">
        <p className="px-2.5 pb-2 font-mono text-[10px] font-medium uppercase tracking-[0.14em] text-slate-600">
          Operasional
        </p>
        <ul className="flex flex-col gap-0.5">
          {NAV_ITEMS.map((item) => {
            const isActive =
              pathname === item.href ||
              (item.href !== "/admin" && pathname?.startsWith(item.href));
            const Icon = item.icon;

            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className={cn(
                    "group flex items-center gap-3 rounded-md px-2.5 py-2 text-sm transition-colors",
                    isActive
                      ? "bg-slate-800/80 text-slate-100"
                      : "text-slate-400 hover:bg-slate-800/40 hover:text-slate-200"
                  )}
                >
                  <Icon
                    className={cn(
                      "h-[18px] w-[18px] shrink-0",
                      isActive
                        ? "text-amber-400"
                        : "text-slate-500 group-hover:text-slate-300"
                    )}
                  />
                  <span className="flex-1 truncate">{item.label}</span>
                  {typeof item.badge === "number" && item.badge > 0 ? (
                    <span className="rounded-full bg-amber-500/15 px-1.5 py-0.5 font-mono text-[10px] font-semibold text-amber-400">
                      {item.badge}
                    </span>
                  ) : null}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      {/* Footer */}
      <div className="border-t border-slate-800 px-5 py-4">
        <p className="font-mono text-[10px] text-slate-600">
          WeSUP · SDG 8 · Bandung MVP
        </p>
      </div>
    </aside>
  );
}