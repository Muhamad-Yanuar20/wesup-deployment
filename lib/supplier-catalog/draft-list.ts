import { INITIAL_CATALOG_DRAFT, type CatalogDraft } from "./types";
import type { OfferScheduleInput } from "@/lib/transactions/schedule";
import type { LocalOfferRecovery } from "./local-recovery";

export interface AccountOfferDraft {
  id: string;
  step: number;
  revision: number;
  updated_at?: string;
  payload: Partial<CatalogDraft> & { schedule?: OfferScheduleInput };
}
export interface OfferDraftRow {
  identity: string;
  account?: AccountOfferDraft;
  local?: LocalOfferRecovery;
  hasLocalChanges: boolean;
}
function stable(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stable).join(",")}]`;
  if (value && typeof value === "object") return `{${Object.entries(value).filter(([, v]) => v !== undefined).sort(([a], [b]) => a.localeCompare(b)).map(([k, v]) => `${JSON.stringify(k)}:${stable(v)}`).join(",")}}`;
  return JSON.stringify(value) ?? "null";
}
function comparable(draft: Partial<CatalogDraft>) {
  return Object.fromEntries(Object.entries(INITIAL_CATALOG_DRAFT).filter(([key]) => key !== "productPhoto" && key !== "recurring").map(([key, fallback]) => [key, draft[key as keyof CatalogDraft] ?? fallback]));
}
export function mergeOfferDrafts(accounts: AccountOfferDraft[], recoveries: LocalOfferRecovery[]): OfferDraftRow[] {
  const rows = new Map<string, OfferDraftRow>();
  for (const account of accounts) rows.set(account.id, { identity: account.id, account, hasLocalChanges: false });
  for (const local of [...recoveries].sort((a, b) => b.updatedAt - a.updatedAt || a.key.localeCompare(b.key))) {
    const identity = local.id || /:draft:([^:]+)$/.exec(local.key)?.[1] || local.key;
    const row = rows.get(identity) ?? { identity, hasLocalChanges: false };
    if (row.local) continue;
    row.local = local;
    row.hasLocalChanges = !row.account || row.account.step !== local.step || stable(comparable(row.account.payload)) !== stable(comparable(local.draft)) || stable(row.account.payload.schedule) !== stable(local.schedule);
    rows.set(identity, row);
  }
  return [...rows.values()].sort((a, b) => Math.max(b.local?.updatedAt ?? 0, Date.parse(b.account?.updated_at ?? "") || 0) - Math.max(a.local?.updatedAt ?? 0, Date.parse(a.account?.updated_at ?? "") || 0) || a.identity.localeCompare(b.identity));
}
export function localOfferRecoveryHref(local: LocalOfferRecovery, accountId?: string) {
  const query = new URLSearchParams({ recovery: local.key });
  if (accountId || local.id) query.set("draft", accountId || local.id);
  if (local.copySourceId) query.set("copy", local.copySourceId);
  return `/supplier/catalog/new?${query}`;
}
