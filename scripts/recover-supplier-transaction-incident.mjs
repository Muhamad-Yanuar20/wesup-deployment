import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import pg from "pg";
import { findMissingSupplierTransactionObjects, readSnapshot } from "./check-supplier-transaction-schema.mjs";

const { Client } = pg;
const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const RECOVERY_HOURS = 24;
const RECOVERY_SOURCE = "incident_payment_window_recovery";
const BATCH_ID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function calculateRecoveryDeadline(nowIso, hours = RECOVERY_HOURS) {
  const start = Date.parse(nowIso);
  if (!Number.isFinite(start) || !Number.isFinite(hours) || hours <= 0) throw new Error("invalid recovery timestamp");
  return new Date(start + hours * 60 * 60 * 1000).toISOString();
}

export function isRecoveryCandidate(input) {
  if (input.status !== "published") return { eligible: false, reason: "BATCH_NOT_PUBLISHED" };
  if (input.invoicesIssuedAt) return { eligible: false, reason: "INVOICES_ALREADY_ISSUED" };
  const cutoff = Date.parse(input.registrationClosedAt ?? "");
  const now = Date.parse(input.now ?? "");
  if (!Number.isFinite(cutoff) || !Number.isFinite(now) || cutoff > now) return { eligible: false, reason: "CUTOFF_NOT_REACHED" };
  if (Number(input.registeredOrderCount) < 1) return { eligible: false, reason: "NO_REGISTERED_ORDERS" };
  if (Number(input.registeredOrderCount) > 100) return { eligible: false, reason: "RECOVERY_ROW_LIMIT" };
  if (Number(input.nonRegisteredOrderCount) > 0) return { eligible: false, reason: "ORDER_STATE_CONFLICT" };
  if (Number(input.existingPaymentCount) > 0) return { eligible: false, reason: "PAYMENT_ALREADY_EXISTS" };
  return { eligible: true };
}

function loadEnv() {
  if (process.env.DATABASE_URL || !existsSync(resolve(ROOT, ".env"))) return;
  for (const raw of readFileSync(resolve(ROOT, ".env"), "utf8").split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith("#")) continue;
    const separator = line.indexOf("=");
    if (separator <= 0) continue;
    const key = line.slice(0, separator).trim();
    if (process.env[key] !== undefined) continue;
    let value = line.slice(separator + 1).trim();
    if (value.charCodeAt(0) === 34 && value.charCodeAt(value.length - 1) === 34) value = value.slice(1, -1);
    process.env[key] = value;
  }
}

function errorCode(error) {
  return error && typeof error === "object" && "code" in error ? String(error.code ?? "") : "";
}

async function recoveryStep(label, operation) {
  try {
    return await operation();
  } catch (error) {
    if (error && typeof error === "object") error.recoveryStep = label;
    throw error;
  }
}

async function readBatchCandidate(client, batchId, recoveryAnchor) {
  const result = await client.query("select b.id, b.supplier_id, b.status::text as status, b.invoices_issued_at, b.payment_window_hours, t.registration_closes_at, count(r.id) filter (where r.status::text = 'registered')::int as registered_order_count, count(r.id) filter (where r.status::text not in ('registered', 'cancelled'))::int as non_registered_order_count, count(p.id)::int as existing_payment_count from public.batches b left join public.batch_timeline t on t.batch_id = b.id left join public.registrations r on r.batch_id = b.id left join public.payments p on p.registration_id = r.id where b.id = $1 group by b.id, t.registration_closes_at", [batchId]);
  const row = result.rows[0];
  if (!row) return null;
  return {
    ...row,
    candidate: isRecoveryCandidate({
      status: row.status,
      registrationClosedAt: row.registration_closes_at,
      now: recoveryAnchor,
      invoicesIssuedAt: row.invoices_issued_at,
      registeredOrderCount: row.registered_order_count,
      nonRegisteredOrderCount: row.non_registered_order_count,
      existingPaymentCount: row.existing_payment_count,
    }),
  };
}

