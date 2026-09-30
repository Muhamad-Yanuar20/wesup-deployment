import { randomUUID } from "node:crypto";
import { redis } from "@/lib/redis";

export const VOLUME_KEY_PREFIX = "batch:";
export const VOLUME_KEY_SUFFIX = ":count";
export const CUTOFF_LOCK_PREFIX = "cutoff-lock:";
export const CUTOFF_LOCK_TTL_SECONDS = 30;

const RELEASE_LOCK_SCRIPT = `
if redis.call('get', KEYS[1]) == ARGV[1] then
  return redis.call('del', KEYS[1])
else
  return 0
end
`;

const RESERVE_VOLUME_SCRIPT = `
local current = tonumber(redis.call('get', KEYS[1]) or '0')
local requested = tonumber(ARGV[1])
local maximum = tonumber(ARGV[2])
if maximum > 0 and current + requested > maximum then
  return -(maximum - current)
end
return redis.call('incrby', KEYS[1], requested)
`;

export class BatchCapacityError extends Error {
  readonly remainingQuantity: number | null;

  constructor(remainingQuantity: number | null = null) {
    super("batch capacity is full");
    this.name = "BatchCapacityError";
    this.remainingQuantity = remainingQuantity;
  }
}

export function volumeKey(batchId: string): string {
  return `${VOLUME_KEY_PREFIX}${batchId}${VOLUME_KEY_SUFFIX}`;
}

export function cutoffLockKey(batchId: string): string {
  return `${CUTOFF_LOCK_PREFIX}${batchId}`;
}

export async function adjustVolumeCounter(
  batchId: string,
  quantityDelta: number,
): Promise<number> {
  if (!Number.isSafeInteger(quantityDelta) || quantityDelta === 0) {
    throw new Error("quantityDelta must be a non-zero safe integer");
  }
  return redis.incrby(volumeKey(batchId), quantityDelta);
}

/** Atomically checks capacity and increments the reservation counter. */
export async function reserveVolumeCounter(
  batchId: string,
  quantity: number,
  maxVolume: number | null,
): Promise<number> {
  if (!Number.isSafeInteger(quantity) || quantity <= 0) {
    throw new Error("quantity must be a positive safe integer");
  }
  if (maxVolume !== null && (!Number.isSafeInteger(maxVolume) || maxVolume < 0)) {
    throw new Error("maxVolume must be null or a non-negative safe integer");
  }
  const result = await redis.eval<[string, string], number>(
    RESERVE_VOLUME_SCRIPT,
    [volumeKey(batchId)],
    [String(quantity), String(maxVolume ?? 0)],
  );
  const count = Number(result);
  if (!Number.isFinite(count)) {
    throw new Error("capacity reservation unavailable");
  }
  if (count < 0) throw new BatchCapacityError(Math.max(0, -count));
  return count;
}

/** @deprecated Prefer adjustVolumeCounter so registrations reserve quantity. */
export async function incrementVolumeCounter(
  batchId: string,
  quantity = 1,
): Promise<number> {
  return adjustVolumeCounter(batchId, quantity);
}

/** @deprecated Prefer adjustVolumeCounter with a negative delta. */
export async function decrementVolumeCounter(
  batchId: string,
  quantity = 1,
): Promise<number> {
  return adjustVolumeCounter(batchId, -quantity);
}

export async function getVolumeCounter(batchId: string): Promise<number | null> {
  const value = await redis.get<number>(volumeKey(batchId));
  return typeof value === "number" ? value : null;
}

export async function restoreVolumeCounter(
  batchId: string,
  quantity: number,
): Promise<void> {
  if (!Number.isSafeInteger(quantity) || quantity < 0) {
    throw new Error("quantity must be a non-negative safe integer");
  }
  await redis.set(volumeKey(batchId), quantity);
}

export async function resetVolumeCounter(batchId: string): Promise<void> {
  await redis.del(volumeKey(batchId));
}

export interface CutoffLock {
  acquired: boolean;
  token: string;
}

export async function acquireCutoffLock(
  batchId: string,
): Promise<CutoffLock> {
  const token = randomUUID();
  const result = await redis.set(cutoffLockKey(batchId), token, {
    nx: true,
    ex: CUTOFF_LOCK_TTL_SECONDS,
  });
  if (result !== "OK") {
    return { acquired: false, token: "" };
  }
  return { acquired: true, token };
}

export async function releaseCutoffLock(
  batchId: string,
  token: string,
): Promise<void> {
  await redis.eval(RELEASE_LOCK_SCRIPT, [cutoffLockKey(batchId)], [token]);
}

export { RELEASE_LOCK_SCRIPT, RESERVE_VOLUME_SCRIPT };
