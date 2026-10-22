import { describe, expect, it } from "vitest";
import { findOwnerOfferRecovery, listOwnerOfferRecoveries, type LocalOfferRecovery } from "@/lib/supplier-catalog/local-recovery";
import { localOfferRecoveryHref, mergeOfferDrafts } from "@/lib/supplier-catalog/draft-list";

function storage(entries: Record<string, string>): Storage {
  const map = new Map(Object.entries(entries));
  return { get length() { return map.size; }, key: i => [...map.keys()][i] ?? null, getItem: k => map.get(k) ?? null, setItem: (k, v) => { map.set(k, v); }, removeItem: k => { map.delete(k); }, clear: () => map.clear() };
}
const schedule = { openingMode: "immediate", collectionDays: 1, pickupStartsAt: "", pickupEndsAt: "" } as const;
const raw = JSON.stringify({ id: "", revision: null, step: 2, draft: { title: "Beras" }, schedule });
const local = (patch: Partial<LocalOfferRecovery> = {}): LocalOfferRecovery => ({ key: "wesup:offer:owner:draft:one", id: "one", step: 2, revision: 1, updatedAt: 0, draft: { title: "Beras" }, schedule, ...patch });

describe("owner scoped draft recovery", () => {
  it("includes legacy, copied and ordinary offers but skips corrupt and foreign records", () => {
    const records = storage({ "wesup:offer:owner": raw, "wesup:offer:owner:draft:one": raw, "wesup:offer:owner:copy:source:draft:two": raw, "wesup:offer:owner:copy:legacy": raw, "wesup:offer:owner:draft:broken": "{", "wesup:offer:owner-two:draft:three": raw });
    const drafts = listOwnerOfferRecoveries(records, "owner");
    expect(drafts).toHaveLength(4);
    expect(drafts.find(d => d.key.endsWith(":two"))?.copySourceId).toBe("source");
    expect(findOwnerOfferRecovery(records, "owner", "wesup:offer:owner-two:draft:three")).toBeNull();
    expect(records.getItem("wesup:offer:owner:draft:broken")).toBe("{");
  });
  it("does not read foreign draft content", () => {
    const records = storage({ "wesup:offer:foreign:draft:one": raw });
    records.getItem = () => { throw new Error("Foreign content read"); };
    expect(listOwnerOfferRecoveries(records, "owner")).toEqual([]);
  });
  it("chooses the newest local copy for an offer without duplicating its account row", () => {
    const rows = mergeOfferDrafts([{ id: "one", step: 2, revision: 4, payload: { title: "Beras", schedule } }], [local(), local({ key: "wesup:offer:owner:copy:source:draft:one", updatedAt: 10, draft: { title: "Beras baru" } })]);
    expect(rows).toHaveLength(1); expect(rows[0].hasLocalChanges).toBe(true); expect(rows[0].local?.draft.title).toBe("Beras baru");
  });
  it("uses a pre-save key identity to merge a confirmed server draft", () => {
    const rows = mergeOfferDrafts([{ id: "one", step: 2, revision: 1, payload: { title: "Beras", schedule } }], [local({ id: "" })]);
    expect(rows).toHaveLength(1); expect(rows[0].hasLocalChanges).toBe(false);
  });
  it("preserves separate unsaved offers and copy context in resume links", () => {
    expect(mergeOfferDrafts([], [local({ id: "" }), local({ id: "", key: "wesup:offer:owner:draft:two" })])).toHaveLength(2);
    const url = new URL(localOfferRecoveryHref(local({ id: "", copySourceId: "source" })), "https://wesup.test");
    expect(url.searchParams.get("draft")).toBeNull(); expect(url.searchParams.get("copy")).toBe("source"); expect(url.searchParams.get("recovery")).toBe("wesup:offer:owner:draft:one");
  });
});
