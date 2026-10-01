# Early payment opening — design evidence

Disposition: preserves the incumbent Operate UI. The independent finish review records `ship` for the UI only. This document records observed reuse, not a new visual system or deployment acceptance.

## Scope and authority

Read the shipped Impeccable documenter definition and `reference/document.md`, `PRODUCT.md`, the scoped review packet, and `finish-review.md`. This is an ordinary code-led extension with an explicit boundary to preserve design files. `DESIGN.md` and `.impeccable/design.json` are absent and remain absent; `.impeccable/config.json` retains its incumbent `buildPath: comp`. That setting does not override the packet's expressly code-led extension contract. No seed, comp, new creative metaphor, normative token file, sidecar, or generated shipping raster is introduced.

Source samples: `app/globals.css`, `app/layout.tsx`, `components/feedback/feedback.css`, `components/feedback/core.tsx`, `components/feedback/ConfirmDialog.tsx`, `components/supplier-batch/EarlyPaymentPanel.tsx`, `components/orders/EarlyPaymentDecision.tsx`, `components/supplier/catalog/steps/ProductDetailStep.tsx`, `components/supplier-batch/SupplierBatchTransactionCenter.tsx`, and `components/orders/TransactionOverview.tsx`. Relevant incumbent lines were also compared with Git HEAD to distinguish inherited drift. PRODUCT.md, PRD, app code, and configuration were not edited by this pass.

## Actual built evidence

All twelve supplied images were individually inspected: wizard, wizard-target, supplier, supplier-dialog, buyer, and buyer-dialog at 1440 and 390 widths. They show the named content. The full-page mobile captures preserve the fixed navigation at its original viewport position; modal backdrops cover that viewport rather than the whole stitched page. The target viewport captures show the minimum field and helper copy above the mobile navigation. These are capture characteristics, not evidence of a scrolling navigation bar or incomplete runtime modal overlay. No live browser/computed-style inspection was performed by this documenter.

| Durable incumbent pattern | Source evidence | Rendered extension evidence |
| --- | --- | --- |
| Cool slate ground and white surfaces | Global page/background is `#f8fafc`; surface `#ffffff`; muted surface `#f1f5f9`; border `#e2e8f0`; ink `#0f172a`; muted text `#475569`. Scoped components reuse white panels and slate borders/text. | Wizard, supplier and buyer pairs retain the cool page field and white controls/cards. No decorative material or alternate color world appears. |
| Blue actions and semantic feedback | Global brand is `#2563eb`. Existing AsyncButton uses the darker blue-700 action variant, blue-800 hover, and blue-600 focus outline; Progress uses blue-600. Alert reuses blue informational, red error, amber warning and emerald success families. | Supplier opening and buyer assent are blue primary actions; cancellation/previous rules are outlined. Consent is informational blue; stale/lost-response recovery is error red with a clear blue reload action. The darker action shade is incumbent component reuse, not a new palette rule. |
| Newsreader display with Geist interface text | Root layout loads both families. Feedback CSS sets page h1 and state/dialog titles to Newsreader with Georgia fallback, weight 500, tracking -0.025em; h1 is 2rem with 1.15 line height, increasing to 2.5rem at 1024px. Interface/feedback text uses Geist with Arial fallback. | Page and confirmation headings retain the serif character. Early-payment section headings and form labels remain interface text. Dialog titles use the existing 1.5rem role; supporting copy/control text mostly uses the existing 0.875rem role, while form input text is normalized to 1rem by the incumbent stylesheet. |
| Rounded restrained surfaces | New panel, alerts, target input and actions reuse the 0.75rem corner family; native dialog reuses 1rem corners, white fill, 1.25rem mobile/1.75rem larger padding, and existing elevated shadow. Panels use borders and approximately 1.25rem padding. | Extension cards stay flat and separated by borders/space. The modal carries established elevation and a slate backdrop (`rgb(15 23 42 / .5)`), without an ornamental shadow vocabulary. |
| Responsive control and content rhythm | Scoped sections use existing 1rem gaps, existing 1.25rem/1.5rem page rhythms, wrapping actions and responsive grid/stack patterns. Global interactive minimum height is 2.75rem; form controls retain the 44px scale. ConfirmDialog reverses stacked actions on small screens and arranges them horizontally from the existing small breakpoint. | Long labels and descriptions wrap at 390px. Supplier target, collected volume and capacity remain explicit. Mobile primary confirmation/reload is visually first, with a separate return action below. Desktop dialog controls remain grouped at the lower right. |

## Direction contract as implemented

The wizard separates capacity 90 from early-payment minimum 40 and names discount thresholds as a third concept. Supplier evidence separates actual collected 45, target 40 and capacity 100; the target meter deliberately displays 40/40 while the surrounding copy retains the actual 45. Capacity remains its own panel. This is a feature-specific composition, not a proposed global card layout.

Supplier consent reports revision 2 accepted by 2/2 active participants and states that the final assent does not open payment automatically. Existing proposal editing sits in native secondary disclosure; explicit opening uses the established primary button. The supplier review keeps the reviewed 45 kg and Rp 8.000/kg tier 2 even after stale server data, and explains closure of registration/withdrawal, 24 hours from successful closing, and unchanged pickup. The error changes the next action to reading latest transaction data.

Buyer copy allows assent or retention of the previous rules, including no added penalty for rejection/no answer. The lost-response confirmation names read-latest recovery. Source shows recovery calls `onReload` instead of replaying the decision POST. Both surfaces reuse ConfirmDialog, Alert and established Indonesian transactional copy. Native dialog source provides labeled description/title, pending cancellation protection, and opener focus restoration; keyboard and reduced-motion runtime coverage is reported in the packet rather than independently rerun here.

## Incumbent drift not canonized

- The uppercase, letter-spaced capacity eyebrow in SupplierBatchTransactionCenter predates this change (verified in HEAD). It is carried as incumbent craft-floor drift, not documented as a heading rule for new surfaces. The buyer summary also visibly retains an uppercase incumbent label.
- Supplier's text-arrow back affordance predates this change (verified in HEAD). It is not elevated into an icon convention; the new feedback surfaces use existing SVG icons from the component library.
- Supplier order rows/cards display the generic word `unit` while the nearby batch is in kg (source and HEAD agree; captures show 20/25 unit against 45 kg). This is inherited copy drift, not a visual-system decision.
- Buyer schedule/withdrawal cards retain unqualified border color and visibly darker outlines than neighboring slate-border panels. Their unqualified border classes are present in HEAD. No new dark-border token is inferred to legitimize that difference.

These items were reported without repair because the requested pass is documentation of an ordinary extension, with app code and system files explicitly outside its write boundary. The changed early-payment surfaces do not introduce an eyebrow, glyph icon substitute, hard offset shadow, or system display face.

## Evidence limits and preservation

The supplied detector result is empty; no additional detector pass was run. The packet reports 188 non-live files/1453 tests, final related 42 tests, eight browser tests, TypeScript/build passing, lint with zero errors/200 pre-existing warnings, and 44 isolated PostgreSQL checks. Those are supplied implementation evidence, not results rerun by this documenter.

The migration remains undeployed. The 44 SQL checks run actual migration/RPC code in isolated PostgreSQL WASM with a modeled incumbent schema; they do not establish Supabase/staging acceptance or true multi-connection race safety. Disposable-auth UI requests use intercepted transaction fixtures, and their visibly test-named businesses/products are not commercial claims. PNGs remain QA evidence; no generated raster asset ships with this extension.

Only this evidence report was written. PRODUCT.md, absent DESIGN.md/sidecar, config, private PRD and all application sources remain preserved by this documentation pass.
