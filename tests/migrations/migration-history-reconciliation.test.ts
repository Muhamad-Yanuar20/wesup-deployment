import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const migrationDir = join(process.cwd(), "supabase", "migrations");
const markerFiles = [
  "20260914000000_remote_history_marker.sql",
  "20260914010000_remote_history_marker.sql",
];

describe("remote migration history reconciliation", () => {
  it("keeps both remote-only versions represented locally", () => {
    for (const file of markerFiles) expect(existsSync(join(migrationDir, file))).toBe(true);
  });

  it("uses no-op marker SQL without replaying unknown remote DDL", () => {
    for (const file of markerFiles) {
      const sql = readFileSync(join(migrationDir, file), "utf8");
      expect(sql).toMatch(/remote history marker/i);
      expect(sql).toMatch(/select\s+1\s*;/i);
      expect(sql).not.toMatch(/\b(create|alter|drop|truncate|insert|update|delete)\b/i);
    }
  });
});
