vi.mock("server-only", () => ({}));

import { afterEach, describe, expect, it, vi } from "vitest";
import { GET } from "@/app/docs/openapi.json/route";

const originalUsername = process.env.SWAGGER_USERNAME;
const originalPassword = process.env.SWAGGER_PASSWORD;

afterEach(() => {
  if (originalUsername === undefined) delete process.env.SWAGGER_USERNAME;
  else process.env.SWAGGER_USERNAME = originalUsername;
  if (originalPassword === undefined) delete process.env.SWAGGER_PASSWORD;
  else process.env.SWAGGER_PASSWORD = originalPassword;
});

describe("GET /docs/openapi.json", () => {
  it("requires Basic Authentication and does not expose the document anonymously", async () => {
    process.env.SWAGGER_USERNAME = "admin";
    process.env.SWAGGER_PASSWORD = "12345678";

    const response = await GET(new Request("http://localhost/docs/openapi.json"));

    expect(response.status).toBe(401);
    expect(response.headers.get("www-authenticate")).toContain("Basic");
  });

  it("returns the OpenAPI document with private no-store caching", async () => {
    process.env.SWAGGER_USERNAME = "admin";
    process.env.SWAGGER_PASSWORD = "12345678";
    const authorization = `Basic ${Buffer.from("admin:12345678", "utf8").toString("base64")}`;

    const response = await GET(new Request("http://localhost/docs/openapi.json", { headers: { authorization } }));
    const document = await response.json();

    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toContain("no-store");
    expect(document.openapi).toBe("3.0.3");
    expect(document.paths["/api/umkm/orders/{orderId}/payment/charge"]).toBeDefined();
  });
});
