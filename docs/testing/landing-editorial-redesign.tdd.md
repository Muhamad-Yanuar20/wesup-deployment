# TDD Evidence Report — Editorial Luxury Landing Redesign

**Task:** Redesign the landing page below the animated hero in an "Editorial Luxury" style (gilt plates, hairline rules, ledger typography, ivory/kraft accents) while keeping the scroll-scrubbed WebGL scene (`HeroScene`) byte-intact — only its `BEATS` overlay copy and overlay chrome styling were in scope. Replace the generic marketing sections (bento grid, step cards, closing CTA, footer) with a restrained, non-templated composition using the existing design system: Newsreader display type, Geist body, Geist Mono indices, existing slate/emerald/blue palette, lucide icons restyled with lighter strokes instead of a new icon library, and a custom IntersectionObserver `Reveal` primitive instead of framer-motion.

**Source plan:** No `*.plan.md` — plan produced in-session from the `high-end-visual-design` skill and approved by the user. Product facts trace to `prd/PRD.md` (volume tiers, cutoff price locking, 24h escrow, self-pickup in Bandung). PRD-adjacent decisions in this task were confirmed by the user: production CTA copy stays `Lihat Penawaran` (the stale e2e selector was updated instead), and hero scope is copy + chrome only.

## User journeys

1. As a visitor, I want the value proposition in the hero and a legible editorial account of the offer below it, so the page reads like a considered product, not a template. (manifest ledger, steps index, bento)
2. As a returning visitor, I want the hero CTA `Lihat Penawaran` to keep working exactly as before, so nothing regresses. (e2e selector updated, href unchanged)
3. As a screen-reader user, I want exactly one `h1` on the landing page, so the document outline is valid. (`sr-only` h1 added; hero beat titles stay `h2`)
4. As a user with reduced motion, I want content to be visible without waiting for observers, so motion never gates readability. (`Reveal` fails open)
5. As a user with IntersectionObserver unavailable (or during SSR), I want all content visible, so the page degrades to a plain readable document. (fail-open contract)
6. As an operator, I want the WebGL hero, its wash geometry, CSP nonce contract, and scroll timeline untouched, so the scene regression suite keeps guarding them. (verified green)

## Task report

| Plan task | Execution summary | Validation command | Result |
|-----------|-------------------|--------------------|--------|
| Reveal component (RED first) | Wrote `tests/components/Reveal.test.tsx` — 8 tests: hidden→shown on intersect, never intersects stays hidden, IO callback disconnects after reveal, immediate reveal under `prefers-reduced-motion` without constructing an observer, fail-open with no `IntersectionObserver`, reduced-motion/generic `matchMedia` stubbing. | `npx vitest run tests/components/Reveal.test.tsx` | **RED** — `Cannot find module '@/components/landing/Reveal'` |
| `components/landing/Reveal.tsx` | Fixed-position-free wrapper: `data-reveal="hidden"/"shown"`, transforms/opacity/filter only, rootMargin `-8%`, threshold 0.1, disconnects after reveal, `queueMicrotask` deferral for the reduced-motion/no-IO path. | `npx vitest run tests/components/Reveal.test.tsx` | **GREEN** 8/8 |
| Design tokens + grain (`app/globals.css`) | Added `--color-wesup-ivory: #f7f5ef`, `--color-wesup-kraft: #d9c7a4` to `@theme inline`; appended `.wesup-grain` (fixed, z-40, pointer-events-none, SVG feTurbulence) and `.wesup-reveal` states (850ms `cubic-bezier(0.22,1,0.36,1)`, transform/opacity/filter only). The `.hero-scene*` block was not edited. | `git diff app/globals.css` | PASS — grain/reveal appended; zero `.hero-scene*` hunks |
| `BEATS` copy rewrite | Editorial voice for all six beats in `lib/landing/scene-timeline.ts`; ids, `at` values, indexes, chip-on-`03` preserved; escrow still mentioned exactly once. | `npx vitest run tests/unit/landing-beats.test.ts tests/unit/landing-beat-phase-contract.test.ts tests/components/HeroScene.test.tsx` | PASS — contract suites green |
| HeroScene overlay chrome | Visual-only: eyebrow hairline → ink, chip/meter refinement, primary CTA → ink pill, secondary → hairline/white, lighter icon strokes. Every class name, hook, and copy string asserted by tests untouched. | `npx vitest run tests/components/HeroScene.test.tsx` | PASS 20/20 |
| `app/page.tsx` rewrite | Fixed hairline header (keeping `container mx-auto … px-4 sm:px-6 lg:px-8` scene alignment and `aria-label="Navigasi utama"`), grain overlay, `sr-only` h1, `HeroScene` in place, manifest ledger (double-bezel `dl`), `#cara-kerja` steps index (`<ol>` + `li` wrapping `Reveal`), `#features` asymmetric bento (ink lead card, kraft strip), closing ink slab CTA (no nested buttons), footer. `await connection()` retained. | `npx eslint app/page.tsx`, `npx tsc --noEmit`, `npm run build` | PASS |
| e2e selector update | `tests/e2e/umkm-flow.spec.ts`: `/mulai belanja \(umkm\)/` → `/lihat penawaran/i` per user decision (CTA copy stays production). | `npx playwright test tests/e2e/umkm-flow.spec.ts --grep "Lihat Penawaran"` | PASS — 11.9s, no 404 |
| Full verification | — | see Verification matrix below | see below |

