import { describe, expect, it } from "vitest";
import { LOGIN_REDIRECT_BY_ROLE, PUBLIC_LOGIN_ROLES } from "@/lib/auth/login-contract";

describe("public login role contract", () => {
  it("only exposes UMKM and Supplier publicly", () => {
    expect(PUBLIC_LOGIN_ROLES).toEqual(["umkm", "supplier"]);
  });

  it("routes Admin to the separate Admin area and UMKM to its dashboard", () => {
    expect(LOGIN_REDIRECT_BY_ROLE.admin).toBe("/admin");
    expect(LOGIN_REDIRECT_BY_ROLE.umkm).toBe("/umkm");
  });
});
