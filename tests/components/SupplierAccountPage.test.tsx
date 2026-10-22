// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { beforeEach, expect, it, vi } from "vitest";
import AccountPage from "@/app/supplier/akun/page";
const mock = vi.hoisted(() => ({ failed: false, eq: vi.fn() }));
vi.mock("@/components/layout/Layout", () => ({ Layout: ({ children }: { children: React.ReactNode }) => <div>{children}</div> }));
vi.mock("@/lib/auth/access-state", () => ({ getViewerAccessState: async () => ({ role: "supplier", status: "active", verificationStatus: "approved" }), resolveHomePath: () => "/supplier" }));
vi.mock("@/lib/supabase/auth", () => ({ getCurrentUser: async () => ({ userId: "owner", email: "owner@example.com" }) }));
vi.mock("@/lib/supabase/server", () => ({ getServerClient: async () => ({ from: (table: string) => ({ select: () => ({ eq: (...args: unknown[]) => { mock.eq(...args); return { single: async () => mock.failed ? { data: null, error: new Error("Offline") } : { error: null, data: table === "profiles" ? { full_name: "Pemilik Toko", phone: null, created_at: "2026-10-01T00:00:00Z" } : { business_name: "Toko Bandung", address: "Bandung", latitude: -6.9, longitude: 107.6, verification_status: "approved", verified_at: null } } }; } }) }) }) }));
beforeEach(() => { mock.failed = false; mock.eq.mockClear(); });
it("shows owned account and business information with empty optional fields", async () => {
  render(await AccountPage()); expect(screen.getByText("Pemilik Toko")).toBeVisible(); expect(screen.getByText("Toko Bandung")).toBeVisible(); expect(screen.getByText("owner@example.com")).toBeVisible(); expect(screen.getAllByText("Belum diisi")).toHaveLength(2);
  expect(mock.eq).toHaveBeenCalledWith("user_id", "owner"); expect(mock.eq).toHaveBeenCalledWith("id", "owner"); expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
});
it("shows a retry instead of misleading empty or successful data when reads fail", async () => {
  mock.failed = true; render(await AccountPage()); expect(screen.getByRole("alert")).toHaveTextContent("belum dapat dimuat"); expect(screen.getByRole("button", { name: "Muat ulang akun" })).toBeVisible(); expect(screen.queryByText("Aktif")).not.toBeInTheDocument();
});
