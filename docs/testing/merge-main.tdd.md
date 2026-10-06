# Main merge regression evidence

Implementation head: 85b06cf. Remote main integrated: bd66bc3. Merge: d4e3369.

## Failure observed before repair

The textual merge completed, but TypeScript failed on orphan catch blocks in supplier approval and dispute resolution, a handler fragment in user ban, and an extra closing brace in supplier registration. The original compile log is retained privately in .codex/push-main-backup/typecheck.log. Regression additionally caught a changed rejection-error contract (1696 passing, one failure); the handler now preserves the original message.

## Repairs

Preserved the incoming admin UI. Restored authenticated transactional RPC handlers for approval, rejection, takedown, dispute resolution and account controls. Added queue decision and refund response adapters without replacing existing API contracts. Protected new admin queue reads with role checks and rate limiting. Both incoming URL aliases now delegate to the authenticated takedown / signature-validated Midtrans handlers. Replaced nonexistent dispute/refund relationships with joins through registrations. Removed .env.local from tracking; local configuration remains in place. No database mutation was needed for this merge.

## Verification

- Vitest: 189 files, 1707 tests passed, including live integration and migration contract suites.
- New regression cases cover three dispute decisions, refund queue formatting, and denied/rate-limited access before service-role reads.
- ESLint: zero errors, 200 warnings.
- Playwright on the existing localhost:3000 server: four transaction session guards passed. The initial default-port run could not start a second dev server; reran against the existing server successfully.
- Production build and schema readiness preflight passed.
- Payment journey evidence remains in payment-clarity-capacity.tdd.md and evidence/payment-clarity; these session guard checks are supplementary, not a repeat of the sandbox payment journey.

PRD edits, local package-lock changes, private backups and user tooling files are excluded from this repair commit. Pull main again before pushing; do not force-push.
