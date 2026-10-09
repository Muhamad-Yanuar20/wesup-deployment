// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { Features } from "@/components/landing/sections/Features";
import { formatRupiah, lockedTierForKg, TARGET_REGISTERED_KG } from "@/lib/landing";

const ROWS = ["Harga berjenjang", "Jaminan pembayaran", "Pengiriman", "Cakupan"] as const;

describe("Features spec sheet", () => {
  it("is one bordered spec sheet, not a card grid", () => {
    const { container } = render(<Features />);

    const sheet = container.querySelector("#features .divide-y");
    expect(sheet).not.toBeNull();
    const valueColumn = container.querySelector(
      "#features .grid-cols-2 .border-l",
    );
    expect(valueColumn).not.toBeNull();
  });

  it("publishes the four guarantees as label/value rows", () => {
    render(<Features />);

    for (const label of ROWS) {
      expect(screen.getByText(label)).toBeInTheDocument();
    }
    expect(screen.getByText("Escrow 24 jam")).toBeInTheDocument();
    expect(screen.getByText("Self-pickup, tanpa ongkir last-mile")).toBeInTheDocument();
    expect(screen.getByText("Bandung")).toBeInTheDocument();
  });

  it("prints the actually-locked tier price as a live value, not copy", () => {
    render(<Features />);

    const tier = lockedTierForKg(TARGET_REGISTERED_KG);
    expect(screen.getByText(formatRupiah(tier.unitPrice))).toBeInTheDocument();
    expect(screen.getByText("/kg")).toBeInTheDocument();
    expect(screen.getByText(tier.label)).toBeInTheDocument();
  });
});