import { fetchRead } from "@/lib/feedback/read-request";
import { readFeedbackError } from "@/lib/feedback/errors";
import type {
  MarketplaceRepository,
  MarketplaceSearchCriteria,
  MarketplaceSearchResponse,
} from "./types";

export class MarketplaceReadError extends Error {
  constructor(message: string, public readonly retryAfterMs: number) { super(message); }
}

export async function readApiError(response: Response): Promise<string> {
 return (await readFeedbackError(response, "Penawaran belum dapat dimuat. Coba lagi.")).message;
}

export const marketplaceApiRepository: MarketplaceRepository = {
  async search(
    criteria: MarketplaceSearchCriteria,
    { signal }: { signal?: AbortSignal } = {},
  ): Promise<MarketplaceSearchResponse> {
    const params = new URLSearchParams({
      q: criteria.query ?? "",
      radius: String(criteria.radiusKm),
      page: String(criteria.page),
      limit: String(criteria.pageSize),
    });
    if (criteria.selectedCategories.length > 0) {
      params.set("categories", criteria.selectedCategories.join(","));
    }
    if (criteria.minPrice !== null) params.set("minPrice", String(criteria.minPrice));
    if (criteria.maxPrice !== null) params.set("maxPrice", String(criteria.maxPrice));

    const response = await fetchRead(`/api/marketplace/search?${params.toString()}`, {
      signal,
      cache: "no-store",
    });
    if (!response.ok) {
      const retry = response.headers.get("retry-after");
      const seconds = retry == null ? NaN : Number(retry);
      const retryAfterMs = Number.isFinite(seconds) ? Math.max(0, seconds * 1000) : Math.max(0, Date.parse(retry ?? "") - Date.now());
      throw new MarketplaceReadError(await readApiError(response), Number.isFinite(retryAfterMs) ? retryAfterMs : 0);
    }
    return (await response.json()) as MarketplaceSearchResponse;
  },
};
