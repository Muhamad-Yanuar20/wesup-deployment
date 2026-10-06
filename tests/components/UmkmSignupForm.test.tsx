// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import UmkmSignupForm from "@/components/auth/UmkmSignupForm";
import { renderComponent as render } from "./test-utils";

vi.mock("@/components/maps/BusinessLocationPickerClient", () => ({
  default: ({ onChange, error }: { onChange: (value: { lat: number; lng: number }) => void; error?: string }) => (
    <div>
      <button type="button" onClick={() => onChange({ lat: -6.914744, lng: 107.60981 })}>Pilih lokasi tes</button>
      {error ? <p role="alert">{error}</p> : null}
    </div>
  ),
}));

describe("UmkmSignupForm", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
  });

  async function fillRequired(user: ReturnType<typeof userEvent.setup>) {
    await user.type(screen.getByLabelText(/nama lengkap/i), "Budi Buyer");
    await user.type(screen.getByLabelText(/nomor whatsapp/i), "081234567890");
    await user.type(screen.getByLabelText(/^email$/i), "budi@example.com");
    await user.type(screen.getByLabelText(/^password$/i), "password123");
    await user.type(screen.getByLabelText("Konfirmasi password", { exact: true }), "password123");
    await user.click(screen.getByRole("button", { name: "Pilih lokasi tes" }));
  }

  it("shows all required fields and validates the location", async () => {
    const user = userEvent.setup();
    render(<UmkmSignupForm />);

    expect(screen.getByLabelText(/nama lengkap/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/nomor whatsapp/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/^email$/i)).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /buat akun umkm/i }));

    expect(screen.getAllByRole("alert").length).toBeGreaterThan(0);
    expect(screen.getByText(/pilih titik lokasi usaha/i)).toBeInTheDocument();
    expect(fetch).not.toHaveBeenCalled();
  });

  it("submits location without a browser role and shows inline success state", async () => {
    const user = userEvent.setup();
    vi.mocked(fetch).mockResolvedValue(new Response(JSON.stringify({ ok: true, requiresEmailConfirmation: false }), { status: 201 }));
    render(<UmkmSignupForm returnTo="/marketplace/batch-1" />);

    await fillRequired(user);
    await user.click(screen.getByRole("button", { name: /buat akun umkm/i }));

    await waitFor(() => expect(screen.getByRole("heading", { name: "Akun UMKM berhasil dibuat." })).toBeInTheDocument());
    const requestBody = JSON.parse(vi.mocked(fetch).mock.calls[0]?.[1]?.body as string) as Record<string, unknown>;
    expect(requestBody).toMatchObject({ full_name: "Budi Buyer", phone: "081234567890", email: "budi@example.com", password: "password123", latitude: -6.914744, longitude: 107.60981 });
    expect(requestBody).not.toHaveProperty("role");
    expect(screen.getByRole("link", { name: "Masuk" })).toHaveAttribute("href", "/login?role=umkm&returnTo=%2Fmarketplace%2Fbatch-1");
  });

  it("explains the email confirmation state in the success state", async () => {
    const user = userEvent.setup();
    vi.mocked(fetch).mockResolvedValue(new Response(JSON.stringify({ ok: true, requiresEmailConfirmation: true }), { status: 201 }));
    render(<UmkmSignupForm />);

    await fillRequired(user);
    await user.click(screen.getByRole("button", { name: /buat akun umkm/i }));

    expect(await screen.findByText(/periksa email/i)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Masuk" })).toHaveAttribute("href", "/login?role=umkm");
    expect(screen.queryByRole("heading", { name: /cek email untuk mengaktifkan akun/i })).not.toBeInTheDocument();
  });
});