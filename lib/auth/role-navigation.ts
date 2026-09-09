import type { UserAccessState } from "@/lib/auth/access-state";

export interface RoleNavigationItem {
  href: string;
  label: string;
}

export function getRoleNavigationItems(
  accessState: UserAccessState | null,
): RoleNavigationItem[] {
  if (!accessState || accessState.status !== "active") {
    return [
      { href: "/", label: "Beranda" },
      { href: "/marketplace", label: "Marketplace" },
      { href: "/login", label: "Masuk" },
      { href: "/register", label: "Daftar" },
    ];
  }

  if (accessState.role === "admin") {
    return [{ href: "/admin", label: "Admin" }];
  }

  if (accessState.role === "umkm") {
    return [
      { href: "/umkm", label: "Dashboard" },
      { href: "/marketplace", label: "Marketplace" },
      { href: "/umkm/pesanan", label: "Pesanan" },
      { href: "/umkm/notifikasi", label: "Notifikasi" },
      { href: "/umkm/akun", label: "Akun" },
    ];
  }

  if (accessState.verificationStatus !== "approved") {
    return [
      { href: "/supplier/status", label: "Status" },
      { href: "/marketplace", label: "Marketplace" },
      { href: "/supplier/status", label: "Akun" },
    ];
  }

  return [
    { href: "/supplier", label: "Dashboard" },
    { href: "/supplier/catalog", label: "Katalog" },
    { href: "/supplier/pesanan", label: "Pesanan & Pengambilan" },
    { href: "/supplier/notifikasi", label: "Notifikasi" },
    { href: "/supplier/akun", label: "Akun" },
  ];
}
