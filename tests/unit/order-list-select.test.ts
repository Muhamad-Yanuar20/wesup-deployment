import { describe, expect, it } from "vitest";
import { DETAIL_SELECT, ORDER_SELECT } from "@/lib/orders/selects";

describe("order list projection", () => {
  it("keeps every field the list item and its action capabilities read", () => {
    // scalars rendered on the card
    expect(ORDER_SELECT).toContain("id,batch_id,quantity,status,final_amount,locked_tier_number,created_at");
    // batch + timeline drive phase, deadlines and the next action
    expect(ORDER_SELECT).toContain("batch:batches(");
    expect(ORDER_SELECT).toContain("batch_timeline(");
    // payment.status drives canPay and paymentStatus
    expect(ORDER_SELECT).toContain("payment:payments(");
    expect(ORDER_SELECT).toContain("status");
    // escrow.pickup_confirmed_at drives the pickup and complaint deadlines
    expect(ORDER_SELECT).toContain("escrow:escrow_holds(");
    expect(ORDER_SELECT).toContain("pickup_confirmed_at");
    // dispute/rating existence and refund bank account drive the action buttons
    expect(ORDER_SELECT).toContain("dispute:disputes(");
    expect(ORDER_SELECT).toContain("rating:ratings(");
    expect(ORDER_SELECT).toContain("umkm_bank_account_id");
  });

  it("does not join pickup codes for a list of orders", () => {
    // pickup_codes is a per-row join whose only consumer is the detail view,
    // and it carries the 4-digit pickup PIN.
    expect(ORDER_SELECT).not.toContain("pickup_code");
    expect(ORDER_SELECT).not.toContain("pin_code");
  });

  it("does not aggregate payment attempts for a list of orders", () => {
    // payment_attempts is a nested array aggregate per row; only the detail
    // view reads it (toUmkmOrderDetail -> paymentAttemptFromRow).
    expect(ORDER_SELECT).not.toContain("payment_attempts(");
  });

  it("does not ship dispute payloads the list never renders", () => {
    expect(ORDER_SELECT).not.toContain("photo_urls");
    expect(ORDER_SELECT).not.toContain("description");
  });

  it("leaves the detail projection fully intact", () => {
    expect(DETAIL_SELECT).toContain("payment_attempts(");
    expect(DETAIL_SELECT).toContain("pickup_code:pickup_codes(");
    expect(DETAIL_SELECT).toContain("pin_code");
    expect(DETAIL_SELECT).toContain("photo_urls");
  });
});
