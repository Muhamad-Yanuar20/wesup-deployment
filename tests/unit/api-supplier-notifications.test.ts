import { beforeEach, describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import { getServerClient } from "@/lib/supabase/server";
import { GET, PATCH } from "@/app/api/suppliers/notifications/route";

vi.mock("@/lib/supabase/server", () => ({ getServerClient: vi.fn() }));
const mockGetServerClient = vi.mocked(getServerClient);

function makeClient(options: { user?: boolean; verification?: string } = {}) {
  const userId = "33333333-3333-4333-8333-333333333333";
  const notifications = [{ id: "notification-1", type: "batch_update", title: "Batch diperbarui", message: "Jadwal batch berubah", data: { href: "/supplier" }, read_at: null, created_at: "2026-09-09T10:00:00Z" }];
  const notificationEq = vi.fn(() => ({ order: vi.fn(async () => ({ data: notifications, error: null })) }));
  const notificationUpdate = vi.fn(() => ({ eq: vi.fn(() => ({ is: vi.fn(async () => ({ data: null, error: null })) })) }));
  const notificationFrom = { select: vi.fn(() => ({ eq: notificationEq })), update: notificationUpdate };
  const supplierFrom = { select: vi.fn(() => ({ eq: vi.fn(() => ({ maybeSingle: vi.fn(async () => ({ data: { verification_status: options.verification ?? "approved" }, error: null })) })) })) };
  const profileFrom = { select: vi.fn(() => ({ eq: vi.fn(() => ({ single: vi.fn(async () => ({ data: { role: "supplier", status: "active", full_name: "Supplier" }, error: null })) })) })) };
  const client = {
    auth: { getUser: vi.fn(async () => ({ data: { user: options.user === false ? null : { id: userId, email: "supplier@example.com" } }, error: null })) },
    from: vi.fn((table: string) => table === "supplier_profiles" ? supplierFrom : table === "notifications" ? notificationFrom : profileFrom),
  };
  mockGetServerClient.mockResolvedValue(client as unknown as SupabaseClient<Database>);
  return { client, notificationEq, notificationUpdate };
}

describe("Supplier notifications API", () => {
  beforeEach(() => mockGetServerClient.mockReset());

  it("returns only the approved Supplier's notifications", async () => {
    const { notificationEq } = makeClient();
    const response = await GET();
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ notifications: [{ id: "notification-1", type: "batch_update", title: "Batch diperbarui", message: "Jadwal batch berubah", readAt: null, createdAt: "2026-09-09T10:00:00Z", href: "/supplier" }] });
    expect(notificationEq).toHaveBeenCalledWith("user_id", "33333333-3333-4333-8333-333333333333");
  });

  it("rejects pending Supplier access before reading notifications", async () => {
    const { notificationEq } = makeClient({ verification: "pending" });
    const response = await GET();
    expect(response.status).toBe(403);
    expect(notificationEq).not.toHaveBeenCalled();
  });

  it("marks only current user's unread notifications with a server timestamp", async () => {
    const { notificationUpdate } = makeClient();
    const response = await PATCH();
    expect(response.status).toBe(200);
    expect(notificationUpdate).toHaveBeenCalledWith({ read_at: expect.any(String) });
  });

  it("returns 401 for a guest", async () => {
    makeClient({ user: false });
    expect((await GET()).status).toBe(401);
  });
});
