import { beforeEach, describe, expect, it, vi } from "vitest";
import { resolveActiveUmkm } from "@/lib/umkm/workspace-auth";
import { GET } from "@/app/api/umkm/orders/route";
import type { UmkmOrderListItem } from "@/lib/orders/api-types";

vi.mock("@/lib/supabase/server", () => ({ getServerClient: vi.fn() }));
vi.mock("@/lib/umkm/workspace-auth", () => ({ resolveActiveUmkm: vi.fn() }));

const mockResolveActiveUmkm = vi.mocked(resolveActiveUmkm);

const USER_ID = "11111111-1111-4111-8111-111111111111";

interface RoundTripCounts {
  from: number;
  rpc: number;
  rpcNames: string[];
  selectColumns: string[];
}

function orderRow(index: number) {
  return {
    id: `00000000-0000-4000-8000-${String(index).padStart(12, "0")}`,
    batch_id: `10000000-0000-4000-8000-${String(index).padStart(12, "0")}`,
    quantity: 5,
    status: "registered",
    final_amount: 25000,
    locked_tier_number: null,
    created_at: new Date(Date.UTC(2026, 0, 1, 0, index % 60)).toISOString(),
    batch: { id: "batch", title: "Beras 5kg", status: "published", unit: "sack", supplier: { full_name: "Toko Beras" }, batch_timeline: null },
  };
}

/**
 * Minimal stand-in for the PostgREST query builder that the orders route
 * actually uses, instrumented to count database round-trips.
 */
function countingClient(rows: ReturnType<typeof orderRow>[], counts: RoundTripCounts) {
  const query = () => ({
    select: (columns: string) => {
      counts.selectColumns.push(columns);
      return {
        eq: async () => ({ data: rows, error: null }),
      };
    },
  });

  return {
    from: (table: string) => {
      counts.from += 1;
      if (table !== "registrations") throw new Error(`unexpected table read: ${table}`);
      return query();
    },
    rpc: async (name: string) => {
      counts.rpc += 1;
      counts.rpcNames.push(name);
      return { data: null, error: null };
    },
  };
}

async function measure(rowCount: number) {
  const counts: RoundTripCounts = { from: 0, rpc: 0, rpcNames: [], selectColumns: [] };
  const rows = Array.from({ length: rowCount }, (_, index) => orderRow(index + 1));

  mockResolveActiveUmkm.mockResolvedValue({
    client: countingClient(rows, counts),
    context: { userId: USER_ID, role: "umkm", status: "active" },
    response: null,
  } as never);

  const response = await GET(new Request("http://localhost/api/umkm/orders?limit=20&status=all"));
  return { counts, response };
}

describe("GET /api/umkm/orders round-trip budget", () => {
  beforeEach(() => {
    mockResolveActiveUmkm.mockReset();
  });

  it("issues a constant number of database round-trips regardless of order count", async () => {
    const small = await measure(1);
    const large = await measure(25);

    const total = (c: RoundTripCounts) => c.from + c.rpc;

    // The lazy lifecycle reconciliation must batch into a single call, so the
    // cost of listing orders may not grow with the number of orders.
    expect(total(large.counts)).toBe(total(small.counts));
  });

  it("never fans out one lifecycle RPC per order", async () => {
    const { counts, response } = await measure(25);

    expect(response.status).toBe(200);
    expect(counts.rpc).toBeLessThanOrEqual(1);
  });

  it("reconciles orders through the batched RPC rather than the per-order one", async () => {
    const { counts } = await measure(25);

    expect(counts.rpcNames).not.toContain("materialize_supplier_order");
    expect(counts.rpcNames).not.toContain("materialize_umkm_order");
  });

  it("keeps the lazy reconciliation best-effort: a failing batch still returns orders", async () => {
    const counts: RoundTripCounts = { from: 0, rpc: 0, rpcNames: [], selectColumns: [] };
    const rows = Array.from({ length: 3 }, (_, index) => orderRow(index + 1));

    mockResolveActiveUmkm.mockResolvedValue({
      client: {
        from: () => {
          counts.from += 1;
          return {
            select: () => ({ eq: async () => ({ data: rows, error: null }) }),
          };
        },
        rpc: async () => {
          counts.rpc += 1;
          throw new Error("reconciliation unavailable");
        },
      },
      context: { userId: USER_ID, role: "umkm", status: "active" },
      response: null,
    } as never);

    const response = await GET(new Request("http://localhost/api/umkm/orders?limit=20&status=all"));
    const body = (await response.json()) as { orders: UmkmOrderListItem[] };

    expect(response.status).toBe(200);
    expect(body.orders).toHaveLength(3);
  });
});
