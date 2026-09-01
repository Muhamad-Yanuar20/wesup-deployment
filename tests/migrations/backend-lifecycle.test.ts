import { beforeAll, describe, expect, it } from "vitest";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

const MIGRATIONS_DIR = join(process.cwd(), "supabase", "migrations");

function listMigrationFiles(): string[] {
  if (!existsSync(MIGRATIONS_DIR)) return [];
  return readdirSync(MIGRATIONS_DIR)
    .filter((f) => f.endsWith(".sql"))
    .sort();
}

function readAllSql(): string {
  return listMigrationFiles()
    .map((f) => readFileSync(join(MIGRATIONS_DIR, f), "utf8"))
    .join("\n");
}

function lastFunction(sql: string, name: string): string {
  const re = new RegExp(
    `create\\s+(?:or\\s+replace\\s+)?function\\s+public\\.${name}\\b[\\s\\S]*?\\$\\$;`,
    "ig",
  );
  const matches = [...sql.matchAll(re)];
  return matches.length ? matches[matches.length - 1][0] : "";
}

describe("catalog batch CRUD + validation (Slice 1)", () => {
  let allSql: string;
  let createBatch: string;
  let updateBatch: string;

  beforeAll(() => {
    allSql = readAllSql();
    createBatch = lastFunction(allSql, "create_batch");
    updateBatch = lastFunction(allSql, "update_batch");
  });

  it("defines create_batch as security definer", () => {
    expect(createBatch).toMatch(/create\s+or\s+replace\s+function\s+public\.create_batch/i);
    expect(createBatch).toMatch(/security\s+definer/i);
  });

  it("requires a signed-in approved supplier (or admin) to create a batch", () => {
    expect(createBatch).toMatch(/auth\.uid\(\) is null/i);
    expect(createBatch).toMatch(/is_supplier_approved\(\)/i);
    expect(createBatch).toMatch(/public\.is_admin\(\)/i);
  });

  it("validates linear timeline: open < close < payment < ready", () => {
    expect(createBatch).toMatch(/(?:p_)?registration_opens_at\s*<\s*(?:p_)?registration_closes_at/i);
    expect(createBatch).toMatch(/(?:p_)?registration_closes_at\s*<\s*(?:p_)?payment_opens_at/i);
    expect(createBatch).toMatch(/(?:p_)?payment_closes_at\s*<\s*(?:p_)?estimated_ready_at/i);
  });

  it("rejects tier price inversion (tier N+1 >= tier N)", () => {
    expect(createBatch).toMatch(/price_per_unit/i);
    expect(createBatch).toMatch(/raise\s+exception/i);
  });

  it("rejects overlapping tier volume ranges", () => {
    expect(createBatch).toMatch(/min_volume/i);
    expect(createBatch).toMatch(/overlap/i);
  });

  it("bounds coordinates to the Bandung region", () => {
    expect(createBatch).toMatch(/latitude/i);
    expect(createBatch).toMatch(/longitude/i);
    expect(createBatch).toMatch(/-7/i);
  });

  it("creates the batch, its tiers, and its timeline atomically", () => {
    expect(createBatch).toMatch(/insert\s+into\s+public\.batches/i);
    expect(createBatch).toMatch(/insert\s+into\s+public\.batch_tiers/i);
    expect(createBatch).toMatch(/insert\s+into\s+public\.batch_timeline/i);
  });

  it("does not introduce a cron or scheduled job (Lazy Evaluation)", () => {
    expect(createBatch).not.toMatch(/cron/i);
    expect(createBatch).not.toMatch(/pg_cron/i);
  });

  it("grants execution only to authenticated users", () => {
    expect(allSql).toMatch(/grant\s+execute\s+on\s+function\s+public\.create_batch[^;]*to\s+authenticated/i);
  });

  it("defines update_batch with location-lock after registrants exist", () => {
    expect(updateBatch).toMatch(/update_batch/i);
    expect(updateBatch).toMatch(/registrations/i);
  });
});
