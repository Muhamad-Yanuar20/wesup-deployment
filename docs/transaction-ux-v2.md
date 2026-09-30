# Transaction UX v2 — implementation and rollout

New supplier offers use a four-step mobile form at `/supplier/catalog/new` and the atomic `/api/suppliers/offers` publication API. Private drafts accept incomplete fields, preserve the last step, and use a revision check to reject writes from stale tabs. The supplier profile supplies pickup defaults. Existing offers can be copied, with stock, prices and schedule reviewed before publication.

The canonical transaction pages are `/umkm/pesanan/[orderId]` and `/supplier/batch/[id]`. Buyer detail separates payment from actual readiness, shows the order journey and the next action, and includes support. Supplier detail shows paid fulfillment quantities, actual readiness, replacement pickup proposals and per-order pickup rights. Existing transaction links keep the same order or batch identity.

## Database contract

Apply the ordered transaction migrations before deploying these UI/API changes. The initial implementation had not applied them remotely; the recovery on 30 September 2026 applied the missing migrations to the active Wesup project after backup and rollback validation. See [live recovery evidence and remaining browser acceptance](testing/transaction-recovery.tdd.md).

`npm run build` now runs a read-only schema preflight covering columns, functions, owner RLS, Data API grants and REST relationships. `npm run db:check:transaction-ux` runs that check independently. The active database contract is generated with `node scripts/generate-database-types.mjs`. Existing order reads retain a narrowly scoped old-schema fallback and surface other database failures as errors.

| Record | Added authority |
| --- | --- |
| `batches.transaction_policy_version` | Existing rows remain v1; atomic publication creates v2. |
| `batch_timeline.pickup_ends_at` | Explicit end of the agreed pickup period. Cutoff may equal payment opening. |
| `supplier_offer_drafts` | Owner-only RLS; partial JSON payload, step, CAS revision, publication identity. |
| `registrations` | Consent snapshot, cancellation reason, verified payment exemption, explicitly accepted pickup revision. |
| `pickup_replacements` | Immutable proposal identity/revision, future range, reason and actual readiness. |
| `pickup_replacement_decisions` | Recorded order-specific consent to a replacement. |
| `transaction_support_requests` | Owner/admin RLS, issue, Admin resolution, exemption and access-restoration decision. |

Publication derives opening/cutoff/payment times on the server. Collection lasts 1/2/3/7 days; payment always lasts 24 hours. Pickup is 4–12 hours within 06:00–22:00 WIB on one day and starts after payment closes. An immediate draft has no active schedule until publication.

Once any participant has joined, database triggers lock commercial promises even if everyone later withdraws. Before cutoff, withdrawal restores capacity; rejoining preserves the order identity and records fresh consent. SQL row locks remain authoritative, with a shared distributed lock and Redis atomic reservations/resynchronization at the HTTP boundary.

Early capacity exhaustion stops admission without advancing payment. The original `cut_off_batch` RPC dispatches v2 through the fixed-window authority and retains the original v1 implementation. Browser permissions for legacy creation RPCs are removed; use `/api/suppliers/offers` for new offers. Existing legacy drafts and active transactions retain their original rules.

Readiness does not advance pickup. Replacement proposals do not automatically change any order. A late supplier cannot cause buyer no-show; uncollected orders without an accepted new window enter the full-refund queue at their agreed window's end. Partial emergency cancellation preserves picked-up orders and their escrow. No-show is separate from payment strikes and requires timely readiness and an expired agreed pickup window.

Pending provider attempts, including `provider_status=creating`, defer payment penalties. Lost charge responses remain pending and require reconciliation before another bill. Late settlement after cancellation queues a refund instead of restoring pickup. The payment-event migration fixes unconsumed SQL logging results on those existing webhook paths.

Admin resolves verified outages through `/admin` and `/api/admin/transaction-support`. Exemption reverses an attributable payment strike once; restoring access is a separate explicit Admin decision. Suspended buyers retain `/bantuan` access to their own transactions. Bank refunds and supplier transfers remain manual Admin operations.

## Deployment verification

1. Back up the target database; replay migrations in staging and verify RLS and Storage policies with actual authenticated users.
2. Deploy the new migrations before the application. Regenerate Supabase types as part of the deployment workflow.
3. Run authenticated end-to-end journeys against staging: publish a draft, join/withdraw/rejoin, reach cutoff, sandbox payment, ready/pickup, dispute/refund, and payout.
4. Verify an active v1 transaction retains all original dates and policies. New v2 transactions must not use legacy creation endpoints.
5. Keep the order page and in-app notifications as the source of truth. Lazy evaluation creates notifications when an event is processed; no exact-time background reminder is promised.

Recurring offers and a full visual redesign remain deferred. Bandung pickup, Midtrans sandbox, 24-hour escrow, and Admin-handled refunds/transfers remain the operating assumptions.

## Usability acceptance protocol (requires human participants)

Recruit at least five prospective users per role; record completion, assistance, elapsed time and comprehension errors. Do not count automated tests as this study.

Supplier tasks: create the first offer with prepared product data in at most five minutes; save and restore an incomplete draft; explain payment and pickup dates; confirm readiness; offer a replacement after lateness and explain which orders accepted it.

UMKM tasks: identify maximum versus estimated/final price; join and find the same order; explain payment deadline; withdraw/rejoin before cutoff; identify when to travel; choose an explicit replacement or full refund after supplier lateness.

Acceptance: at least four of five users in each role complete the main tasks without help and explain maximum/final price, payment timing and pickup period correctly. This human study has not been performed in this coding session.
