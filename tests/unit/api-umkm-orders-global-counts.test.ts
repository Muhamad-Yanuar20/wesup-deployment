import { beforeEach, describe, expect, it, vi } from "vitest";
import { resolveActiveUmkm } from "@/lib/umkm/workspace-auth";
import { GET } from "@/app/api/umkm/orders/route";

vi.mock("@/lib/supabase/server", () => ({ getServerClient: vi.fn() }));
vi.mock("@/lib/umkm/workspace-auth", () => ({ resolveActiveUmkm: vi.fn() }));

const mockResolveActiveUmkm = vi.mocked(resolveActiveUmkm);

const USER_ID = "11111111-1111-4111-8111-111111111111";

/**
 * `counts` and `summary` are the dashboard header. They are computed from every
 * order the UMKM owns, before the status filter and before the page window, so
 * the header never changes shape as the client pages or filters. `orders` and
 * `items` are the other way around: filtered, then sliced.
 *
 * The count buckets are not one status each. `picked_up` absorbs `completed`
 * and `refund` absorbs both `refund_pending` and `refunded`, so a naive
 * one-status-per-bucket count would disagree with the filter the same request
 * applies. The rows here are the mapping between the two.
 */
const FIXTURES = [
  "registered",
  "pending_payment",
  "paid",
  "paid",
  "picked_up",
  "completed",
  "cancelled",
  "no_show",
  "refund_pending",
  "refunded",
] as const;

interface FullBody {
  orders: unknown[];
  items: unknown[];
  summary: { total: number; pendingPayment: number; paidReady: number; pickedUp: number; refund: number };
  counts: Record<string, number>;
  serverTime: string;
  nextCursor: string | null;
}

function orderRow(index: number, status: string, batchTimeline: Record<string, string> | null = null) {
  return {
    id: `00000000-0000-4000-8000-${String(index).padStart(12, "0")}`,
    batch_id: `10000000-0000-4000-8000-${String(index).padStart(12, "0")}`,
    quantity: 5,
    status,
    final_amount: 25000,
    locked_tier_number: null,
    created_at: new Date(Date.UTC(2026, 0, 1, 0, index)).toISOString(),
    batch: {
      id: "batch",
      title: "Beras 5kg",
      status: "published",
      unit: "sack",
      supplier: { full_name: "Toko Beras" },
      batch_timeline: batchTimeline,
    },
  };
}

function mockViewer(statuses: readonly string[] = FIXTURES, timelineFor: (status: string) => Record<string, string> | null = () => null) {
  const rows = statuses.map((status, index) => orderRow(index + 1, status, timelineFor(status)));

  mockResolveActiveUmkm.mockResolvedValue({
    client: {
      from: () => ({ select: () => ({ eq: async () => ({ data: rows, error: null }) }) }),
      rpc: async () => ({ data: null, error: null }),
    },
    context: { userId: USER_ID, role: "umkm", status: "active" },
    response: null,
  } as never);
}

async function load(query: string): Promise<FullBody> {
  const response = await GET(new Request(`http://localhost/api/umkm/orders?${query}`));
  expect(response.status).toBe(200);
  return (await response.json()) as FullBody;
}

