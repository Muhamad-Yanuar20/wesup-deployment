import { describe, expect, it } from "vitest";
import { getSupplierStatusView } from "@/lib/supplier-registration/status";

describe("getSupplierStatusView", () => {
  it("explains that pending suppliers are read-only while verification runs", () => {
    expect(getSupplierStatusView("pending", null)).toMatchObject({
      tone: "pending",
      title: "Pendaftaran sedang diverifikasi",
    });
    expect(getSupplierStatusView("pending", null).readOnly).toBe(true);
  });

  it("shows a safe rejection reason when Admin provided one", () => {
    expect(getSupplierStatusView("rejected", "Foto usaha kurang jelas")).toMatchObject({
      tone: "rejected",
      title: "Pendaftaran belum disetujui",
      reason: "Foto usaha kurang jelas",
      readOnly: true,
    });
  });

  it("directs approved suppliers to the operational dashboard", () => {
    expect(getSupplierStatusView("approved", null)).toMatchObject({
      tone: "approved",
      title: "Supplier disetujui",
      readOnly: false,
      nextPath: "/supplier",
    });
  });
});
