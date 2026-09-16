import { describe, expect, it } from "vitest";
import { openApiDocument } from "@/lib/openapi/document";

const routeMethods = new Map<string, Set<string>>([
  ["/api/admin/audit-logs", new Set(["get"])],
  ["/api/admin/batches/{id}/takedown", new Set(["post"])],
  ["/api/admin/disputes/{id}/resolve", new Set(["post"])],
  ["/api/admin/refunds", new Set(["get"])],
  ["/api/admin/refunds/{id}/approve", new Set(["post"])],
  ["/api/admin/refunds/{id}/complete", new Set(["post"])],
  ["/api/admin/supplier-payouts/{payoutId}", new Set(["patch"])],
  ["/api/admin/suppliers/{id}/approve", new Set(["post"])],
  ["/api/admin/suppliers/{id}/reject", new Set(["post"])],
  ["/api/admin/users/{id}/ban", new Set(["post"])],
  ["/api/admin/users/{id}/suspend", new Set(["post"])],
  ["/api/admin/users/{id}/unban", new Set(["post"])],
  ["/api/auth/forgot-password", new Set(["post"])],
  ["/api/auth/login", new Set(["post"])],
  ["/api/auth/logout", new Set(["post"])],
  ["/api/auth/reset-password", new Set(["post"])],
  ["/api/auth/session", new Set(["get"])],
  ["/api/auth/signup", new Set(["post"])],
  ["/api/batches/{id}/cutoff", new Set(["post"])],
  ["/api/batches/{id}/progress", new Set(["get"])],
  ["/api/marketplace/search", new Set(["get"])],
  ["/api/marketplace/{id}", new Set(["get"])],
  ["/api/marketplace/{id}/route", new Set(["get"])],
  ["/api/pickups/{registrationId}/code", new Set(["post"])],
  ["/api/pickups/{registrationId}/confirm", new Set(["post"])],
  ["/api/registrations", new Set(["post"])],
  ["/api/suppliers/batches", new Set(["get", "post"])],
  ["/api/suppliers/batches/{id}", new Set(["get", "patch", "delete"])],
  ["/api/suppliers/batches/{id}/cancel", new Set(["post"])],
  ["/api/suppliers/batches/{id}/close", new Set(["post"])],
  ["/api/suppliers/batches/{id}/orders", new Set(["get"])],
  ["/api/suppliers/batches/{id}/ready", new Set(["post"])],
  ["/api/suppliers/batches/{id}/transactions", new Set(["get"])],
  ["/api/suppliers/dashboard", new Set(["get"])],
  ["/api/suppliers/finance", new Set(["get"])],
  ["/api/suppliers/finance/bank-account", new Set(["put"])],
  ["/api/suppliers/finance/payouts", new Set(["post"])],
  ["/api/suppliers/notifications", new Set(["get", "patch"])],
  ["/api/suppliers/register", new Set(["post"])],
  ["/api/umkm/dashboard", new Set(["get"])],
  ["/api/umkm/notifications", new Set(["get", "patch"])],
  ["/api/umkm/orders", new Set(["get"])],
  ["/api/umkm/orders/{orderId}", new Set(["get"])],
  ["/api/umkm/orders/{orderId}/complaints", new Set(["post"])],
  ["/api/umkm/orders/{orderId}/payment/charge", new Set(["post"])],
  ["/api/umkm/orders/{orderId}/payment/reconcile", new Set(["post"])],
  ["/api/umkm/orders/{orderId}/ratings", new Set(["post"])],
  ["/api/umkm/orders/{orderId}/refund-account", new Set(["put"])],
  ["/api/umkm/profile", new Set(["get", "put"])],
  ["/api/webhook/midtrans", new Set(["post"])],
]);

describe("OpenAPI document", () => {
  it("uses OpenAPI 3 and documents every current API operation", () => {
    expect(openApiDocument.openapi).toBe("3.0.3");
    expect(openApiDocument.info.title).toContain("Wesup");
    expect(openApiDocument.components?.securitySchemes).toHaveProperty("supabaseCookie");

    for (const [path, methods] of routeMethods) {
      expect(openApiDocument.paths[path], path).toBeDefined();
      for (const method of methods) {
        expect(openApiDocument.paths[path]?.[method as keyof typeof openApiDocument.paths[string]], `${method} ${path}`).toBeDefined();
      }
    }
  });

  it("contains no documentation operation without a tag or response", () => {
    for (const [path, item] of Object.entries(openApiDocument.paths)) {
      for (const [method, operation] of Object.entries(item ?? {})) {
        if (!["get", "post", "put", "patch", "delete", "options", "head", "trace"].includes(method)) continue;
        const documented = operation as { tags?: string[]; responses?: unknown };
        expect(documented.tags?.length, `${method} ${path} tags`).toBeGreaterThan(0);
        expect(documented.responses, `${method} ${path} responses`).toBeDefined();
      }
    }
  });
});
