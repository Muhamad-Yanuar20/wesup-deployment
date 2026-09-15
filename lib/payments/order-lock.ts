import { randomUUID } from "node:crypto";
import { redis } from "@/lib/redis";

const PREFIX = "payment-lock:";
const TTL_SECONDS = 30;
const RELEASE_SCRIPT = `
if redis.call('get', KEYS[1]) == ARGV[1] then
  return redis.call('del', KEYS[1])
else
  return 0
end
`;

export function paymentLockKey(registrationId: string): string {
  return `${PREFIX}${registrationId}`;
}

export async function acquirePaymentLock(registrationId: string): Promise<{ acquired: boolean; token: string }> {
  const token = randomUUID();
  const result = await redis.set(paymentLockKey(registrationId), token, { nx: true, ex: TTL_SECONDS });
  return result === "OK" ? { acquired: true, token } : { acquired: false, token: "" };
}

export async function releasePaymentLock(registrationId: string, token: string): Promise<void> {
  if (!token) return;
  await redis.eval(RELEASE_SCRIPT, [paymentLockKey(registrationId)], [token]);
}
