# Feedback UI finish review packet

Project: C:/Users/hpyan/Project/wesup
Mode: Operate; ordinary refinement/extension of the incumbent UI. Code-led; no approved comp, no replacement world, no quality-board round needed for this bounded approved plan.

User request: implement the approved feedback UI plan throughout non-landing Wesup. Preserve landing source/fonts/global tokens, local user changes, private PRD, prior navigation and draft isolation fixes. Use Newsreader page/state headings, Geist body/forms, existing blue/slate/white palette. No new public APIs, database migrations, Server Actions, UI framework, or global modal/loading store.

Acceptance: reusable feedback primitives; existing single toast provider with stable timer, pause/dedupe/dismiss; native accessible confirmation dialogs; separate initial loading, data, refreshing, empty, error, uncertain mutations. Keep stale data/input on failures, friendly Indonesian copy and retry, no fake balances/empty states/success from provider callbacks, one primary result per mutation. Confirm logout and important supplier/Admin/money changes. Explicit local draft resume; clean new offer; stable identity on lost save; measured photo preparation progress; suspended UMKM can recover transactions. Preserve payment polling budget (four automatic checks, 15s), guards and authoritative server state. Scope styles to non-landing. Branch loading/error boundaries use installed Next16.2 unstable_retry().

First viewport: clear page identity and task; white surfaces on slate-50, Newsreader primary title, readable Geist controls, blue action and persistent state-specific error/warning. Local pending action does not blank unrelated content. Mobile stacks forms, fixed bottom navigation and toast safe area; Admin sidebar collapses on small widths.
Signature behavior: last confirmed content stays visible during refresh failure; local action progress/error remains at its decision point; dialog returns focus and cannot be dismissed while pending. Reduced motion preserves text without decorative animation.

Read PRODUCT.md and .agents/skills/impeccable/reference/craft-floor.md. Follow your shipped definition .agents/skills/impeccable/agents/impeccable_finish_reviewer.toml. Do not edit product files, PRD, configs, app code, or screenshots. You may write docs/testing/feedback-ui/finish-review.md. Return your required contract sections and disposition.

Code artifact: components/feedback; components/ui/GlobalToast.tsx; lib/feedback; changed app/components/lib files visible via Git diff. Prior root session/new-draft changes are baseline, not permission to revert user edits. Tests: 185 non-live files, 1424 tests pass; tsc passes; build passes; lint 0 errors/200 baseline warnings. Browser 5 tests pass (four widths and zoom200), real disposable auth fixtures cleaned; finance/order/Admin API interactions intercepted, no actual transfer/payment mutation. Browser validates retry, retained stale order, invalid wizard focus, pending Escape prevention, keyboard and focus restoration, offline and reduced motion.

Screenshot evidence below: all required states at all four widths, captured at document top with reduced motion/animations disabled, opened and verified by builder. Native dialog backdrop covers viewport only in full-page capture; floating nav remains at viewport bottom, intentionally so. .impeccable/review/desktop.png, mobile.png, user-768.png, user-320.png copy wizard captures. Landing-before.png was captured before settling and is INVALID as a pixel golden; do not use it. Landing-after.png is a reduced-motion reference only. Landing source/global CSS/landing components have no diffs; no pixel-equivalence claim.

Detector ran once: docs/testing/feedback-ui/detector.json (6 findings). All require contextual evaluation: SupplierRegistrationForm gray-on-color is hover slate-700 on blue-50, dark contrast; PickupScanner borders are functional scanner corner guides (4 flags); UmkmOrderDetail border-l-2 is dispute timeline (not accent card). No raster assets generated, so asset provenance scan is inapplicable.

Required screenshot paths:
- C:\Users\hpyan\Project\wesup\docs\testing\feedback-ui\finance-error-1440.png
- C:\Users\hpyan\Project\wesup\docs\testing\feedback-ui\finance-1440.png
- C:\Users\hpyan\Project\wesup\docs\testing\feedback-ui\finance-dialog-1440.png
- C:\Users\hpyan\Project\wesup\docs\testing\feedback-ui\wizard-1440.png
- C:\Users\hpyan\Project\wesup\docs\testing\feedback-ui\admin-1440.png
- C:\Users\hpyan\Project\wesup\docs\testing\feedback-ui\order-1440.png
- C:\Users\hpyan\Project\wesup\docs\testing\feedback-ui\login-1440.png
- C:\Users\hpyan\Project\wesup\docs\testing\feedback-ui\finance-error-768.png
- C:\Users\hpyan\Project\wesup\docs\testing\feedback-ui\finance-768.png
- C:\Users\hpyan\Project\wesup\docs\testing\feedback-ui\finance-dialog-768.png
- C:\Users\hpyan\Project\wesup\docs\testing\feedback-ui\wizard-768.png
- C:\Users\hpyan\Project\wesup\docs\testing\feedback-ui\admin-768.png
- C:\Users\hpyan\Project\wesup\docs\testing\feedback-ui\order-768.png
- C:\Users\hpyan\Project\wesup\docs\testing\feedback-ui\login-768.png
- C:\Users\hpyan\Project\wesup\docs\testing\feedback-ui\finance-error-390.png
- C:\Users\hpyan\Project\wesup\docs\testing\feedback-ui\finance-390.png
- C:\Users\hpyan\Project\wesup\docs\testing\feedback-ui\finance-dialog-390.png
- C:\Users\hpyan\Project\wesup\docs\testing\feedback-ui\wizard-390.png
- C:\Users\hpyan\Project\wesup\docs\testing\feedback-ui\admin-390.png
- C:\Users\hpyan\Project\wesup\docs\testing\feedback-ui\order-390.png
- C:\Users\hpyan\Project\wesup\docs\testing\feedback-ui\login-390.png
- C:\Users\hpyan\Project\wesup\docs\testing\feedback-ui\finance-error-320.png
- C:\Users\hpyan\Project\wesup\docs\testing\feedback-ui\finance-320.png
- C:\Users\hpyan\Project\wesup\docs\testing\feedback-ui\finance-dialog-320.png
- C:\Users\hpyan\Project\wesup\docs\testing\feedback-ui\wizard-320.png
- C:\Users\hpyan\Project\wesup\docs\testing\feedback-ui\admin-320.png
- C:\Users\hpyan\Project\wesup\docs\testing\feedback-ui\order-320.png
- C:\Users\hpyan\Project\wesup\docs\testing\feedback-ui\login-320.png
Supplemental: C:\Users\hpyan\Project\wesup\docs\testing\feedback-ui\login-zoom200.png
