import { BATCH_CATEGORIES } from "@/lib/catalog/categories";
import type { MarketplaceItem } from "./types";

const BANDUNG_SUPPLIER_LOCATIONS: readonly { lat: number; lng: number; address: string }[] = [
  { lat: -6.9175, lng: 107.6191, address: "Jl. Asia Afrika No. 123, Bandung" },
  { lat: -6.8917, lng: 107.6026, address: "Jl. Dago No. 45, Bandung" },
  { lat: -6.9431, lng: 107.6548, address: "Jl. Buah Batu No. 88, Bandung" },
  { lat: -6.8853, lng: 107.6148, address: "Jl. Setiabudhi No. 176, Bandung" },
  { lat: -6.9344, lng: 107.6051, address: "Jl. Cimindi No. 52, Bandung" },
  { lat: -6.9021, lng: 107.5734, address: "Jl. Suryamantri No. 11, Bandung" },
  { lat: -6.9521, lng: 107.6289, address: "Jl. Karangarum No. 7, Bandung" },
  { lat: -6.8782, lng: 107.5932, address: "Jl. Padalarang No. 34, Bandung" },
  { lat: -6.9612, lng: 107.6345, address: "Jl. Cibiru No. 19, Bandung" },
  { lat: -6.9289, lng: 107.5812, address: "Jl. Cipedes No. 8, Bandung" },
];

export const marketplaceMockItems: MarketplaceItem[] = Array.from({ length: 30 }, (_, index) => {
  const number = index + 1;
  const category = BATCH_CATEGORIES[index % BATCH_CATEGORIES.length];
  const basePrice = 25_000 + index * 2_500;
  const location = BANDUNG_SUPPLIER_LOCATIONS[index % BANDUNG_SUPPLIER_LOCATIONS.length];
  return {
    id: `marketplace-${String(number).padStart(2, "0")}`,
    slug: `bandung-${category.toLocaleLowerCase("id-ID").replaceAll(" ", "-")}-${number}`,
    title: `${category} Bandung ${number}`,
    supplierName: `Mitra UMKM Bandung ${number}`,
    category,
    imageUrl: "/file.svg",
    distanceKm: number,
    estimatedPickupMinutes: 10 + number,
    basePrice,
    currentTierPrice: basePrice - 2_000,
    registeredQuantity: number * 3,
    targetQuantity: number * 10,
    status: "ACTIVE",
    registrationClosesAt: `2026-09-${String((number % 28) + 1).padStart(2, "0")}T10:00:00.000Z`,
    pickupLatitude: location.lat + (index * 0.002),
    pickupLongitude: location.lng + (index * 0.001),
    pickupAddress: location.address,
    supplierRating: {
      average: 3 + (index % 4) * 0.5,
      total: 5 + number * 2,
    },
  };
});
