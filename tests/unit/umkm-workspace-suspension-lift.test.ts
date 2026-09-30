import { describe, expect, it, vi } from "vitest";
import { resolveActiveUmkm } from "@/lib/umkm/workspace-auth";
import { getServerClient } from "@/lib/supabase/server";

vi.mock("@/lib/supabase/server", () => ({ getServerClient: vi.fn() }));

const mockGetServerClient = vi.mocked(getServerClient);
const RPC_NAME = "lazy_lift_expired_suspension";

function mockClient(options: { statuses: string[]; lift?: boolean }) {
  const queue = [...options.statuses];
  const rpc = vi.fn(async () => ({ data: options.lift ?? false, error: null }));
  const client = {
    auth: {
      getUser: vi.fn(async () => ({
        data: { user: { id: "u-1", email: "budi@example.com" } },
        error: null,
      })),
    },
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          single: vi.fn(async () => ({
            data: { role: "umkm", status: queue.shift() ?? "active", full_name: "Budi" },
            error: null,
          })),
        })),
      })),
    })),
    rpc,
  };
  return { client, rpc };
}

async function run(options: { statuses: string[]; lift?: boolean }) {
  const { client, rpc } = mockClient(options);
  mockGetServerClient.mockResolvedValue(client as never);
  const viewer = await resolveActiveUmkm();
  return { viewer, rpc };
}

describe("resolveActiveUmkm lazy-lifts expired temporary suspensions", () => {
  it("skips the RPC for an active account", async () => {
    const { viewer, rpc } = await run({ statuses: ["active"] });

    expect(rpc).not.toHaveBeenCalled();
    expect(viewer.response).toBeNull();
    expect(viewer.context?.status).toBe("active");
  });

  it("lifts and grants access when the RPC reports the suspension expired", async () => {
    const { viewer, rpc } = await run({
      statuses: ["suspended_temporary", "active"],
      lift: true,
    });

    expect(rpc).toHaveBeenCalledWith(RPC_NAME, { p_user_id: "u-1" });
    expect(viewer.response).toBeNull();
    expect(viewer.context?.status).toBe("active");
  });

  it("denies access while the temporary suspension is still live", async () => {
    const { viewer } = await run({ statuses: ["suspended_temporary"], lift: false });

    expect(viewer.response?.status).toBe(403);
    expect(viewer.context).toBeNull();
  });
});
