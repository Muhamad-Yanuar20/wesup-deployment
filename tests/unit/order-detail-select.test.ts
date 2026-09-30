import { describe, expect, it } from "vitest";
import { DETAIL_SELECT } from "@/lib/orders/selects";

describe("UMKM detail select", () => {
  it("loads payment attempts through payments", () => {
    expect(DETAIL_SELECT).toContain("payment_attempts(");
    expect(DETAIL_SELECT).not.toContain("payment_attempt:payment_attempts(");
    expect(DETAIL_SELECT).toContain("batch_timeline(");
  });
});