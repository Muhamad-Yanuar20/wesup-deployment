import { createHash, timingSafeEqual } from "node:crypto";

export function midtransSignature(
  orderId: string,
  statusCode: string,
  grossAmount: string,
  serverKey: string,
): string {
  return createHash("sha512")
    .update(`${orderId}${statusCode}${grossAmount}${serverKey}`)
    .digest("hex");
}

export function verifyMidtransSignature(
  orderId: string,
  statusCode: string,
  grossAmount: string,
  signature: string,
  serverKey: string,
): boolean {
  const expected = midtransSignature(orderId, statusCode, grossAmount, serverKey);
  const actualBuffer = Buffer.from(signature.trim().toLowerCase());
  const expectedBuffer = Buffer.from(expected);
  return actualBuffer.length === expectedBuffer.length && timingSafeEqual(actualBuffer, expectedBuffer);
}
