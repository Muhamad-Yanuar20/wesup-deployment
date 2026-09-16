import type { BatchTimeline } from "./time-gatekeeper";

export type RegistrationLifecycleStatus =
  | "registered"
  | "pending_payment"
  | "paid"
  | "picked_up"
  | "completed"
  | "no_show"
  | "cancelled"
  | "refund_pending"
  | "refunded";

export type LifecycleEvent =
  | "payment_open"
  | "payment_settled"
  | "payment_expired"
  | "pickup_confirmed"
  | "no_show"
  | "refund_required"
  | "escrow_released"
  | "refund_completed";

export type OrderPhase =
  | "registered"
  | "waiting_payment_window"
  | "payment_open"
  | "payment_expired"
  | "paid_waiting_ready"
  | "ready_for_pickup"
  | "picked_up"
  | "completed"
  | "no_show"
  | "cancelled"
  | "refund_pending"
  | "refunded";

export type TransitionResult =
  | { allowed: true; status: RegistrationLifecycleStatus }
  | { allowed: false; reason: "terminal_status" | "invalid_transition" };

const TERMINAL_STATUSES = new Set<RegistrationLifecycleStatus>([
  "completed",
  "no_show",
  "cancelled",
  "refunded",
]);

const TRANSITIONS: Partial<
  Record<RegistrationLifecycleStatus, Partial<Record<LifecycleEvent, RegistrationLifecycleStatus>>>
> = {
  registered: {
    payment_open: "pending_payment",
    payment_expired: "cancelled",
    refund_required: "refund_pending",
  },
  pending_payment: {
    payment_settled: "paid",
    payment_expired: "cancelled",
    refund_required: "refund_pending",
  },
  paid: {
    pickup_confirmed: "picked_up",
    no_show: "no_show",
    refund_required: "refund_pending",
  },
  picked_up: {
    escrow_released: "completed",
    refund_required: "refund_pending",
  },
  refund_pending: {
    refund_completed: "refunded",
  },
};

export function transitionRegistrationStatus(
  current: RegistrationLifecycleStatus,
  event: LifecycleEvent,
): TransitionResult {
  if (TERMINAL_STATUSES.has(current)) {
    return { allowed: false, reason: "terminal_status" };
  }

  const next = TRANSITIONS[current]?.[event];
  return next
    ? { allowed: true, status: next }
    : { allowed: false, reason: "invalid_transition" };
}

export function deriveOrderPhase(
  status: RegistrationLifecycleStatus,
  timeline: BatchTimeline,
  serverNowIso: string,
): OrderPhase {
  const now = Date.parse(serverNowIso);
  const paymentOpens = Date.parse(timeline.effective_payment_opens_at ?? timeline.payment_opens_at);
  const paymentCloses = Date.parse(timeline.effective_payment_closes_at ?? timeline.payment_closes_at);
  const readyAt = Date.parse(timeline.estimated_ready_at);

  if (status === "registered") {
    if (now >= paymentCloses) return "payment_expired";
    return now >= paymentOpens ? "payment_open" : "waiting_payment_window";
  }
  if (status === "pending_payment") {
    return now >= paymentCloses ? "payment_expired" : "payment_open";
  }
  if (status === "paid") {
    return now >= readyAt ? "ready_for_pickup" : "paid_waiting_ready";
  }
  if (status === "picked_up") return "picked_up";
  if (status === "completed") return "completed";
  if (status === "no_show") return "no_show";
  if (status === "refunded") return "refunded";
  if (status === "refund_pending") return "refund_pending";
  return "cancelled";
}

export function isTerminalOrderStatus(status: RegistrationLifecycleStatus): boolean {
  return TERMINAL_STATUSES.has(status);
}
