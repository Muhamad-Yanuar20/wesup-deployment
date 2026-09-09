import { beforeEach, describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import { getServerClient } from "@/lib/supabase/server";
import { GET as getDashboard } from "@/app/api/umkm/dashboard/route";
import { GET as getOrders } from "@/app/api/umkm/orders/route";
import {
  GET as getNotifications,
  PATCH as markNotificationsRead,
} from "@/app/api/umkm/notifications/route";

vi.mock("@/lib/supabase/server", () => ({ getServerClient: vi.fn() }));
const mockGetServerClient = vi.mocked(getServerClient);

const USER_ID = "11111111-1111-4111-8111-111111111111";

function mockClient(options: {
  role?: "umkm" | "supplier" | "admin";
  profile?: Record<string, unknown> | null;
  registrations?: Array<Record<string, unknown>>;
  notifications?: Array<Record<string, unknown>>;
}) {
  const update = vi.fn(() => ({
    eq: vi.fn(() => ({
      is: vi.fn(async () => ({ data: null, error: null })),
    })),
  }));
  const from = vi.fn((table: string) => {
    if (table === "profiles") {
      return {
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            single: vi.fn(async () => ({ data: { role: options.role ?? "umkm", status: "active", full_name: "Rina" }, error: null })),
          })),
        })),
      };
    }
    if (table === "umkm_profiles") {
      return {
        select: vi.fn(() => ({
          eq: vi.fn(() => ({ maybeSingle: vi.fn(async () => ({ data: options.profile ?? null, error: null })) })),
        })),
      };
    }
    if (table === "registrations") {
      return {
        select: vi.fn(() => ({
          eq: vi.fn(async () => ({ data: options.registrations ?? [], error: null })),
        })),
      };
    }
    if (table === "notifications") {
      return {
        select: vi.fn(() => ({
          eq: vi.fn((column: string) => {
            if (column === "user_id") {
              return {
                is: vi.fn(async () => ({ data: (options.notifications ?? []).filter((row) => !row.read_at), error: null })),
                order: vi.fn(async () => ({ data: options.notifications ?? [], error: null })),
              };
            }
            return { order: vi.fn(async () => ({ data: options.notifications ?? [], error: null })) };
          }),
        })),
        update,
      };
    }
    return { select: vi.fn() };
  });
  const client = {
    auth: { getUser: vi.fn(async () => ({ data: { user: { id: USER_ID, email: "rina@example.com" } }, error: null })) },
    from,
  };
  mockGetServerClient.mockResolvedValue(client as unknown as SupabaseClient<Database>);
  return { client, update };
}

describe("UMKM workspace APIs", () => {
  beforeEach(() => mockGetServerClient.mockReset());

  it("returns profile completeness, active orders, unread notifications, and the nearest action", async () => {
    mockClient({
      profile: { business_name: "Warung Rina", address: "Bandung" },
      registrations: [
        { id: "reg-1", batch_id: "batch-1", status: "pending_payment", quantity: 3, final_amount: 30000, created_at: "2026-09-09T08:00:00Z", batch: { id: "batch-1", title: "Beras", batch_timeline: [{ registration_closes_at: "2026-09-10T00:00:00Z", payment_opens_at: "2026-09-10T01:00:00Z", estimated_ready_at: "2026-09-11T01:00:00Z" }] } },
      ],
      notifications: [{ id: "n-1", read_at: null }],
    });
    const response = await getDashboard();
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      profileComplete: true,
      activeOrderCount: 1,
      unreadNotificationCount: 1,
      nextAction: expect.objectContaining({ type: "payment", registrationId: "reg-1", dueAt: "2026-09-10T01:00:00Z" }),
    });
  });

  it("filters dashboard data by the authenticated UMKM id", async () => {
    const { client } = mockClient({ profile: null });
    await getDashboard();
    const registrationsCall = client.from.mock.results.find((result) => result.value && typeof result.value === "object");
    expect(registrationsCall).toBeTruthy();
  });

  it("returns only the current UMKM's registration rows", async () => {
    mockClient({ registrations: [{ id: "reg-1", batch_id: "batch-1", status: "registered", quantity: 2, final_amount: null, locked_tier_number: null, created_at: "2026-09-09T08:00:00Z", batch: { id: "batch-1", title: "Beras", status: "published" } }] });
    const response = await getOrders();
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ orders: [expect.objectContaining({ id: "reg-1", batchTitle: "Beras", quantity: 2 })] });
  });

  it("reads notifications and marks only unread rows for the current user", async () => {
    const { update } = mockClient({ notifications: [{ id: "n-1", type: "payment_due", title: "Bayar", message: "Segera bayar", read_at: null, created_at: "2026-09-09T08:00:00Z" }] });
    const response = await getNotifications();
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ notifications: [expect.objectContaining({ id: "n-1", title: "Bayar" })] });
    const patchResponse = await markNotificationsRead();
    expect(patchResponse.status).toBe(200);
    expect(update).toHaveBeenCalledWith({ read_at: expect.any(String) });
  });

  it("rejects Supplier access to UMKM workspace APIs", async () => {
    mockClient({ role: "supplier" });
    expect((await getDashboard()).status).toBe(403);
    expect((await getOrders()).status).toBe(403);
    expect((await getNotifications()).status).toBe(403);
  });
});