describe("GET /api/umkm/orders global counts and summary", () => {
  beforeEach(() => {
    mockResolveActiveUmkm.mockReset();
    mockViewer();
  });

  it("counts every order regardless of the page window", async () => {
    const firstPage = await load("status=all&limit=2");
    const secondPage = await load("status=all&limit=2&cursor=2");
    const lastPage = await load("status=all&limit=50");

    expect(firstPage.orders).toHaveLength(2);
    expect(secondPage.orders).toHaveLength(2);
    expect(lastPage.orders).toHaveLength(FIXTURES.length);

    // The header is identical on every page; only `orders` moves.
    expect(firstPage.counts).toEqual(lastPage.counts);
    expect(secondPage.counts).toEqual(lastPage.counts);
    expect(firstPage.summary).toEqual(lastPage.summary);
  });

  it("counts every order regardless of the status filter", async () => {
    const all = await load("status=all&limit=50");
    const cancelledOnly = await load("status=cancelled&limit=50");
    const paidOnly = await load("status=paid&limit=50");

    expect(cancelledOnly.orders).toHaveLength(1);
    expect(paidOnly.orders).toHaveLength(2);

    // A narrowed filter narrows the rows, never the header.
    expect(cancelledOnly.counts).toEqual(all.counts);
    expect(paidOnly.counts).toEqual(all.counts);
    expect(cancelledOnly.summary).toEqual(all.summary);
  });

  it("maps each status to its documented count bucket", async () => {
    const { counts } = await load("status=all&limit=50");

    expect(counts).toMatchObject({
      all: 10,
      registered: 1,
      pending_payment: 1,
      paid: 2,
      // `completed` is a picked-up order as far as the count is concerned.
      picked_up: 2,
      cancelled: 1,
      no_show: 1,
      // `refund_pending` and `refunded` share the refund bucket.
      refund: 2,
    });
  });

  it("summarises the same set the counts describe", async () => {
    const { summary } = await load("status=all&limit=50");

    expect(summary).toEqual({
      total: 10,
      pendingPayment: 1,
      // Both paid orders qualify: a `paid` row is always in one of the two
      // ready phases, and `paidReady` is scoped to the phase rather than the
      // status so a not-yet-ready batch still shows as paid.
      paidReady: 2,
      pickedUp: 2,
      refund: 2,
    });
  });

  it("counts by status even when the derived phase says otherwise", async () => {
    // Every order sits on a batch whose payment window and ready date are long
    // past, so the derived phase disagrees with the stored status: both
    // `pending_payment` and `registered` derive `payment_expired`, and `paid`
    // derives `ready_for_pickup`.
    const expired = {
      registration_opens_at: "2026-01-01T00:00:00Z",
      registration_closes_at: "2026-01-01T00:00:00Z",
      payment_opens_at: "2026-01-01T00:00:00Z",
      payment_closes_at: "2026-01-02T00:00:00Z",
      estimated_ready_at: "2026-01-03T00:00:00Z",
    };
    mockViewer(["pending_payment", "paid", "registered"], () => expired);

    const { orders, counts, summary } = await load("status=all&limit=50");
    const phases = (orders as { phase: string }[]).map((order) => order.phase);

    expect(phases).toContain("payment_expired");
    expect(phases).toContain("ready_for_pickup");

    // The bucket the client filters on is the stored status, so an expired
    // payment window must not quietly move an order out of its count.
    expect(counts.pending_payment).toBe(1);
    expect(counts.paid).toBe(1);
    expect(counts.registered).toBe(1);
    expect(summary.pendingPayment).toBe(1);
    expect(summary.paidReady).toBe(1);
  });

  it("keeps a paid order that is not ready yet out of a status-blind count change", async () => {
    // The mirror case: a `paid` order on a batch that is not ready yet derives
    // `paid_waiting_ready`, and still reports as paid.
    mockViewer(["paid"], () => ({
      registration_opens_at: "2026-01-01T00:00:00Z",
      registration_closes_at: "2026-01-01T00:00:00Z",
      payment_opens_at: "2026-01-01T00:00:00Z",
      payment_closes_at: "2026-01-02T00:00:00Z",
      estimated_ready_at: "2999-01-01T00:00:00Z",
    }));

    const { orders, counts, summary } = await load("status=all&limit=50");

    expect((orders as { phase: string }[])[0].phase).toBe("paid_waiting_ready");
    expect(counts.paid).toBe(1);
    expect(summary.paidReady).toBe(1);
  });

  it("keeps `orders` and `items` as the same filtered page", async () => {
    const body = await load("status=paid&limit=1");

    expect(body.items).toEqual(body.orders);
    expect(body.orders).toHaveLength(1);
    expect(body.nextCursor).toBe("1");
    expect(body.counts.paid).toBe(2);
  });

  it("reports no next cursor on the last page while keeping the header", async () => {
    const body = await load("status=all&limit=50");

    expect(body.nextCursor).toBeNull();
    expect(body.counts.all).toBe(FIXTURES.length);
  });

  it("still carries the response envelope the client depends on", async () => {
    const body = await load("status=all&limit=50");

    expect(Object.keys(body).sort()).toEqual(["counts", "items", "nextCursor", "orders", "serverTime", "summary"]);
    expect(Date.parse(body.serverTime)).not.toBeNaN();
  });

  it("omits counts and summary when no query string asks for them", async () => {
    const response = await GET(new Request("http://localhost/api/umkm/orders"));
    const body = (await response.json()) as Record<string, unknown>;

    expect(Object.keys(body)).toEqual(["orders"]);
  });
});
