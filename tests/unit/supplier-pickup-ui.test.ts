import { readFileSync } from "node:fs";
import { expect, it } from "vitest";
it("uses a real camera rather than a scanner simulation", () => {
  expect(readFileSync("components/supplier/fulfillment/PickupScannerClient.tsx", "utf8")).not.toContain("Simulasi pemindai");
});
it("reads the supplier's own account details instead of an access-only placeholder", () => {
  const source = readFileSync("app/supplier/akun/page.tsx", "utf8");
  expect(source).toContain('from("supplier_profiles")');
  expect(source).toContain("phone");
  expect(source).not.toContain("setelah backend operasionalnya tersedia");
});