## Test specification

| # | What is guaranteed | Test file | Test type | Result |
|---|--------------------|-----------|-----------|--------|
| 1 | `Reveal` renders content hidden, then shown once any part intersects | `tests/components/Reveal.test.tsx` | component | PASS |
| 2 | A never-intersecting element stays hidden (no premature reveal) | `tests/components/Reveal.test.tsx` | component | PASS |
| 3 | Observer disconnects after the first reveal (no leaks) | `tests/components/Reveal.test.tsx` | component | PASS |
| 4 | `prefers-reduced-motion` ⇒ shown without constructing an observer | `tests/components/Reveal.test.tsx` | component | PASS (asserted after microtask flush) |
| 5 | Missing `IntersectionObserver` ⇒ fail-open to shown | `tests/components/Reveal.test.tsx` | component | PASS (asserted after microtask flush) |
| 6 | Six beats, ids/indexes/`at` ascending from 0, chip only on `03` | `tests/unit/landing-beats.test.ts` | unit | PASS |
| 7 | `BEATS[i].at` matches scene phase thresholds exactly | `tests/unit/landing-beat-phase-contract.test.ts` | unit | PASS |
| 8 | Escrow mentioned exactly once across beats; CTA names/hrefs intact | `tests/components/HeroScene.test.tsx` | component | PASS |
| 9 | `app/page.tsx` keeps `next/server` + `await connection()` | `tests/unit/csp-nonce-page-contract.test.ts` | unit | PASS |
| 10 | Wash geometry pinned at all breakpoints; canvas/CSP mount | `tests/e2e/hero-scene.spec.ts` | e2e | PASS 6/6 |
| 11 | Landing has exactly one reachable `h1`; CTA lands on `/marketplace` without 404 | `tests/e2e/umkm-flow.spec.ts` (Landing describe) | e2e | PASS 1/1 |

## Verification matrix

| Gate | Command | Result |
|------|---------|--------|
| Lint (repo) | `npm run lint` | PASS — 0 errors (12 pre-existing warnings in unrelated test files) |
| Typecheck | `npx tsc --noEmit` | PASS — 0 errors |
| Unit/component | `npx vitest run` | 1636 passed / 1 failed — the failure is `tests/live/database.integration.test.ts` (live Supabase enum drift, unrelated to this task, pre-existing) |
| Landing contract suites | `npx vitest run tests/components/Reveal.test.tsx tests/components/HeroScene.test.tsx tests/unit/landing-beats.test.ts tests/unit/landing-beat-phase-contract.test.ts tests/unit/csp-nonce-page-contract.test.ts tests/unit/scene-timeline.test.ts` | PASS 65/65 across 5 files |
| Build | `npm run build` | PASS |
| E2E (landing) | `npx playwright test tests/e2e/hero-scene.spec.ts tests/e2e/umkm-flow.spec.ts` | hero-scene 6/6 PASS; landing CTA 1/1 PASS |

### Pre-existing failures proven not to originate from this task

`tests/e2e/umkm-flow.spec.ts` reports 21 failures beyond the landing describe (marketplace category filter, orders/payment window, pickup credentials, ratings, disputes, notifications, navigation guards). To attribute them, the working tree was stashed to clean HEAD (`git stash push -u`) and the same suite re-run: **the identical set of tests fails at HEAD** with identical errors (e.g. `filter kategori + reset` still finds no `a[href^="/marketplace/"]` containing `daging & ikan` — test-data/environment drift, not markup). My changes touch only landing files, which those tests never load except through the `/pesanan` `NavigationBar` (untouched).

## Defects found by the tests during this task

1. **`Reveal` called `setState` synchronously inside its effect** — flagged by `react-hooks/set-state-in-effect` on the reduced-motion/no-IO path. Fixed by deferring with `queueMicrotask` (flushes before paint, so the flip stays imperceptible) and updating the two affected tests to assert after the flush. Behavior contract unchanged: fail-open, no observer constructed under reduced motion.
2. **Stale CTA selector in e2e** — `umkm-flow.spec.ts` still looked for `Mulai Belanja (UMKM)`, which the scene's CTA rename had already made stale. Resolved with the user's decision: update the selector to `Lihat Penawaran` (production copy wins), verified by the landing CTA e2e test.
3. **Pre-existing type error blocked `npm run build`** — `lib/admin/validation.ts:162` (`'input' is possibly 'null' or 'undefined'`, file untouched by this task, likely latent behind a stale incremental cache). Fixed with a behavior-preserving narrowing: the early return condition became `input == null || Object.keys(fieldErrors).length > 0` — when `input` is null, line 115 always records a `batchId` error, so the same response object is produced as before.
4. **Stale generated types after `.next` regeneration** — `next typegen` had to be re-run (`.next/dev/types/validator.ts` contained syntax errors from a prior interrupted dev run) before `tsc --noEmit` could report real errors.

## Notes / follow-ups

- The 21 pre-existing `umkm-flow` e2e failures (marketplace fixture data, login-state cascades) are out of scope here but should be triaged separately.
- `tests/live/database.integration.test.ts` fails on dispute/refund enum drift against the live Supabase instance — pre-existing, unrelated.
- `skills-lock.json`, `.agents/skills/high-end-visual-design/`, and `.claude/` are environment/skill artifacts, not application code.
