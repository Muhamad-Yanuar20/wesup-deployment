import { expect, it } from "vitest";
import { fulfillmentHref, fulfillmentReturnTo } from "@/lib/supplier-fulfillment/navigation";
import { decodePickupQr, encodePickupQr } from "@/lib/supplier-fulfillment/qr-payload";
const id = "11111111-1111-4111-8111-111111111111";
const token = "a".repeat(36);
it("encodes only a versioned registration identity and token, never personal data", () => {
  expect(decodePickupQr(encodePickupQr(id, token))).toEqual({ type: "wesup_pickup", version: 1, registrationId: id, token });
  expect(decodePickupQr(token)).toEqual({ token, registrationId: null });
});
it.each(["", "https://evil.test", "{" , JSON.stringify({ type: "wesup_pickup", version: 2, registrationId: id, token }), JSON.stringify({ type: "wesup_pickup", version: 1, registrationId: "bad", token })])("rejects foreign or malformed QR %s", value => expect(() => decodePickupQr(value)).toThrow());
it("preserves the full internal return chain and preselected registration", () => {
  const orders = fulfillmentHref(`/supplier/batch/${id}/orders`, "/supplier/pesanan?status=paid");
  const pickup = fulfillmentHref(`/supplier/batch/${id}/pickup?reg=order-one`, orders);
  const target = fulfillmentReturnTo(new URL(pickup, "https://wesup.local").searchParams.get("returnTo"), id, `/supplier/batch/${id}/pickup`);
  expect(target).toBe(orders);
  expect(new URL(pickup, "https://wesup.local").searchParams.get("reg")).toBe("order-one");
});
it("preserves an orders page's nested origin when returning through the scanner toolbar", () => {
  const orders = `/supplier/batch/${id}/orders?returnTo=%2Fsupplier%2Fcatalog`;
  expect(fulfillmentHref(`/supplier/batch/${id}/orders`, orders)).toBe(orders);
});
it.each(["https://evil.test", "//evil.test", "/api/auth/logout", "/supplier/batch/other/orders", `/supplier/batch/${id}/pickup`, "/supplier/%5cevil"])('rejects unsafe, unrelated or self returns %s', value => {
  expect(fulfillmentReturnTo(value, id, `/supplier/batch/${id}/pickup`)).toBe("/supplier/pesanan");
});
