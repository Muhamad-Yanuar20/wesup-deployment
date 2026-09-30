import { describe, expect, it } from "vitest";
import { getRoleNavigationItems } from "@/lib/auth/role-navigation";

describe("role-aware navigation", () => {
  it("shows only public browsing and auth links to guests", () => {
    expect(getRoleNavigationItems(null).map((item) => item.href)).toEqual([
      "/",
      "/marketplace",
      "/login",
      "/register",
    ]);
  });

  it("shows UMKM workspace routes only to UMKM", () => {
    const items = getRoleNavigationItems({ role: "umkm", status: "active", profileComplete: false });
    expect(items.map((item) => item.href)).toEqual([
      "/umkm",
      "/marketplace",
      "/umkm/pesanan",
      "/umkm/notifikasi",
      "/umkm/akun",
    ]);
  });

  it("keeps pending Supplier in read-only status navigation", () => {
    const items = getRoleNavigationItems({ role: "supplier", status: "active", verificationStatus: "pending" });
    expect(items.map((item) => item.href)).toEqual([
      "/supplier/status",
      "/marketplace",
      "/supplier/status",
    ]);
    expect(items.map((item) => item.label)).toEqual(["Status", "Marketplace", "Akun"]);
  });

  it("shows operational Supplier navigation only after approval", () => {
    const items = getRoleNavigationItems({ role: "supplier", status: "active", verificationStatus: "approved" });
    expect(items.map((item) => item.href)).toEqual([
      "/supplier",
      "/supplier/catalog",
      "/supplier/pesanan",
      "/supplier/notifikasi",
      "/supplier/akun",
    ]);
  });
});
