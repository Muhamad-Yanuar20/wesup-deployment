import { describe, expect, it } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

const migrationPath = join(
  process.cwd(),
  "supabase",
  "migrations",
  "20260909010000_supplier_catalog_ownership_contract.sql",
);

function sql() {
  return existsSync(migrationPath) ? readFileSync(migrationPath, "utf8") : "";
}

function functionBody(name: string) {
  return sql().match(
    new RegExp(`create\\s+(?:or\\s+replace\\s+)?function\\s+public\\.${name}\\b[\\s\\S]*?\\$\\$;`, "i"),
  )?.[0] ?? "";
}

describe("supplier catalog ownership contract migration", () => {
  it("adds an additive ownership-contract migration", () => {
    expect(existsSync(migrationPath)).toBe(true);
    expect(sql()).not.toMatch(/drop\s+table|truncate\s+table/i);
  });

  it("uses a private owner assertion with stable not-found and ownership SQLSTATEs", () => {
    const source = sql();
    const helper = functionBody("assert_supplier_batch_owner");
    expect(helper).toMatch(/security\s+definer/i);
    expect(helper).toMatch(/set\s+search_path\s*=\s*public/i);
    expect(helper).toMatch(/errcode\s*=\s*'P0002'/i);
    expect(helper).toMatch(/errcode\s*=\s*'42501'/i);
    expect(source).toMatch(/revoke\s+execute\s+on\s+function\s+public\.assert_supplier_batch_owner\(uuid\)\s+from\s+public,\s*anon,\s*authenticated/i);
  });

  it.each([
    "get_supplier_batch",
    "update_supplier_batch",
    "publish_supplier_batch",
    "cancel_batch",
    "delete_supplier_batch",
  ])("makes %s invoke the owner assertion with pinned, authenticated execution", (name) => {
    const body = functionBody(name);
    expect(body).toMatch(/security\s+definer/i);
    expect(body).toMatch(/set\s+search_path\s*=\s*public/i);
    expect(body).toMatch(/perform\s+public\.assert_supplier_batch_owner\(p_batch_id\)/i);
    expect(sql()).toMatch(new RegExp(`revoke\\s+execute\\s+on\\s+function\\s+public\\.${name}\\b[\\s\\S]*?from\\s+public,\\s*anon`, "i"));
    expect(sql()).toMatch(new RegExp(`grant\\s+execute\\s+on\\s+function\\s+public\\.${name}\\b[\\s\\S]*?to\\s+authenticated`, "i"));
  });

  it("uses stable validation and lifecycle SQLSTATEs", () => {
    const source = sql();
    expect(source).toMatch(/errcode\s*=\s*'22023'/i);
    expect(source).toMatch(/errcode\s*=\s*'55000'/i);
  });

  it("exposes an active approved supplier summary without private contact data", () => {
    const body = functionBody("get_supplier_dashboard_summary");
    expect(body).toMatch(/security\s+definer/i);
    expect(body).toMatch(/set\s+search_path\s*=\s*public/i);
    expect(body).toMatch(/assert_active_approved_supplier\(\)/i);
    expect(body).toMatch(/active_batch_count/i);
    expect(body).toMatch(/total_participant_count/i);
    expect(body).toMatch(/collected_revenue/i);
    expect(body).not.toMatch(/\b(phone|email|nik|ktp_photo_url)\b/i);
  });
});
