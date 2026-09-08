import { SEARCH_DEFAULT_LIMIT } from "@/lib/catalog/categories";
import { filterMarketplaceItems, paginateMarketplaceItems } from "./query";
import { marketplaceMockItems } from "./mock-data";
import type { MarketplaceMockScenario, MarketplaceOrigin, MarketplaceRepository, MarketplaceSearchResponse } from "./types";

function abortError(): DOMException {
  return new DOMException("The operation was aborted.", "AbortError");
}

function cloneSearchResult(result: MarketplaceSearchResponse): MarketplaceSearchResponse {
  return {
    ...result,
    items: result.items.map((item) => ({ ...item })),
  };
}

const MOCK_ORIGIN: MarketplaceOrigin = {
  latitude: -6.914744,
  longitude: 107.60981,
  source: "bandung_default",
};

export function createMarketplaceMockRepository(options: {
  items?: readonly import("./types").MarketplaceItem[];
  latencyMs?: number;
  scenario?: MarketplaceMockScenario;
} = {}): MarketplaceRepository {
  const items = options.items ?? marketplaceMockItems;
  const latencyMs = Math.max(0, options.latencyMs ?? 250);
  const scenario = options.scenario ?? "success";
  return {
    search(criteria, { signal } = {}) {
      return new Promise((resolve, reject) => {
        if (signal?.aborted) return reject(abortError());
        let settled = false;
        const finish = () => {
          if (settled) return;
          settled = true;
          signal?.removeEventListener("abort", onAbort);
          if (scenario === "error") return reject(new Error("Gagal memuat penawaran mock."));
          if (scenario === "empty") {
            return resolve({
              ...cloneSearchResult({
                ...paginateMarketplaceItems([], criteria.page, SEARCH_DEFAULT_LIMIT),
                origin: MOCK_ORIGIN,
              }),
            });
          }
          const filtered = filterMarketplaceItems(items, criteria);
          resolve({
            ...cloneSearchResult({
              ...paginateMarketplaceItems(filtered, criteria.page, criteria.pageSize),
              origin: MOCK_ORIGIN,
            }),
          });
        };
        const timer = setTimeout(finish, latencyMs);
        const onAbort = () => {
          clearTimeout(timer);
          if (!settled) { settled = true; reject(abortError()); }
        };
        signal?.addEventListener("abort", onAbort, { once: true });
      });
    },
  };
}

export const marketplaceMockRepository = createMarketplaceMockRepository();
