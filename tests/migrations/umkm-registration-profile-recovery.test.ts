import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const migration = readFileSync(
  resolve(process.cwd(), "supabase/migrations/20260910012225_umkm_registration_profile_recovery.sql"),
  "utf8",
);
const rpcRepairMigration = readFileSync(
  resolve(process.cwd(), "supabase/migrations/20260910023101_umkm_registration_rpc_without_auth_users.sql"),
  "utf8",
);

describe("UMKM registration/profile recovery migration", () => {
  it("restores nullable business fields and explicit Data API grants", () => {
    expect(migration).toContain("alter table public.profiles enable row level security");
    expect(migration).toContain("grant select on table public.profiles to authenticated");
    expect(migration).toContain("alter column business_name drop not null");
    expect(migration).toContain("alter column address drop not null");
    expect(migration).toContain("alter table public.umkm_profiles enable row level security");
    expect(migration).toContain("revoke all on table public.umkm_profiles from anon");
    expect(migration).toContain("grant select, insert, update on table public.umkm_profiles to authenticated");
  });

  it("restricts reads, inserts, and updates to the active UMKM owner", () => {
    expect(migration).toContain('create policy "umkm_profiles_recovery_select_own"');
    expect(migration).toContain('create policy "umkm_profiles_recovery_insert_own"');
    expect(migration).toContain('create policy "umkm_profiles_recovery_update_own"');
    expect(migration).toContain("(select auth.uid()) = user_id");
    expect(migration).toContain("p.role = 'umkm'");
    expect(migration).toContain("p.status = 'active'");
    expect(migration).toContain("with check");
  });

  it("keeps signup role server-controlled and repairs the auth trigger", () => {
    expect(migration).toContain("create or replace function public.handle_new_user");
    expect(migration).toContain("create trigger on_auth_user_created");
    expect(migration).toContain("'umkm'");
    expect(migration).not.toContain("raw_user_meta_data ->> 'role'");
  });

  it("exposes the registration RPC only to service_role", () => {
    expect(migration).toContain("security invoker");
    expect(migration).toContain("current_user <> 'service_role'");
    expect(migration).toContain("revoke execute on function public.create_umkm_registration");
    expect(migration).toContain("grant execute on function public.create_umkm_registration");
    expect(migration).toContain("to service_role");
    expect(migration).toContain("on conflict (user_id) do nothing");
  });
  it("keeps the repaired RPC independent from auth.users", () => {
    expect(rpcRepairMigration).toContain("create or replace function public.create_umkm_registration");
    expect(rpcRepairMigration).toContain("security invoker");
    expect(rpcRepairMigration).toContain("current_user <> 'service_role'");
    expect(rpcRepairMigration).toContain("from public.profiles p");
    expect(rpcRepairMigration).not.toContain("from auth.users");
    expect(rpcRepairMigration).toContain("v_status is distinct from 'active'");
    expect(rpcRepairMigration).toContain("grant execute on function public.create_umkm_registration");
    expect(rpcRepairMigration).toContain("to service_role");
  });
});

