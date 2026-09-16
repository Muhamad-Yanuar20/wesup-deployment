// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest";
import { screen } from "@testing-library/react";
import UmkmOrdersClient from "@/components/umkm/UmkmOrdersClient";
import { renderComponent as render } from "./test-utils";

describe("UMKM orders error state", () => {
  beforeEach(() => vi.stubGlobal("fetch", vi.fn()));

  it("shows the safe retry message and request reference returned by the API", async () => {
    vi.mocked(fetch).mockResolvedValue(new Response(JSON.stringify({
      error: "Daftar pesanan belum dapat dimuat. Coba lagi.",
      code: "ORDERS_READ_FAILED",
      requestId: "req-orders-123",
    }), { status: 503 }));

    render(<UmkmOrdersClient />);

    expect(await screen.findByText(/daftar pesanan belum dapat dimuat/i)).toBeInTheDocument();
    expect(screen.getByText(/referensi: req-orders-123/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /coba lagi/i })).toBeInTheDocument();
  });
});
