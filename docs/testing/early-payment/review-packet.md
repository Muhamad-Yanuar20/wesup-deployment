# Early payment opening — finish review packet

Project root: C:/Users/hpyan/Project/wesup. Ordinary extension of existing Operate UI; code-led, no approved visual comp. Preserve landing, PRODUCT.md, DESIGN/config files, PRD, and unrelated local work. Read PRODUCT.md and incumbent UI for identity. No new shipping rasters; PNGs here are QA evidence, not assets.

## Brief and direction contract
Supplier can manually open payment once independent configured minimum volume is met. Existing participant offers need unanimous active-participant consent. Last assent never opens payment. Actual server close locks price, stops joins/withdrawals, issues invoices, gives 24 hours to pay; pickup stays fixed. New offer target defaults to capacity but can be lower, never above capacity.

THESIS: distinguish minimum target, maximum capacity and tier thresholds so supplier can decide deliberately.
OWN-WORLD: incumbent white/slate surfaces, blue primary action, Newsreader page heading, Geist forms and controls; native dialogs and existing feedback primitives.
STORY: set target; monitor volume/consent; review price and consequences; explicitly open. Buyer can agree or keep original rules.
FIRST VIEWPORT: page context then payment/pickup timeline, early-opening section and capacity separately. Target editing is secondary disclosure once proposal exists; open is primary.
FORM: local extension, no seed/comp required. Native control and confirmation language preserve existing identity.
FINISH: independent finish review and documentation of evidence, preserving incumbent design files. No generation/provenance work applies.

## Required screenshot matrix
All files absolute beneath C:/Users/hpyan/Project/wesup/docs/testing/early-payment/:
- wizard-1440.png, wizard-390.png: full page new offer, capacity 90 and explicit minimum 40.
- wizard-target-1440.png, wizard-target-390.png: viewport capture of target control centered above fixed mobile navigation.
- supplier-1440.png, supplier-390.png: pending proposal revision 2 unanimously accepted 2/2, active volume45, target40, capacity100, two coherent rows20+25.
- supplier-dialog-1440.png, supplier-dialog-390.png: immutable reviewed volume45/price8000, server now volume46 ->409, GET recovery button.
- buyer-1440.png, buyer-390.png: existing-order proposal waiting for buyer decision.
- buyer-dialog-1440.png, buyer-dialog-390.png: lost mutation response, read-latest decision recovery (one POST only).
Full-page mobile images include the fixed bottom navigation at the original1000px viewport position; the dialog backdrop covers its original viewport. These capture artifacts do not mean the nav scrolls with content. Viewport target images clarify control visibility. Inspect all required images; no browser available in reviewer.

## Implementation and evidence
New components components/supplier-batch/EarlyPaymentPanel.tsx and components/orders/EarlyPaymentDecision.tsx. Modified wizard ProductDetailStep/OfferWizard, JoinBatchForm, SupplierBatchTransactionCenter, TransactionOverview. Existing ConfirmDialog protects pending Escape, restores focus and traps keyboard through native dialog.
Detector ran once over five targeted UI files; docs/testing/early-payment/detector.json=[] (no findings). Own bounded desktop/mobile batch corrected primary hierarchy and fixture rows, then confirmation captures. No system redesign.
Tests:188 non-live files/1453 tests passed; final related42 tests passed after hierarchy correction;44 isolated PostgreSQL checks including invoice rollback and auth/RLS;8 browser tests1440/390, delayed requests, stale data, lost response, keyboard, reduced motion plus nav/draft regression. TypeScript/build pass; lint0errors200pre-existing warnings.
Database migration is NOT deployed. SQL tests execute actual migration/RPCs in isolated PostgreSQL WASM with a modeled incumbent schema, not full Supabase/staging or true multi-connection race validation. No staging credentials available. Production transaction requests are intercepted during disposable-auth browser QA; auth fixtures removed.

## Review boundaries
Review actual UI/copy/behavior and accessibility from screenshots and changed files, not production rollout. Report capture validity separately from build findings; required five sections and disposition ship/fix/recapture/rebuild. Write only docs/testing/early-payment/finish-review.md; no code fixes or design-system edits. Avoid expanding into unrelated baseline admin/finance/landing work. Backend deployment limitations are explicit and should not be dressed as staging acceptance.
