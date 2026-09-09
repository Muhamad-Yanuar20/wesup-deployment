import { describe, expect, it } from "vitest";
import {
  BANDUNG_SERVICE_CENTER,
  BANDUNG_SERVICE_RADIUS_KM,
} from "@/lib/geo/service-center";
import {
  parseUmkmProfilePayload,
  type UmkmProfilePayload,
} from "@/lib/umkm/profile-contract";

const validPayload: UmkmProfilePayload = {
  businessName: "Warung Rina",
  address: "Jl. Braga No. 10, Bandung",
  latitude: BANDUNG_SERVICE_CENTER.lat,
  longitude: BANDUNG_SERVICE_CENTER.lng,
};

describe("UMKM profile contract", () => {
  it("accepts a complete profile at the Bandung service center", () => {
    expect(parseUmkmProfilePayload(validPayload)).toEqual({
      ok: true,
      value: validPayload,
    });
  });

  it("trims text fields and accepts numeric strings from form controls", () => {
    expect(
      parseUmkmProfilePayload({
        businessName: "  Warung Rina  ",
        address: "  Jl. Braga  ",
        latitude: String(BANDUNG_SERVICE_CENTER.lat),
        longitude: String(BANDUNG_SERVICE_CENTER.lng),
      }),
    ).toEqual({
      ok: true,
      value: {
        businessName: "Warung Rina",
        address: "Jl. Braga",
        latitude: BANDUNG_SERVICE_CENTER.lat,
        longitude: BANDUNG_SERVICE_CENTER.lng,
      },
    });
  });

  it("rejects missing text and malformed coordinates", () => {
    const result = parseUmkmProfilePayload({
      businessName: "",
      address: "Alamat",
      latitude: "not-a-number",
      longitude: 107.6,
    });
    expect(result).toEqual(expect.objectContaining({ ok: false }));
    if (!result.ok) {
      expect(result.fieldErrors.businessName).toBeTruthy();
      expect(result.fieldErrors.coordinate).toBeTruthy();
    }
  });

  it("rejects coordinates outside the 50 km Bandung service radius", () => {
    const result = parseUmkmProfilePayload({
      ...validPayload,
      latitude: -6.2,
    });
    expect(result).toEqual(expect.objectContaining({ ok: false }));
    if (!result.ok) {
      expect(result.fieldErrors.coordinate).toContain(String(BANDUNG_SERVICE_RADIUS_KM));
    }
  });

  it("rejects geographic coordinates outside valid bounds", () => {
    const result = parseUmkmProfilePayload({ ...validPayload, longitude: 181 });
    expect(result).toEqual(expect.objectContaining({ ok: false }));
    if (!result.ok) expect(result.fieldErrors.coordinate).toBeTruthy();
  });
});
