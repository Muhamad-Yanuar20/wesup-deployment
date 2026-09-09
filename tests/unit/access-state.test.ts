import { describe, expect, it, vi } from "vitest";
import {
  AuthError,
  getViewerAccessState,
  requireApprovedSupplier,
  requireCompleteUmkmProfile,
  requirePageRole,
  resolveHomePath,
  sanitizeReturnTo,
  type AccessStateClient,
  type UserAccessState,
} from "@/lib/auth/access-state";

function fakeClient(options: {
  user?: { id: string } | null;
  profile?: { role: UserAccessState["role"]; status: UserAccessState["status"] } | null;
  supplier?: { verification_status: "pending" | "approved" | "rejected" } | null;
  umkm?: { user_id: string; business_name?: string | null; address?: string | null; latitude?: number | string | null; longitude?: number | string | null } | null;
}): AccessStateClient {
  const getUser = vi.fn(async () => ({
    data: { user: options.user ?? null },
    error: null,
  }));
  const from = vi.fn((table: string) => ({
    select: vi.fn(() => ({
      eq: vi.fn(() => ({
        single: vi.fn(async () => ({ data: options.profile ?? null, error: null })),
        maybeSingle: vi.fn(async () => ({
          data: table === "supplier_profiles" ? options.supplier ?? null : options.umkm ?? null,
          error: null,
        })),
      })),
    })),
  }));
  return { auth: { getUser }, from } as unknown as AccessStateClient;
}

describe("resolveHomePath", () => {
  it("routes every active role to its canonical home", () => {
    expect(resolveHomePath({ role: "umkm", status: "active", profileComplete: false })).toBe("/umkm");
    expect(resolveHomePath({ role: "umkm", status: "active", profileComplete: true })).toBe("/umkm");
    expect(resolveHomePath({ role: "supplier", status: "active", verificationStatus: "pending" })).toBe("/supplier/status");
    expect(resolveHomePath({ role: "supplier", status: "active", verificationStatus: "rejected" })).toBe("/supplier/status");
    expect(resolveHomePath({ role: "supplier", status: "active", verificationStatus: "approved" })).toBe("/supplier");
    expect(resolveHomePath({ role: "admin", status: "active" })).toBe("/admin");
  });

  it("never sends inactive accounts into protected areas", () => {
    expect(resolveHomePath({ role: "umkm", status: "banned", profileComplete: true })).toBe("/login");
    expect(resolveHomePath({ role: "supplier", status: "suspended_temporary", verificationStatus: "approved" })).toBe("/login");
    expect(resolveHomePath({ role: "admin", status: "suspended_permanent" })).toBe("/login");
  });
});

describe("sanitizeReturnTo", () => {
  it("keeps public paths and the matching role area", () => {
    expect(sanitizeReturnTo("/marketplace/batch-1", "umkm")).toBe("/marketplace/batch-1");
    expect(sanitizeReturnTo("/supplier/status", "supplier")).toBe("/supplier/status");
    expect(sanitizeReturnTo("/umkm/pesanan", "umkm")).toBe("/umkm/pesanan");
    expect(sanitizeReturnTo("/admin", "admin")).toBe("/admin");
  });

  it("rejects external, protocol-relative, API, and cross-role paths", () => {
    for (const value of [
      "https://evil.example/steal",
      "//evil.example/steal",
      "/\\\\evil.example",
      "/api/auth/session",
      "/admin",
      "/supplier",
    ]) {
      expect(sanitizeReturnTo(value, "umkm")).toBeNull();
    }
  });
});

describe("getViewerAccessState", () => {
  it("returns UMKM completeness from its own profile row", async () => {
    const client = fakeClient({
      user: { id: "umkm-1" },
      profile: { role: "umkm", status: "active" },
      umkm: { user_id: "umkm-1", business_name: "Warung Budi", address: "Jl. Asia Afrika", latitude: -6.914744, longitude: 107.60981 },
    });
    await expect(getViewerAccessState(client)).resolves.toEqual({
      role: "umkm",
      status: "active",
      profileComplete: true,
    });
  });

  it("returns supplier verification without treating pending as approved", async () => {
    const client = fakeClient({
      user: { id: "supplier-1" },
      profile: { role: "supplier", status: "active" },
      supplier: { verification_status: "pending" },
    });
    await expect(getViewerAccessState(client)).resolves.toEqual({
      role: "supplier",
      status: "active",
      verificationStatus: "pending",
    });
  });

  it("returns null for a guest", async () => {
    await expect(getViewerAccessState(fakeClient({ user: null }))).resolves.toBeNull();
  });
});

describe("authorization helpers", () => {
  it("requires the requested page role", async () => {
    const client = fakeClient({
      user: { id: "umkm-1" },
      profile: { role: "umkm", status: "active" },
    });
    await expect(requirePageRole("supplier", client)).rejects.toMatchObject({ status: 403 });
    await expect(requirePageRole("umkm", client)).resolves.toMatchObject({ role: "umkm" });
  });

  it("blocks incomplete UMKM and unapproved suppliers from protected actions", async () => {
    const incomplete = fakeClient({ user: { id: "u-1" }, profile: { role: "umkm", status: "active" } });
    await expect(requireCompleteUmkmProfile(incomplete)).rejects.toMatchObject({ status: 403 });

    const pending = fakeClient({
      user: { id: "s-1" },
      profile: { role: "supplier", status: "active" },
      supplier: { verification_status: "pending" },
    });
    await expect(requireApprovedSupplier(pending)).rejects.toMatchObject({ status: 403 });
  });

  it("returns a 401 for authorization helpers without a session", async () => {
    const error = await requirePageRole("umkm", fakeClient({ user: null })).catch((value) => value);
    expect(error).toBeInstanceOf(AuthError);
    expect(error.status).toBe(401);
  });
});
