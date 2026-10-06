# Payment continuation hotfix — 2 October 2026

## Incident and scope

The 111 kg Sayur Ddemo registration was cancelled at 07:45 UTC while its invoice remained pending and its effective payment deadline was 20:45 UTC. No payment attempt existed. The user confirmed they had not cancelled it. The original writer is not identifiable from the old audit (actor absent, reason absent); this hotfix does not claim Midtrans caused that cancellation.

Only registration `14df50d9-d7d4-4a79-87f2-2b29dbc8c96c` was recovered. Quantity 111, locked unit price Rp70,000 and final amount Rp7,770,000 were preserved. Its sibling registration was reported only. No strikes, pickup commitments, private PRD, landing components or pre-existing local configuration were changed.

## Red → green

- Baseline: 6 payment test files / 44 tests passed.
- Red: new progress and rendered-panel regressions produced 6 failures / 3 passes. They reproduced cancellation being labelled expiry, expired checkout suppressing retry, unresolved expired checkout being treated as payable, and missing structured blockers.
- Green: cancellation is distinct from expiry, window countdown uses the effective batch deadline, elapsed pending checkout requires reconciliation, terminal attempts are retryable within the window, and already-paid invoices cannot create checkout.
- Route tests cover valid denied Snap session reuse, paid-invoice rejection and identical supplier-aware materialization in test/runtime.
- Recovery tests cover exact incident identity, deadline equality, deliberate cancellation, financial evidence and invoice/audit mismatch.

## Database and recovery

Migration `20261002000100_payment_continuation_guard` was applied transactionally and recorded in the configured database. It changes no existing rows. It rejects premature registration cancellation, preserves withdrawal and batch cancellation paths, records cancellation reason/source, and ignores late unsuccessful provider events after payment confirmation.

`node tests/database/payment-continuation.mjs <temporary PGlite dist/index.js>` passed six scenario groups using isolated PostgreSQL semantics: effective deadline guard, expire/deny/cancel affecting only the attempt, paid-event monotonicity, reconciliation before deadline cancellation, reason/source audit, and legitimate takedown.

The recovery CLI defaults to a read-only dry-run. The incident passed eligibility and was restored under row locks with an audit request ID. The operation did not alter its invoice, strike count, amount or schedule. Repeating recovery after payment is blocked by eligibility checks.

At 09:53 UTC the live verification found registration and invoice **paid**, provider status **settlement**, payment method **bank_transfer**, paid timestamp **09:50:41 UTC**, and escrow **held**. The transaction log records `payment_status_change → paid`. No payment was initiated or completed by QA automation. A proposed rollback-only cancellation probe matched zero rows because the user had already paid; it is not counted as a live cancellation-guard test.

## Validation

- Unit + migration suite: **146 files / 1,222 tests passed** (live mutation suites excluded).
- TypeScript: `npx tsc --noEmit` passed.
- ESLint: passed with 200 existing warnings, chiefly local Impeccable scripts and existing image/unused-variable warnings; no errors.
- Production build and transaction schema readiness check passed.
- Playwright: **2 tests passed** at 1440 and 390 px with a disposable buyer, intercepted transaction endpoints, 500 ms submit delay, pending button, retry after checkout expiry, no horizontal overflow, and no false success from a Snap callback.
- Screenshots: [desktop](payment-continuation/retry-1440.png), [mobile](payment-continuation/retry-390.png).

Browser transaction responses and Snap were intercepted to avoid financial side effects. The real provider confirmation above was independently observed after recovery. Full staging race/load tests and completing a second real payment are not claimed.

## Operational commands

```powershell
node scripts/recover-payment-continuation.mjs          # dry-run only
node scripts/recover-payment-continuation.mjs --apply  # exact incident; rechecks all blockers
```

The CLI stops when the deadline has passed or financial evidence exists. It never extends a window or restores unrelated cancellations. New deployments must apply the hotfix migration before the application update. Previously pending early-opening migrations remain outside this hotfix.
