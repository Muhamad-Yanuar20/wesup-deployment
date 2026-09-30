import type {
  ConfirmPickupInput,
  ConfirmPickupResult,
  FulfillmentOrder,
  FulfillmentOrderList,
  FulfillmentRepository,
  ForceMajeureResult,
} from "./types";

interface ApiOrderRow {
  registration_id: string;
  umkm_name: string;
  quantity: number;
  unit?: string | null;
  status: FulfillmentOrder["status"];
  final_amount: number | string | null;
  lock_tier: number | null;
  created_at: string;
}

interface ErrorBody {
  error?: unknown;
}

const orderCache = new Map<string, FulfillmentOrder>();
const DEFAULT_FULFILLMENT_UNIT = "pcs";

async function readError(response: Response, fallback: string): Promise<string> {
  try {
    const body = await response.json() as ErrorBody;
    if (typeof body.error === "string" && body.error.trim()) return body.error;
  } catch {
    // Fall back to a stable user-facing message below.
  }
  return response.statusText || fallback;
}

function mapOrder(batchId: string, row: ApiOrderRow): FulfillmentOrder {
  return {
    registrationId: row.registration_id,
    batchId,
    displayCode: `REG-${row.registration_id.slice(0, 8).toUpperCase()}`,
    umkmName: row.umkm_name,
    quantity: Number(row.quantity),
    unit: typeof row.unit === "string" && row.unit.trim() ? row.unit.trim() : DEFAULT_FULFILLMENT_UNIT,
    status: row.status,
    finalAmount: row.final_amount === null ? null : Number(row.final_amount),
    lockedTier: row.lock_tier === null ? null : Number(row.lock_tier),
    createdAt: row.created_at,
    pickupCode: null,
    pinCode: null,
    pickedUpAt: null,
    pickedUpByMethod: null,
  };
}

function withUpdatedStatus(order: FulfillmentOrder, method: ConfirmPickupInput["method"]): FulfillmentOrder {
  return {
    ...order,
    status: "picked_up",
    pickedUpAt: new Date().toISOString(),
    pickedUpByMethod: method,
    pickupCode: null,
    pinCode: null,
  };
}

export const supplierFulfillmentApiRepository: FulfillmentRepository = {
  async listOrders(batchId, { signal } = {}): Promise<FulfillmentOrderList> {
    const response = await fetch(`/api/suppliers/batches/${encodeURIComponent(batchId)}/orders`, {
      signal,
      cache: "no-store",
    });
    if (!response.ok) throw new Error(await readError(response, "Pesanan belum dapat dimuat."));
    const body = await response.json() as { orders?: ApiOrderRow[] };
    const orders = (body.orders ?? []).map((row) => mapOrder(batchId, row));
    for (const order of orders) orderCache.set(order.registrationId, order);
    return { batchId, orders };
  },

  async confirmPickup(registrationId, input, { signal } = {}): Promise<ConfirmPickupResult> {
    const response = await fetch(`/api/pickups/${encodeURIComponent(registrationId)}/confirm`, {
      method: "POST",
      signal,
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ method: input.method, code: input.code }),
    });
    if (!response.ok) {
      const message = await readError(response, "Serah terima belum dapat diproses.");
      throw { code: "invalid_code", message };
    }
    const cached = orderCache.get(registrationId);
    const order = withUpdatedStatus(cached ?? {
      registrationId,
      batchId: "",
      displayCode: `REG-${registrationId.slice(0, 8).toUpperCase()}`,
      umkmName: "UMKM",
      quantity: 0,
      unit: DEFAULT_FULFILLMENT_UNIT,
      status: "paid",
      finalAmount: null,
      lockedTier: null,
      createdAt: new Date().toISOString(),
      pickupCode: null,
      pinCode: null,
      pickedUpAt: null,
      pickedUpByMethod: null,
    }, input.method);
    orderCache.set(registrationId, order);
    return { order };
  },

  async forceMajeureCancel(batchId, { signal } = {}): Promise<ForceMajeureResult> {
    const response = await fetch(`/api/suppliers/batches/${encodeURIComponent(batchId)}/cancel`, {
      method: "POST",
      signal,
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ reason: "Pembatalan darurat oleh Supplier" }),
    });
    if (!response.ok) throw new Error(await readError(response, "Pembatalan darurat belum dapat diproses."));
    const affected = [...orderCache.values()].filter((order) => order.batchId === batchId && order.status === "paid").length;
    for (const order of orderCache.values()) {
      if (order.batchId === batchId) orderCache.set(order.registrationId, { ...order, status: "cancelled", pickupCode: null, pinCode: null });
    }
    return { batchId, cancelledAt: new Date().toISOString(), refundedOrderCount: affected };
  },
};