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

export const ORDER_SELECT = DETAIL_SELECT;