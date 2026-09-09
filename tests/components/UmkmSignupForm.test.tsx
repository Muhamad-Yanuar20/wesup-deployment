// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import UmkmSignupForm from "@/components/auth/UmkmSignupForm";
import { renderComponent as render } from "./test-utils";

describe("UmkmSignupForm", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
  });

  it("shows all required fields and client validation errors", async () => {
    const user = userEvent.setup();
    render(<UmkmSignupForm />);

    expect(screen.getByLabelText(/nama lengkap/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/nomor whatsapp/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/^email$/i)).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /buat akun umkm/i }));

    expect(screen.getAllByRole("alert")[0]).toBeInTheDocument();
    expect(fetch).not.toHaveBeenCalled();
  });

  it("submits the basic UMKM profile without a browser role", async () => {
    const user = userEvent.setup();
    vi.mocked(fetch).mockResolvedValue(
      new Response(JSON.stringify({ user: { id: "u-1" }, requiresEmailConfirmation: false }), { status: 201 }),
    );
    render(<UmkmSignupForm />);

    await user.type(screen.getByLabelText(/nama lengkap/i), "Budi Buyer");
    await user.type(screen.getByLabelText(/nomor whatsapp/i), "081234567890");
    await user.type(screen.getByLabelText(/^email$/i), "budi@example.com");
    await user.type(screen.getByLabelText(/^password$/i), "password123");
    await user.type(screen.getByLabelText("Konfirmasi password", { exact: true }), "password123");
    await user.click(screen.getByRole("button", { name: /buat akun umkm/i }));

    expect(fetch).toHaveBeenCalledWith("/api/auth/signup", expect.objectContaining({
      method: "POST",
      body: JSON.stringify({
        full_name: "Budi Buyer",
        phone: "081234567890",
        email: "budi@example.com",
        password: "password123",
      }),
    }));
    expect(JSON.parse(vi.mocked(fetch).mock.calls[0]?.[1]?.body as string)).not.toHaveProperty("role");
  });

  it("explains the email confirmation state", async () => {
    const user = userEvent.setup();
    vi.mocked(fetch).mockResolvedValue(
      new Response(JSON.stringify({ user: { id: "u-2" }, requiresEmailConfirmation: true }), { status: 201 }),
    );
    render(<UmkmSignupForm />);

    await user.type(screen.getByLabelText(/nama lengkap/i), "Sari");
    await user.type(screen.getByLabelText(/nomor whatsapp/i), "081234567890");
    await user.type(screen.getByLabelText(/^email$/i), "sari@example.com");
    await user.type(screen.getByLabelText(/^password$/i), "password123");
    await user.type(screen.getByLabelText("Konfirmasi password", { exact: true }), "password123");
    await user.click(screen.getByRole("button", { name: /buat akun umkm/i }));

    expect(await screen.findByRole("heading", { name: /cek email/i })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /ke halaman masuk/i })).toHaveAttribute("href", "/login?role=umkm");
  });
});
