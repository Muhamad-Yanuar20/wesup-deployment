vi.mock("server-only", () => ({}));

import { afterEach, describe, expect, it, vi } from "vitest";
import {
  authorizeDocsRequest,
  isDocsPath,
} from "@/lib/docs/basic-auth";

const originalUsername = process.env.SWAGGER_USERNAME;
const originalPassword = process.env.SWAGGER_PASSWORD;

afterEach(() => {
  if (originalUsername === undefined) delete process.env.SWAGGER_USERNAME;
  else process.env.SWAGGER_USERNAME = originalUsername;
  if (originalPassword === undefined) delete process.env.SWAGGER_PASSWORD;
  else process.env.SWAGGER_PASSWORD = originalPassword;
});

function request(path = "/docs", authorization?: string): Request {
  return new Request(`http://localhost${path}`, {
    headers: authorization ? { authorization } : undefined,
  });
}

describe("Swagger docs Basic Authentication", () => {
  it("recognizes the docs page and protected spec paths", () => {
    expect(isDocsPath("/docs")).toBe(true);
    expect(isDocsPath("/docs/")).toBe(true);
    expect(isDocsPath("/docs/openapi.json")).toBe(true);
    expect(isDocsPath("/api/docs/openapi.json")).toBe(false);
    expect(isDocsPath("/documentation")).toBe(false);
  });

  it("fails closed when documentation credentials are missing", async () => {
    delete process.env.SWAGGER_USERNAME;
    delete process.env.SWAGGER_PASSWORD;

    const response = authorizeDocsRequest(request());

    expect(response).not.toBeNull();
    expect(response?.status).toBe(503);
    expect(await response?.json()).toMatchObject({
      code: "SWAGGER_AUTH_NOT_CONFIGURED",
    });
  });

  it("returns a Basic challenge for missing or invalid credentials", async () => {
    process.env.SWAGGER_USERNAME = "admin";
    process.env.SWAGGER_PASSWORD = "12345678";

    const missing = authorizeDocsRequest(request());
    expect(missing?.status).toBe(401);
    expect(missing?.headers.get("WWW-Authenticate")).toContain("Basic");

    const invalid = authorizeDocsRequest(request("/docs", "Basic YWRtaW46d3Jvbmc="));
    expect(invalid?.status).toBe(401);
    expect(await invalid?.json()).toMatchObject({ code: "SWAGGER_AUTH_INVALID" });
  });

  it("accepts configured credentials without exposing them in the response", async () => {
    process.env.SWAGGER_USERNAME = "admin";
    process.env.SWAGGER_PASSWORD = "12345678";
    const encoded = Buffer.from("admin:12345678", "utf8").toString("base64");

    expect(authorizeDocsRequest(request("/docs/openapi.json", `Basic ${encoded}`))).toBeNull();
  });
});
