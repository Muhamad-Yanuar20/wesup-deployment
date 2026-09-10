import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const migration = readFileSync(
  resolve(process.cwd(), "supabase/migrations/20260909100000_umkm_signup_location.sql"),
  "utf8",
);

describe("UMKM location-first signup migration", () => {
  it("allows a location-only profile row while keeping coordinates required", () => {
    expect(migration).toMatch(/alter column business_name drop not null/i);
    expect(migration).toMatch(/alter column address drop not null/i);
    expect(migration).toMatch(/insert into public\.umkm_profiles \(user_id, business_name, address, latitude, longitude\)/i);
    expect(migration).toMatch(/values \(p_user_id, null, null, p_latitude, p_longitude\)/i);
  });

  it("guards the RPC with service-role, role, coordinate, and Bandung-radius checks", () => {
    expect(migration).toMatch(/current_user <> 'service_role'/i);
    expect(migration).toMatch(/v_role is distinct from 'umkm'/i);
    expect(migration).toMatch(/invalid UMKM coordinates/i);
    expect(migration).toMatch(/v_distance > 50/i);
    expect(migration).toMatch(/revoke execute on function public\.create_umkm_registration/i);
    expect(migration).toMatch(/grant execute on function public\.create_umkm_registration[\s\S]*to service_role/i);
  });
});
