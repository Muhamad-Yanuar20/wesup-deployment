import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const migrationDir = join(process.cwd(), "supabase", "migrations");
const reconciledFiles = [
  "20260914000000_batch_pickup_name_audit.sql",
  "20260914010000_restore_storage_products_policies.sql",
];

describe("remote migration history reconciliation", () => {
  it("keeps both remote-only versions represented locally", () => {
    for (const file of reconciledFiles) expect(existsSync(join(migrationDir, file))).toBe(true);
  });

  it("uses the canonical migration names now present on main", () => {
    const pickupAudit = readFileSync(join(migrationDir, reconciledFiles[0]), "utf8");
    const storagePolicy = readFileSync(join(migrationDir, reconciledFiles[1]), "utf8");
    expect(pickupAudit).toMatch(/pickup_name/i);
    expect(storagePolicy).toMatch(/storage_objects_products_insert/i);
  });
});