async function hasRecoveryEvent(client, batchId) {
  const result = await client.query("select exists (select 1 from public.batch_status_events where batch_id = $1 and source = $2) as recovered", [batchId, RECOVERY_SOURCE]);
  return Boolean(result.rows[0]?.recovered);
}

async function recoverOne(client, candidate, recoveryAnchor, recoveryDeadline) {
  const batchId = candidate.id;
  await recoveryStep("set_auth_claim", () => client.query("select set_config($1, $2, true)", ["request.jwt.claim.sub", candidate.supplier_id]));
  const closeResult = await recoveryStep("close_batch_and_issue_invoices", () => client.query("select public.close_batch_and_issue_invoices($1, $2, $3, $4) as result", [batchId, "registration_expired", null, "supplier-payment-window-recovery"]));
  await recoveryStep("update_effective_payment_window", () => client.query("update public.batch_timeline set effective_payment_opens_at = $2, effective_payment_closes_at = $3 where batch_id = $1", [batchId, recoveryAnchor, recoveryDeadline]));
  await client.query("update public.notifications set title = 'Jendela pembayaran dipulihkan', message = format('Tagihan batch dipulihkan karena kendala sistem. Pembayaran tersedia hingga %s WIB.', to_char($2::timestamptz at time zone 'Asia/Jakarta', 'DD Mon YYYY HH24:MI')), data = coalesce(data, '{}'::jsonb) || jsonb_build_object('incident_recovery', true, 'payment_closes_at', $2) where type = 'payment_due' and data ->> 'batch_id' = $1::text and data ->> 'registration_id' in (select id::text from public.registrations where batch_id = $1::uuid and status::text = 'pending_payment')", [batchId, recoveryDeadline]);
  await client.query("insert into public.notifications (user_id, type, title, message, data) select r.umkm_id, 'payment_due', 'Jendela pembayaran dipulihkan', format('Tagihan batch dipulihkan karena kendala sistem. Pembayaran tersedia hingga %s WIB.', to_char($2::timestamptz at time zone 'Asia/Jakarta', 'DD Mon YYYY HH24:MI')), jsonb_build_object('batch_id', r.batch_id, 'registration_id', r.id, 'incident_recovery', true, 'payment_closes_at', $2::timestamptz) from public.registrations r where r.batch_id = $1::uuid and r.status::text = 'pending_payment' and not exists (select 1 from public.notifications n where n.type = 'payment_due' and n.data ->> 'registration_id' = r.id::text and n.data ->> 'incident_recovery' = 'true')", [batchId, recoveryDeadline]);
  await client.query("insert into public.batch_status_events (batch_id, from_status, to_status, source, actor_id, metadata) values ($1, 'closed', 'closed', $2, $3, jsonb_build_object('recoveryAnchor', $4::timestamptz, 'effectivePaymentClosesAt', $5::timestamptz, 'reason', 'invoice_unavailable_due_to_42702'))", [batchId, RECOVERY_SOURCE, candidate.supplier_id, recoveryAnchor, recoveryDeadline]);
  const verification = await client.query("select b.status::text as status, b.registration_closed_at, b.close_reason, b.final_registered_quantity, b.locked_tier_number, b.locked_unit_price, t.effective_payment_opens_at, t.effective_payment_closes_at, (select count(*) from public.registrations r where r.batch_id = b.id and r.status::text = 'pending_payment')::int as pending_orders, (select count(*) from public.payments p join public.registrations r on r.id = p.registration_id where r.batch_id = b.id and p.status::text = 'pending')::int as pending_payments, (select count(*) from public.payments p join public.registrations r on r.id = p.registration_id where r.batch_id = b.id)::int as payment_count from public.batches b join public.batch_timeline t on t.batch_id = b.id where b.id = $1", [batchId]);
  const row = verification.rows[0];
  if (!row || row.status !== "closed" || row.close_reason !== "registration_expired" || new Date(row.registration_closed_at).toISOString() !== new Date(candidate.registration_closes_at).toISOString() || new Date(row.effective_payment_opens_at).toISOString() !== new Date(recoveryAnchor).toISOString() || new Date(row.effective_payment_closes_at).toISOString() !== new Date(recoveryDeadline).toISOString() || Number(row.pending_orders) !== Number(candidate.registered_order_count) || Number(row.pending_payments) !== Number(candidate.registered_order_count) || Number(row.payment_count) !== Number(candidate.registered_order_count)) throw new Error("recovery postcondition failed");
  return { batchId, action: "recovered", closeResult: closeResult.rows[0]?.result ?? null, recoveryAnchor, recoveryDeadline, pendingOrders: row.pending_orders, paymentCount: row.payment_count, lockedTierNumber: row.locked_tier_number, lockedUnitPrice: row.locked_unit_price };
}

