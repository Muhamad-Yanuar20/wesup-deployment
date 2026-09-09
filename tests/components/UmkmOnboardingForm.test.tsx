// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import UmkmOnboardingForm from "@/components/umkm/UmkmOnboardingForm";
import { renderComponent as render } from "./test-utils";

describe("UmkmOnboardingForm", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      if (String(input).endsWith("/api/umkm/profile") && !init) {
        return new Response(JSON.stringify({ profile: null }), { status: 200 });
      }
      return new Response(JSON.stringify({ profile: {} }), { status: 200 });
    }));
  });

  it("shows required business and map pin fields", () => {
    render(<UmkmOnboardingForm returnTo="/marketplace/batch-1" />);

    expect(screen.getByLabelText(/nama usaha/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/alamat usaha/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/latitude/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/longitude/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /simpan profil usaha/i })).toBeInTheDocument();
  });

  it("loads an existing profile and sends a normalized update", async () => {
    const user = userEvent.setup();
    const fetchMock = vi.mocked(fetch);
    fetchMock.mockImplementation(async (input: RequestInfo | URL, init?: RequestInit) => {
      if (!init) {
        return new Response(JSON.stringify({
          profile: {
            businessName: "Warung Lama",
            address: "Jl. Braga",
            latitude: -6.914744,
            longitude: 107.60981,
          },
        }), { status: 200 });
      }
      return new Response(JSON.stringify({ profile: {} }), { status: 200 });
    });
    render(<UmkmOnboardingForm returnTo="/marketplace/batch-1" />);

    expect(await screen.findByDisplayValue("Warung Lama")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /simpan profil usaha/i }));

    const putCall = fetchMock.mock.calls.find(([, init]) => init?.method === "PUT");
    expect(putCall).toBeTruthy();
    expect(JSON.parse(putCall?.[1]?.body as string)).toEqual({
      businessName: "Warung Lama",
      address: "Jl. Braga",
      latitude: -6.914744,
      longitude: 107.60981,
    });
    expect(await screen.findByRole("status")).toHaveTextContent(/tersimpan/i);
  });

  it("shows validation errors without submitting incomplete data", async () => {
    const user = userEvent.setup();
    const fetchMock = vi.mocked(fetch);
    render(<UmkmOnboardingForm />);
    await user.click(screen.getByRole("button", { name: /simpan profil usaha/i }));

    expect(screen.getAllByRole("alert").length).toBeGreaterThan(0);
    expect(fetchMock.mock.calls.some(([, init]) => init?.method === "PUT")).toBe(false);
  });
});
