export const PAYMENT_RELATION_SELECT = "payment:payments(id,midtrans_order_id,midtrans_transaction_id,gross_amount,status,qr_code_url,qr_code_expires_at,paid_at,reconciled_at,payment_attempts(id,provider_order_id,status,integration_type,provider_status,provider_checked_at,payment_type,qr_code_url,expires_at,created_at))";

export const ORDER_BATCH_RELATION_SELECT = "batch:batches(id,title,status,unit,transaction_policy_version,payment_opening_policy,registration_closed_at,close_reason,ready_at,pickup_name,pickup_address,supplier:profiles!batches_supplier_id_fkey(full_name),batch_timeline(registration_opens_at,registration_closes_at,payment_opens_at,payment_closes_at,effective_payment_opens_at,effective_payment_closes_at,estimated_ready_at,pickup_ends_at),pickup_replacements(id,revision,starts_at,ends_at,ready_at,reason))";

export const DETAIL_SELECT = [
  "id,batch_id,quantity,status,final_amount,locked_tier_number,locked_price_per_unit,created_at,cancellation_reason,accepted_pickup_revision",
  ORDER_BATCH_RELATION_SELECT,
  PAYMENT_RELATION_SELECT,
  "pickup_code:pickup_codes(qr_code_token,pin_code,generated_at,used_at)",
  "escrow:escrow_holds(id,amount,status,pickup_confirmed_at,auto_release_at)",
  "dispute:disputes(id,complaint_category,description,photo_urls,status,created_at,decided_at)",
  "rating:ratings(score,comment,created_at)",
  "refund:refund_requests(id,amount,status,trigger_type,umkm_bank_account_id)",
].join(",");

// The list view only needs enough of each relation to render a card and decide
// which action buttons to show. toUmkmOrderListItem -> capabilitiesFor reads
// payment.status, escrow.pickup_confirmed_at, dispute/rating existence and
// refund.umkm_bank_account_id, and nothing else.
//
// Dropped relative to DETAIL_SELECT, all of it a per-row join or aggregate that
// the list never reads:
//   - pickup_codes        (detail-only; also carried the 4-digit pickup PIN)
//   - payment_attempts    (detail-only nested array aggregate)
//   - disputes.photo_urls / description, rating text, refund amounts
export const ORDER_SELECT = [
  "id,batch_id,quantity,status,final_amount,locked_tier_number,locked_price_per_unit,created_at,cancellation_reason,accepted_pickup_revision",
  ORDER_BATCH_RELATION_SELECT,
  "payment:payments(id,status,midtrans_order_id,reconciled_at,payment_attempts(id,status,provider_status,provider_checked_at,payment_type,created_at))",
  "escrow:escrow_holds(id,pickup_confirmed_at)",
  "dispute:disputes(id,status)",
  "rating:ratings(id)",
  "refund:refund_requests(id,umkm_bank_account_id)",
].join(",");

/** Only absent v2 objects justify a retry. Permission/network errors stay errors. */
export function isMissingTransactionUxSchema(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const value = error as { code?: string; message?: string; details?: string };
  return ["42703", "PGRST200", "PGRST205", "42P01"].includes(value.code ?? "") &&
    /transaction_policy_version|cancellation_reason|accepted_pickup_revision|pickup_ends_at|pickup_replacements|payment_opening_policy|provider_checked_at/.test(`${value.message ?? ""} ${value.details ?? ""}`);
}

export function legacyOrderProjection(projection: string): string {
  return projection.replace(",transaction_policy_version", "").replace(",payment_opening_policy", "").replaceAll(",provider_checked_at", "").replace(",cancellation_reason", "")
    .replace(",accepted_pickup_revision", "").replace(",pickup_ends_at", "")
    .replace(",pickup_replacements(id,revision,starts_at,ends_at,ready_at,reason)", "");
}

export async function readCompatibleOrder<T>(
  read: (projection: string) => PromiseLike<{ data: T | null; error: unknown | null }>,
  projection: string,
) {
  let result = await read(projection);
  let usedProjection = projection;
  if (isMissingTransactionUxSchema(result.error)) {
    usedProjection = legacyOrderProjection(projection);
    result = await read(usedProjection);
  }
  return { ...result, projection: usedProjection };
}
