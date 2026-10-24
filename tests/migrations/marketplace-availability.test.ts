import { describe, expect, it } from "vitest";
import { readdirSync, readFileSync } from "node:fs";

describe("marketplace availability migration", () => {
  const file = readdirSync("supabase/migrations").find(name => name.endsWith("_marketplace_availability.sql"));
  const sql = file ? readFileSync(`supabase/migrations/${file}`, "utf8") : "";
  it("has a private shared availability computation with exact time boundaries", () => {
    expect(sql).toMatch(/private\.marketplace_availability/i);
    expect(sql).toMatch(/registration_opens_at/);
    expect(sql).toMatch(/can_register/);
    expect(sql).toMatch(/remaining_quantity/);
  });
  it("filters availability before counting and paginating search results", () => {
    const search = sql.slice(sql.indexOf("create function public.search_batches"));
    expect(search.indexOf("a.can_register")).toBeGreaterThan(0);
    expect(search.indexOf("a.can_register")).toBeLessThan(search.indexOf("count(*) over"));
    expect(search).toMatch(/security definer/i);
  });
});
