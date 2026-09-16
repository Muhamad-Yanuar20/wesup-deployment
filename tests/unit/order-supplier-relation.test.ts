import { describe, expect, it } from "vitest";
import { ORDER_BATCH_RELATION_SELECT } from "@/lib/orders/selects";

describe("UMKM order supplier relation", () => {
  it("pins the supplier profile embed to the supplier foreign key", () => {
    expect(ORDER_BATCH_RELATION_SELECT).toContain("supplier:profiles!batches_supplier_id_fkey(full_name)");
  });
});
