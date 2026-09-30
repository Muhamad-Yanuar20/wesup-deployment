export const PAYMENT_RELATION_SELECT = "payment:payments(id,midtrans_order_id,gross_amount,status,qr_code_url,qr_code_expires_at,paid_at,payment_attempts(id,provider_order_id,status,integration_type,provider_status,payment_type,qr_code_url,expires_at,created_at))";

export const ORDER_BATCH_RELATION_SELECT = "batch:batches(id,title,status,unit,pickup_name,pickup_address,supplier:profiles!batches_supplier_id_fkey(full_name),batch_timeline(registration_opens_at,registration_closes_at,payment_opens_at,payment_closes_at,effective_payment_opens_at,effective_payment_closes_at,estimated_ready_at))";

export const DETAIL_SELECT = [
  "id,batch_id,quantity,status,final_amount,locked_tier_number,created_at",
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
  "id,batch_id,quantity,status,final_amount,locked_tier_number,created_at",
  ORDER_BATCH_RELATION_SELECT,
  "payment:payments(id,status)",
  "escrow:escrow_holds(id,pickup_confirmed_at)",
  "dispute:disputes(id)",
  "rating:ratings(id)",
  "refund:refund_requests(id,umkm_bank_account_id)",
].join(",");