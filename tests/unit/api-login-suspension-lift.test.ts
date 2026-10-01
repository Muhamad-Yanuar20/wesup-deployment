import { describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { POST as login } from "@/app/api/auth/login/route";
import { getServerClient } from "@/lib/supabase/server";
import { enforceRateLimit } from "@/lib/rate-limit";

vi.mock("@/lib/supabase/server", () => ({ getServerClient: vi.fn() }));
vi.mock("@/lib/rate-limit", () => ({ enforceRateLimit: vi.fn() }));

const mockGetServerClient = vi.mocked(getServerClient);

const RPC_NAME = "lazy_lift_expired_suspension";

function request() {
  return new NextRequest("http://localhost/api/auth/login", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email: "budi@example.com", password: "rahasia123", role: "umkm" }),
  });
}

/**
 * `statuses` is consumed one entry per getCurrentUser() read, so the second
 * entry models the post-lift profile re-read.
 */
function mockClient(options: {
  statuses: string[];
  lift?: boolean | null;
  liftError?: unknown;
  rpcThrows?: boolean;
}) {
  const statusQueue = [...options.statuses];
  const nextStatus = () => statusQueue.shift() ?? "active";

  const rpc = vi.fn(async () => {
    if (options.rpcThrows) {
      throw new Error("network down");
    }
    if (options.liftError) {
      return { data: null, error: { message: "rpc unavailable" } };
    }
    return { data: options.lift ?? false, error: null };
  });

  const from = vi.fn(() => ({
    select: vi.fn(() => ({
      eq: vi.fn(() => ({
        maybeSingle: vi.fn(async () => ({ data: null, error: null })),
        single: vi.fn(async () => ({
          data: { role: "umkm", status: nextStatus(), full_name: "Budi" },
          error: null,
        })),
      })),
    })),
  }));

  const client = {
    auth: {
      signInWithPassword: vi.fn(async () => ({
        data: { user: { id: "u-1", email: "budi@example.com" } },
        error: null,
      })),
      getUser: vi.fn(async () => ({ data: { user: { id: "u-1", email: "budi@example.com" } }, error: null })),
      signOut: vi.fn(async () => ({ error: null })),
    },
    from,
    rpc,
  };

  return { client, rpc, signOut: client.auth.signOut };
}

async function run(options: {
  statuses: string[];
  lift?: boolean | null;
  liftError?: unknown;
  rpcThrows?: boolean;
}) {
  const { client, rpc, signOut } = mockClient(options);
  mockGetServerClient.mockResolvedValue(client as never);
  vi.mocked(enforceRateLimit).mockResolvedValue(null);
  const response = await login(request());
  return { response, rpc, signOut };
}

describe("login lazy-lifts expired temporary suspensions", () => {
  it("does not call the RPC for an already-active account", async () => {
    const { response, rpc } = await run({ statuses: ["active"] });

    expect(rpc).not.toHaveBeenCalled();
    expect(response.status).toBe(200);
  });

  it("calls the lift RPC with the exact function name and p_user_id", async () => {
    const { rpc } = await run({ statuses: ["suspended_temporary"], lift: false });

    expect(rpc).toHaveBeenCalledTimes(1);
    expect(rpc).toHaveBeenCalledWith(RPC_NAME, { p_user_id: "u-1" });
  });

  it("lets an expired temporary suspension log in once the RPC reports lifted", async () => {
    const { response, signOut } = await run({
      statuses: ["suspended_temporary", "active"],
      lift: true,
    });

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      profile: { role: "umkm", status: "active" },
    });
    expect(signOut).not.toHaveBeenCalled();
  });

  it("still rejects while the temporary suspension is live (RPC is a no-op)", async () => {
    const { response, signOut } = await run({ statuses: ["suspended_temporary"], lift: false });

    expect(response.status).toBe(403);
    expect(await response.json()).toMatchObject({ code: "inactive_account" });
    expect(signOut).toHaveBeenCalled();
  });

  it("fails closed when the lift RPC errors", async () => {
    const { response, signOut } = await run({
      statuses: ["suspended_temporary"],
      liftError: true,
    });

    expect(response.status).toBe(403);
    expect(await response.json()).toMatchObject({ code: "inactive_account" });
    expect(signOut).toHaveBeenCalled();
  });

  it("fails closed when the lift RPC throws", async () => {
    const { response, signOut } = await run({
      statuses: ["suspended_temporary"],
      rpcThrows: true,
    });

    expect(response.status).toBe(403);
    expect(await response.json()).toMatchObject({ code: "inactive_account" });
    expect(signOut).toHaveBeenCalled();
  });

  it("never attempts to lift a permanent suspension", async () => {
    const { response, rpc } = await run({ statuses: ["suspended_permanent"] });

    expect(rpc).not.toHaveBeenCalled();
    expect(response.status).toBe(403);
  });
});
