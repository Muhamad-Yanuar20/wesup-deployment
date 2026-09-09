import { describe, expect, it } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
const read = (path: string) => readFileSync(join(root, path), "utf8");

describe("Task 12 supplier integration contract", () => {
  it("keeps supplier fulfillment consumers on the real API repository", () => {
    const orders = read("components/supplier/fulfillment/OrderListClient.tsx");
    const pickup = read("components/supplier/fulfillment/PickupScannerClient.tsx");

    for (const source of [orders, pickup]) {
      expect(source).not.toContain("mock-repository");
      expect(source).not.toContain("mock-data");
      expect(source).toContain("supplierFulfillmentApiRepository");
    }
  });

  it("does not expose mock-backed supplier notifications", () => {
    const page = read("app/supplier/notifikasi/page.tsx");
    const client = read("components/supplier/SupplierNotificationsClient.tsx");
    expect(page).not.toContain("NotificationCenterClient");
    expect(page).not.toContain("mock-data");
    expect(client).not.toContain("mock-data");
    expect(client).toContain("/api/suppliers/notifications");
  });

  it("removes mock-only modules from dashboard links", () => {
    const dashboard = read("components/supplier/dashboard/SupplierDashboard.tsx");
    expect(dashboard).not.toContain("/supplier/akun/escrow");
    expect(dashboard).not.toContain("/supplier/akun/laporan");
    expect(dashboard).not.toContain("/supplier/akun/ulasan");
  });

  it("guards supplier dashboard API with approved capability", () => {
    const route = read("app/api/suppliers/dashboard/route.ts");
    expect(route).toContain("requireApprovedSupplier");
    expect(route).not.toContain('requireRole(client as unknown as AuthClient, ["supplier"])');
  });

  it("keeps mock-only modules as explicit unavailable pages", () => {
    for (const page of [
      "app/supplier/(dashboard)/akun/ulasan/page.tsx",
      "app/supplier/(dashboard)/akun/rekening/page.tsx",
      "app/supplier/(dashboard)/akun/escrow/page.tsx",
      "app/supplier/(dashboard)/akun/laporan/page.tsx",
      "app/supplier/(dashboard)/akun/laporan/riwayat/page.tsx",
      "app/supplier/(dashboard)/recurring/page.tsx",
      "app/supplier/(dashboard)/recurring/new/page.tsx",
    ]) {
      expect(existsSync(join(root, page))).toBe(true);
      const source = read(page);
      expect(source).not.toMatch(/mock-data|mock-repository/);
      expect(source).toContain("SupplierModuleUnavailable");
    }
  });
});