export async function recoverSupplierPaymentWindows(client, batchIds, { apply = false } = {}) {
  if (!Array.isArray(batchIds) || batchIds.length === 0) throw new Error("at least one batch id is required");
  if (batchIds.some((id) => !BATCH_ID_PATTERN.test(id))) throw new Error("invalid batch id");
  const uniqueBatchIds = [...new Set(batchIds)];
  if (uniqueBatchIds.length > 10 || uniqueBatchIds.length !== batchIds.length) throw new Error("provide at most 10 unique explicit batch ids");
  await client.query("begin");
  try {
    await client.query("select pg_advisory_xact_lock(hashtext($1))", ["wesup:supplier-payment-window-recovery"]);
    const anchorResult = await client.query("select clock_timestamp() as now");
    const recoveryAnchor = new Date(anchorResult.rows[0].now).toISOString();
    const recoveryDeadline = calculateRecoveryDeadline(recoveryAnchor);
    const results = [];
    for (const batchId of uniqueBatchIds) {
      await client.query("select id from public.batches where id = $1 for update", [batchId]);
      const candidate = await readBatchCandidate(client, batchId, recoveryAnchor);
      if (!candidate) {
        results.push({ batchId, action: "skipped", reason: "BATCH_NOT_FOUND" });
        continue;
      }
      if (await hasRecoveryEvent(client, batchId)) {
        results.push({ batchId, action: "already_recovered" });
        continue;
      }
      if (!candidate.candidate.eligible) {
        results.push({ batchId, action: "skipped", reason: candidate.candidate.reason });
        continue;
      }
      if (!apply) {
        results.push({ batchId, action: "would_recover", registeredOrderCount: candidate.registered_order_count, recoveryAnchor, recoveryDeadline });
        continue;
      }
      results.push(await recoverOne(client, candidate, recoveryAnchor, recoveryDeadline));
    }
    if (apply) await client.query("commit");
    else await client.query("rollback");
    return { apply, recoveryAnchor, recoveryDeadline, results };
  } catch (error) {
    await client.query("rollback").catch(() => undefined);
    throw error;
  }
}

async function main() {
  loadEnv();
  const args = process.argv.slice(2);
  const apply = args.includes("--apply");
  const batchIds = [];
  for (let index = 0; index < args.length; index += 1) {
    if (args[index] === "--batch-id" && args[index + 1]) batchIds.push(args[++index]);
    else if (BATCH_ID_PATTERN.test(args[index])) batchIds.push(args[index]);
  }
  if (batchIds.length === 0) {
    console.error("Usage: node scripts/recover-supplier-transaction-incident.mjs --batch-id <uuid> [--batch-id <uuid>] [--apply]");
    return 1;
  }
  if (!process.env.DATABASE_URL) {
    console.error("Supplier transaction recovery failed: DATABASE_URL is not set.");
    return 1;
  }
  const client = new Client({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
  try {
    await client.connect();
    const missing = findMissingSupplierTransactionObjects(await readSnapshot(client));
    if (missing.length > 0) {
      console.error("Supplier transaction recovery blocked: schema guard is not ready.");
      return 1;
    }
    console.log(JSON.stringify(await recoverSupplierPaymentWindows(client, batchIds, { apply }), null, 2));
    return 0;
  } catch (error) {
    const code = errorCode(error);
    console.error("Supplier transaction recovery failed" + (code ? " (" + code + ")" : "") + ".");
    return 1;
  } finally {
    await client.end().catch(() => undefined);
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) process.exitCode = await main();
