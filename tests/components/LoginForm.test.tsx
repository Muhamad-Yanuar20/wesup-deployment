// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";
import { screen } from "@testing-library/react";
import LoginForm from "@/components/auth/LoginForm";
import { renderComponent as render } from "./test-utils";

describe("LoginForm", () => {
  it("shows only UMKM and Supplier in the public login selector", () => {
    render(<LoginForm />);

    expect(screen.getByRole("radio", { name: /umkm/i })).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: /supplier/i })).toBeInTheDocument();
    expect(screen.queryByRole("radio", { name: /admin/i })).not.toBeInTheDocument();
  });

  it("hides role selection on the dedicated Admin login", () => {
    render(<LoginForm fixedRole="admin" />);

    expect(screen.getByText("Login Admin")).toBeInTheDocument();
    expect(screen.queryByRole("radio")).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: /login umkm\/supplier/i })).toHaveAttribute(
      "href",
      "/login",
    );
  });

  it("includes the safe returnTo in the login request", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({
      profile: { role: "umkm" },
      redirectTo: "/marketplace/batch-1",
    }), { status: 200 })));
    const user = (await import("@testing-library/user-event")).default.setup();
    render(<LoginForm returnTo="/marketplace/batch-1" />);
    await user.type(screen.getByLabelText(/email/i), "budi@example.com");
    await user.type(screen.getByLabelText("Password", { exact: true }), "password123");
    await user.click(screen.getByRole("button", { name: /masuk ke akun/i }));

    expect(fetch).toHaveBeenCalledWith("/api/auth/login", expect.objectContaining({
      body: expect.stringContaining('"returnTo":"/marketplace/batch-1"'),
    }));
  });
});
