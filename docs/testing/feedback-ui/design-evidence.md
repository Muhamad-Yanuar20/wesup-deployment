# Feedback UI design evidence

Date: 1 October 2026. Scope: ordinary refinement and extension of the incumbent Wesup UI under the approved feedback plan. This is an implementation evidence record, not a replacement visual system or token specification.

## Comparison with the incumbent

The finished feedback architecture preserves the Newsreader/Geist pairing and existing blue, slate and white vocabulary. Root CSS still defines the page (#f8fafc), surface (#ffffff), ink (#0f172a), border (#e2e8f0) and brand (#2563eb) values. Feedback uses those variables or existing Tailwind tonal families, with semantic emerald, amber and red states already represented in the incumbent palette. It does not introduce an identity, a new font family or a global token ramp.

Source comparison found no diff in `app/page.tsx`, `app/globals.css`, `components/landing` or `lib/landing`. The root layout diff adds the prior navigation session provider and server access-state initialization; its font definitions and variables are unchanged. Landing source demonstrates the same Newsreader display, Geist supporting text, blue actions, white surfaces and slate copy. Feedback turns those materials into quieter operational screens, without promoting the landing scene, translucent hero layers or ornamental labels into required application patterns.

`DESIGN.md` and `.impeccable/design.json` are absent and remain absent. The shipped documenter definition distinguishes ordinary extensions from approved system changes, and this task authorizes only this evidence file. No design-system generation, drift repair, PRD, config or app edit was performed by this documentation pass.

## Observed reusable architecture

| Source | Reusable contract observed |
|---|---|
| `components/feedback/core.tsx` | Controlled Alert, InlineStatus, Spinner, AsyncButton, Skeleton/ContentSkeleton, Progress, EmptyState, ErrorState, SuccessState, UnavailableState and FieldFeedback. No client directive or hook-owned lifecycle; renderable from server components when props permit. |
| `components/feedback/ConfirmDialog.tsx` | Client-owned native dialog lifecycle, accessible name/description, focus return, safe initial cancel focus and pending dismissal prevention. Mutation error remains at the decision point. |
| `components/ui/GlobalToast.tsx` | Existing single client provider, ID deduplication, update/dismiss, maximum three items, stable remaining-time accounting, pause on hover/focus/hidden document, persistent action toast. |
| `lib/feedback/use-resource.ts` | Client GET-only lifecycle, AbortController and generation checks, no-store reads, stale-response suppression, last confirmed data retained on failed refresh. |
| `lib/feedback/errors.ts` | Shared transport/error normalization, status/code/request ID preservation, Indonesian fallback messages, technical text suppression and cross-realm abort identification. Field feedback is wired separately by feature forms. |

Server route layouts retain access decisions. Marketplace wraps the shared application shell; UMKM awaits access state, admits suspended UMKM for recovery and renders a client shell that treats onboarding specially; supplier retains its approved-supplier server guard and existing navigation/footer. Admin pages retain server access guards and assemble the sidebar/header locally. The root session provider remains baseline navigation work. Feedback does not add a global modal/loading store or move authorization to a visual component.

Branch loading/error boundaries use reusable skeleton/error components and client `unstable_retry()` callbacks. They preserve their branch shell where that shell is above the boundary; an error boundary within a branch does not catch its own ancestor layout's asynchronous guard.

## Scoped visual and responsive rules

`components/feedback/feedback.css` scopes interface typography to `.wesup-app` and `.wesup-feedback`; `.wesup-state-title` selects explicit state headings. Application h1 uses Newsreader at weight 500, tracking -0.025em, balanced wrapping, 2rem/1.15 below 1024px and 2.5rem above it. State headings use the same family; full states use 1.5rem, growing to 1.875rem at the small breakpoint, and embedded states use 1.25rem. Body, forms, alerts and buttons remain Geist. Application text inputs/selects/textareas are 1rem; tables, definition data and timers use tabular numerals. The scope darkens application slate-400 text to #64748b without changing the root palette.

White, lightly bordered operational surfaces sit on pale slate backgrounds. Async buttons use existing blue-700/800 with white text, a 44px minimum height, rounded 12px corners, visible focus and local disabled/pending treatment. Full state surfaces use 16px corners and generous padding; alerts and toast items use 12px corners and 16px padding. Dialogs use white 16px corners, a soft shadow and slate translucent backdrop. This is observed component use, not a new universal radius or spacing scale. The embedded state option removes the redundant inner frame in finance history and Admin catalog error.

Desktop/tablet forms use grids when space permits and stack on narrow screens. Shared shells reserve mobile bottom space for fixed navigation. Toasts sit above that navigation at `5.5rem + env(safe-area-inset-bottom)` with 1rem side insets; from 1024px they sit at the bottom right, up to 24rem wide. Dialogs fit viewport width minus 2rem and cap height at `100dvh - 2rem`, scrolling internally. Admin layout changes from a column to a row at the medium breakpoint; the sidebar adapts its mobile presentation.

The final sampled wizard and mobile finance-dialog captures show the serif heading/sans controls pairing, readable blue/slate hierarchy, local field and dialog errors, and mobile button stacking. Heading kickers were removed from login/new-offer/order. Their removal does not establish a system-wide ban on incumbent landing labels.

## Accessibility and lifecycle contracts

- Error states and error alerts announce with `role="alert"`; informational, success, empty and unavailable feedback use status semantics. Decorative Lucide icons are hidden from assistive technology. Skeleton visuals are hidden; the container supplies an accessible loading label/status and busy state.
- AsyncButton prevents another activation while pending, exposes `aria-busy` and retains explicit pending text. Reduced motion removes decorative feedback animation while leaving text and state intact.
- Dialogs use native `showModal()` with labelled title/description, restore the opener on close/unmount, prevent Escape and disable close/cancel while pending. Errors remain inside the dialog; confirmation copy names the amount/recipient or consequence.
- Progress exposes bounded numeric values and text based on completed photo preparation, not invented network byte progress. Fields retain label/hint/error associations; invalid wizard submission focuses the invalid field.
- Initial loading, confirmed data, refresh, empty, error and uncertain mutation outcomes remain distinct. Failed refresh retains confirmed content, abort is silent, and empty follows a successful read. Feature mutations stay local, retain input/evidence on failure and do not retry automatically through the GET hook.
- Payment remains authoritative on the server; a provider callback does not prove payment. Four automatic status checks at 15-second intervals remain the budget. The visible payment closing label now reads `paymentClosesAt`, while a waiting-window countdown can still target opening time. Per-second countdown text is not live-announced.
- Local draft recovery stays explicit and isolated; a new offer starts clean. No-show/suspension recovery and confirmed server outcomes determine available actions. Finance failure is not displayed as a zero balance, and unavailable modules do not invent demo data.

## Evidence checked and limits

Read: `PRODUCT.md`, the shipped documenter definition, the full `reference/document.md`, review packet, TDD evidence, scoped/global CSS, root/branch layouts, shared shell, feedback primitives/dialog/toast, resource/errors, final finance/Admin/payment/login/new-offer/order source selections, and landing source selections. Git source comparison above was checked directly. Opened final `wizard-1440.png` and `finance-dialog-390.png` in this pass; the full four-width set is catalogued in the review packet and was inspected by the builder/reviewer, not independently reopened in its entirety here.

Existing logs checked directly record 185 non-live test files and 1,425 passing tests; five feedback browser tests at 1440/768/390/320 widths plus zoom; and six navigation/draft browser regressions. Build log shows completed output; the TDD report records passing TypeScript and build checks and lint at zero errors with 200 baseline warnings. This documentation pass did not rerun tests. These checks support the implementation record, not a WCAG certification or a live provider/payment/camera/upload/transfer guarantee.

Browser finance/order/Admin operations used fixtures; actual financial or dispute mutations were not exercised. The six detector candidates concern dark hover copy on blue tint, functional scanner corners and a dispute timeline; they do not establish new accent-card rules. No raster assets were generated. Full-page dialog captures show backdrop coverage at the captured viewport and fixed navigation at that viewport's bottom; this is a capture limitation. The unsettled `landing-before.png` is invalid as a pixel golden. Landing preservation is supported by unchanged source and selector scope; pixel equivalence is not claimed.

The final `finish-verdict.md` was read directly: disposition **ship**, with payment closing timestamp, heading kickers and nested state frames resolved, and no correction-batch regressions identified in the scored surfaces. Its reviewer reopened all 28 required images and zoom200; screenshot aliases matched the recaptured wizard originals. This verdict covers that scored fix list, not a fresh whole-surface audit. The testing server was stopped after verification, as reported by the builder.

Not canonized or repaired: pre-existing landing kickers/decorative conventions and incidental per-page gray/size utility variation are not promoted into feedback-system requirements; ordinary extension authority does not authorize incumbent drift repair.
