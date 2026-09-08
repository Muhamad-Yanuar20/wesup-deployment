import type { BatchCategory } from "@/lib/catalog/categories";

export type MarketplaceItemStatus = "ACTIVE" | "CLOSED" | "CANCELLED_BY_SUPPLIER";

export interface MarketplaceTier {
  tierNumber: number;
  minVolume: number;
  maxVolume: number | null;
  pricePerUnit: number;
}

export interface MarketplaceOrigin {
  latitude: number;
  longitude: number;
  source: "umkm_profile" | "request" | "bandung_default";
}

export interface TierProgress {
  currentTierNumber: number;
  currentPricePerUnit: number;
  nextTierNumber: number | null;
  nextTierMinVolume: number | null;
  remainingToNextTier: number;
  progressPercent: number;
}

export interface MarketplaceItem {
  id: string;
  /** Compatibility field for the static route; dynamic URLs use id. */
  slug?: string;
  title: string;
  supplierName: string;
  category: BatchCategory;
  imageUrl: string;
  distanceKm: number | null;
  estimatedPickupMinutes: number | null;
  basePrice: number;
  currentTierPrice: number;
  registeredQuantity: number;
  targetQuantity: number;
  status: MarketplaceItemStatus;
  registrationClosesAt: string;
  pickupLatitude: number;
  pickupLongitude: number;
  pickupAddress: string;
  tiers?: readonly MarketplaceTier[];
  /** Reputasi supplier berbasis penilaian UMKM (PRD 2.2.6). Absen = belum dinilai. */
  supplierRating?: { average: number; total: number } | null;
}

export interface MarketplaceFilterValue {
  query?: string;
  selectedCategories: readonly BatchCategory[];
  minPrice: number | null;
  maxPrice: number | null;
  radiusKm: number;
}

export interface MarketplaceSearchCriteria extends MarketplaceFilterValue {
  page: number;
  pageSize: 12;
}

export interface MarketplaceSearchResult {
  items: MarketplaceItem[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export interface MarketplaceSearchResponse extends MarketplaceSearchResult {
  origin: MarketplaceOrigin;
}

export type MarketplaceMockScenario = "success" | "empty" | "error";

export interface MarketplaceRepository {
  search(criteria: MarketplaceSearchCriteria, options?: { signal?: AbortSignal }): Promise<MarketplaceSearchResponse>;
}
