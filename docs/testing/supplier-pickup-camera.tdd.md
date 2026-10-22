# Supplier navigation, account, footer and QR pickup — 22 October 2026

Authority: approved in-chat implementation plan. Branch `codex/supplier-pickup-camera`, base `f44fa3e`. No automatic commit/push. Preserve API contracts, payment/escrow rules, landing and Admin.

## Execution ledger

- Inline implementation in the configured checkout on a feature branch; this document is the persistent Windows ledger.
- Shared interfaces: validated `returnTo` is propagated by Supplier links; QR v1 carries registration ID and opaque server token; camera decodes only, explicit confirmation retains existing API; Footer variant defaults to the existing full footer.
- RED: 3 regressions failed (Supplier footer links, account placeholder, simulated scanner). GREEN: first 5 tests passed after implementing these surfaces.
- Independent review found two P2 issues: order identity change followed by failed fetch could leave an endless skeleton; scanner toolbar navigation could lose the nested Orders origin. Added failing regressions, fixed both, and verified GREEN. Follow-up review found no new actionable issues.
- Actual browser verification exposed a preexisting QR rendering race: the timer reset erased a QR when encoding completed quickly. A focused regression failed before replacing the timer with seed-keyed async results, then passed. Both stale response guards and consumed-code rendering remain in place.

## Verification

| Check | Final result | Evidence |
| --- | --- | --- |
| `npm test` | 234 files / 2152 tests passed | [tests.log](supplier-pickup-camera/tests.log) |
| `npm run lint` | Exit 0; 0 errors, 14 existing warnings | [lint.log](supplier-pickup-camera/lint.log) |
| `npx tsc --noEmit` | Exit 0 | Explicit final command following build |
| `npm run build` | Exit 0, including read-only schema preflight | [build.log](supplier-pickup-camera/build.log) |
| Browser | 3 journeys passed: four-width account/footer, navigation chain, real decoder camera + PIN handover | [browser.log](supplier-pickup-camera/browser.log) |

The camera journey uses two disposable UMKM accounts on one batch, obtains idempotent credentials concurrently, rejects order A's QR token for order B, renders the actual buyer QR PNG, feeds those pixels through a canvas video stream to the real ZXing decoder, verifies automatic order selection and stopped tracks, then explicitly confirms. Double-click produced one POST, one pickup event and one escrow row. Reloading the buyer page hides consumed QR/PIN. The second buyer's PIN also completed handover successfully.

Account and scanner assertions cover widths 320, 390, 768 and 1440, page overflow, keyboard focus and confirmation target height. Reduced-motion browser runs retain the content. Component tests cover denied camera permission, late media resolution after cancellation, track cleanup, invalid/cross-batch QR, lost confirmation response reconciled by a read without resending, optional profile fields, failed profile reads, owner filters, footer isolation, and QR codec/navigation validation. Existing transaction tests retain policy v1/v2 eligibility coverage; this change makes no RPC/schema/transaction-rule edits.

Fixture setup initially failed on the valid policy-v2 schedule lock, then the closed-registration gate; fixture construction now seeds an open legacy fixture, its registrations and timeline before switching the isolated final snapshot to policy v2. No triggers or constraints were disabled. Application login throttling also rejected repeated fixture logins, so fixtures establish SSR cookies from their own signup sessions without changing application rate limits. Teardown deletes only these fixtures and their pickup/escrow dependencies. Final read-only audit found zero matching fixture users remaining.

Screenshots are deliberately copied after tests, with reduced motion and scroll reset for fixed navigation: [account desktop](supplier-pickup-camera/account-1440.png), [account mobile](supplier-pickup-camera/account-320.png), [scanner desktop](supplier-pickup-camera/scanner-1440.png), [scanner mobile](supplier-pickup-camera/scanner-320.png), [confirmed pickup](supplier-pickup-camera/camera-confirmed.png). These are disposable test identities, not real customer data. Historical baselines were not overwritten.

## Environment and limits

Live tests require the configured Supabase/Upstash/DATABASE_URL environment and installed Playwright Chromium. Verification uses production `next start` on temporary port 3001; the user's port 3000 server is left untouched. The new camera policy is scoped to `/supplier/batch/:id/pickup`; other pages retain camera denial. Camera access requires HTTPS or localhost. Camera hardware/permission behavior on a physical Android/iOS device over HTTPS has not been manually verified; virtual video frames exercise the real decoder and API, while permission failures are component-tested.

`@zxing/browser` is lazy-loaded only on camera activation. No new endpoint, pickup API shape, migration, Admin/landing redesign, or private PRD change is included. Work is local on `codex/supplier-pickup-camera`; no commit/push performed.

## Self-evaluation

Delivery update: the user subsequently requested commit and push to `main`; remote main matched base `f44fa3e` before delivery.

Overall 4.0/5. Accuracy 4: whole suite, live QR/PIN API, actual image decoding and database counts agree; physical camera verification remains a separate step. Completeness 4: all four requested areas and selected edge cases are covered; hardware/browser combinations are not exhaustive. Clarity 4: explicit order preview and destination labels clarify actions; PIN remains order-bound rather than globally unique. Actionability 4: scripts/logs/screenshots support reproduction with the project's environment. Conciseness 4: evidence is centralized here, with a short user-facing completion report.

Highest-impact follow-up: manual physical-device HTTPS camera smoke test; then add browser permission-denial coverage beyond the component tests. Would the user agree? The requested end-to-end handover is demonstrated automatically; physical-device acceptance remains distinct from that evidence.
