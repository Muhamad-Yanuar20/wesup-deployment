import type { MarketplaceItem } from "./types";
import { withinReadBudget } from "@/lib/performance/read-budget";
interface Row { id: string; transaction_policy_version: number; capacity_quantity: number | null; unit: string; payment_opening_policy: string; registration_closed_at: string | null; batch_timeline: Record<string, string | null> | Array<Record<string, string | null>> | null; }
export interface MarketplaceListContextClient {
  from: (table: "batches") => { select: (columns: string) => { in: (column: string, values: string[]) => PromiseLike<{ data: Row[] | null; error: unknown }> } };
}
/** A single RLS-governed public metadata read, independent of page item count. */
export async function enrichMarketplaceList(client: MarketplaceListContextClient, items: MarketplaceItem[]): Promise<MarketplaceItem[]> {
  if (!items.length) return items;
  const { data, error } = await withinReadBudget(client.from("batches").select("id,transaction_policy_version,capacity_quantity,unit,payment_opening_policy,registration_closed_at,batch_timeline(registration_closes_at,payment_opens_at,payment_closes_at,effective_payment_opens_at,effective_payment_closes_at,estimated_ready_at,pickup_ends_at)").in("id", items.map(item => item.id)));
  if (error) throw error;
  const contexts = new Map((data ?? []).map(row => [row.id, row]));
  return items.map(item => {
    const row = contexts.get(item.id); if (!row) return item;
    const t = (Array.isArray(row.batch_timeline) ? row.batch_timeline[0] : row.batch_timeline) ?? {};
    return { ...item, policyVersion: row.transaction_policy_version, capacityQuantity: row.capacity_quantity, unit: row.unit, paymentOpeningPolicy: row.payment_opening_policy,
      registrationClosesAt: row.registration_closed_at ?? t.registration_closes_at ?? item.registrationClosesAt,
      paymentOpensAt: t.effective_payment_opens_at ?? t.payment_opens_at ?? undefined, paymentClosesAt: t.effective_payment_closes_at ?? t.payment_closes_at ?? undefined,
      pickupStartsAt: t.estimated_ready_at ?? undefined, pickupEndsAt: t.pickup_ends_at ?? null };
  });
}
