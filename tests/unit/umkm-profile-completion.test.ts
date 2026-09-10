import { describe, expect, it } from "vitest";
import { hasValidUmkmLocation, isCompleteUmkmProfile } from "@/lib/umkm/profile-completion";

const LOCATION = { latitude: -6.914744, longitude: 107.60981 };

describe("UMKM profile completion", () => {
  it("requires business name, address, and a serviceable location", () => {
    expect(isCompleteUmkmProfile({ ...LOCATION })).toBe(false);
    expect(isCompleteUmkmProfile({ ...LOCATION, business_name: "Warung Budi" })).toBe(false);
    expect(isCompleteUmkmProfile({ ...LOCATION, business_name: "Warung Budi", address: "Jl. Asia Afrika" })).toBe(true);
  });

  it("recognizes a valid location on a partial profile", () => {
    expect(hasValidUmkmLocation({ ...LOCATION })).toBe(true);
    expect(hasValidUmkmLocation({ latitude: -8, longitude: 107 })).toBe(false);
  });

  it("accepts camelCase values from API clients", () => {
    expect(isCompleteUmkmProfile({ latitude: String(LOCATION.latitude), longitude: String(LOCATION.longitude), businessName: "Toko Sari", address: "Bandung" })).toBe(true);
  });
});
