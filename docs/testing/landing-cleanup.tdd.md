# TDD Evidence Report — Landing Cleanup Pass (Review Findings)

**Task:** Execute the nine-step cleanup plan produced by code review of the uncommitted editorial landing redesign (`app/page.tsx` + `components/landing/*`). Findings addressed: (a) `Reveal` SSRs `data-reveal="hidden"` so content is invisible without JavaScript; (b) the manifest `<dl>` violated content-model rules (`dd` before `dt`) and the decorative rule span sat directly in `<dl>`; (c) repeated bezel/ring/eyebrow markup across six sections; (d) nine copies of a hardcoded cubic-bezier literal; (e) an untested `input == null` guard in `lib/admin/validation.ts`; (f) an unused `id` prop on `Reveal`.

**Source plan:** In-session review plan (9 steps), no plan file. Visual/behavioral fidelity was required — this is a refactor pass, not a redesign; production copy, class names asserted by tests, and the CSP nonce contract must survive byte-identical.

## User journeys

1. As a visitor with JavaScript disabled (or during SSR/crawling), I want all landing content visible, so the page degrades to a plain readable document. (CSS gating fix)
2. As a screen-reader user, I want the batch ledger read as term→definition pairs, so assistive tech gets `min_order`/`value` in logical order. (`dt` before `dd`, visual order preserved via flex `order`)
3. As a maintainer, I want one shared bezel-card and eyebrow primitive, so section edits can't drift apart visually. (`CardFrame`, `Eyebrow`, `SECTION_TITLE`)
4. As a maintainer, I want one easing definition, so motion timing can't silently diverge across components. (`.wesup-ease`)
5. As an operator, I want a malformed/missing registration body rejected as a validation error (400) instead of a `TypeError` (500). (`== null` guard + tests)

## Task report

| Plan task | Execution summary | Validation command | Result |
|-----------|-------------------|--------------------|--------|
| 1. Reveal no-JS contract (RED first) | Wrote `tests/unit/landing-reveal-css.test.ts` asserting the hidden rule only applies under `@media (scripting: enabled)`. | `npx vitest run tests/unit/landing-reveal-css.test.ts` | **RED** — hidden rule unconditioned |
| 1b. Gate the hidden rule | `.wesup-reveal[data-reveal="hidden"]` moved inside `@media (scripting: enabled)` in `app/globals.css`; unsupported browsers evaluate the media query false ⇒ fail-open, same contract as the no-IO path. Added `.wesup-ease` + explanatory comments in the same edit. Corrected the now-accurate attribution comment in `tests/components/Reveal.test.tsx`. | same | **GREEN** 2/2; compiled CSS verified: `@media (scripting:enabled)` present in `.next/static/chunks/*.css` |
| 3. `CardFrame` extraction | New `components/landing/CardFrame.tsx`: `className` (outer), `panelClassName` (inner), numeric `radius`/`frameRem` → inline `borderRadius`/`padding`; colors/rings/shadows stay Tailwind (`shadow-[inset_0_1px_0_#ffffff99]` frame, `shadow-[inset_0_1px_1px_#ffffff99]` panel). Applied to manifest, steps, features, closing CTA. | `npx tsc --noEmit`, compiled-CSS grep (`ffffff99` ×2) | PASS |
| 4. `Eyebrow` extraction | New `components/landing/Eyebrow.tsx`: `tone?: "muted" \| "light"`, `trailingRule?: boolean`, tracking unified `0.22em`. | `npx tsc --noEmit` | PASS |
| — Section title constant | `components/landing/section-style.ts` exports `SECTION_TITLE` (class string applied by caller; literal remains in a scanned source file, so Tailwind JIT sees it). | `npm run build` | PASS — utilities present in build output |
| 5. Section extraction | `app/page.tsx` 334→~40 lines composing `components/landing/sections/{SiteHeader,BatchManifest,HowItWorks,Features,ClosingCta,SiteFooter}.tsx`. Copy, hrefs, `aria-label`s, ids, and the `sr-only` h1 byte-identical; manifest DOM reordered (`dt` first) with `order-2`/`order-1` preserving visual order; decorative rule moved into `dd`. `await connection()` + `from "next/server"` retained (CSP contract). | `npx vitest run tests/unit/csp-nonce-page-contract.test.ts`, `npm run build` | PASS; `/` still `ƒ` (dynamic) |
| 6. Easing dedup | Last `ease-[cubic-bezier(0.32,0.72,0,1)]` in `scene/HeroScene.tsx:249` → `wesup-ease`; `EASE`/`EASE_DUR` constants removed. | repo grep: zero code hits (globals.css comment only) | PASS |
| 7. Validation guard test (spec first) | New `tests/unit/admin-validation.test.ts`: null ⇒ `ok:false` with `batchId` error (no throw), undefined, empty object (both field errors), minimal valid payload normalizes consent coords to `null` + policy `v2`, non-integer quantity rejected. Guard `input == null \|\|` kept — defensive, behavior-identical to the `!input` branch. | `npx vitest run tests/unit/admin-validation.test.ts` | PASS 5/5 |
| 8. Dead API | Removed unused `id` prop from `components/landing/Reveal.tsx` (interface + usage); no test referenced it. | `npx tsc --noEmit` | PASS |
| 9. Full verification | — | see Verification matrix | see below |

## Test specification

| # | What is guaranteed | Test file | Test type | Result |
|---|--------------------|-----------|-----------|--------|
| 1 | `.wesup-reveal` hidden state applies only when scripting is enabled (no-JS fail-open) | `tests/unit/landing-reveal-css.test.ts` | unit (CSS contract) | PASS 2/2 |
| 2 | `Reveal` hidden→shown on intersect, reduced-motion/no-IO fail-open (unchanged; comment now cites the CSS contract for the no-JS path) | `tests/components/Reveal.test.tsx` | component | PASS |
| 3 | `app/page.tsx` keeps `next/server` + `await connection()` | `tests/unit/csp-nonce-page-contract.test.ts` | unit | PASS |
| 4 | Null/undefined/empty/malformed registration payloads → `ok:false` with field errors, never a throw; minimal valid payload normalizes correctly | `tests/unit/admin-validation.test.ts` | unit | PASS 5/5 |
| 5 | Landing CTA `Lihat Penawaran` reaches `/marketplace` without 404 | `tests/e2e/umkm-flow.spec.ts` (Landing describe) | e2e | PASS 1/1 (11.6s) |

## Verification matrix

| Gate | Command | Result |
|------|---------|--------|
| Lint (repo) | `npm run lint` | PASS — 0 errors (12 pre-existing warnings, none in changed files) |
| Typecheck | `npx tsc --noEmit` | PASS — 0 errors |
| Unit/component | `npm test` (`vitest run`) | 1643 passed / 1 failed — `tests/live/database.integration.test.ts` (live Supabase enum drift); proven pre-existing by re-running the same file against stashed clean HEAD |
| New tests | `npx vitest run tests/unit/landing-reveal-css.test.ts tests/unit/admin-validation.test.ts` | PASS 7/7 |
| Build | `npm run build` | PASS — `/` dynamic (`ƒ`); compiled CSS contains `@media (scripting:enabled)`, `wesup-ease`, both arbitrary shadow literals (`ffffff99` ×2) |
| E2E (landing) | `npx playwright test tests/e2e/umkm-flow.spec.ts --grep "Landing"` | PASS 1/1 |

### Pre-existing failures proven not to originate from this task

- `tests/live/database.integration.test.ts`: fails on clean HEAD (verified via `git stash push -u` → run → pop); dispute/refund enum drift against the live Supabase instance.
- `tests/e2e/umkm-flow.spec.ts`: 21 failures beyond the landing describe (auth/seed-state timeouts, e.g. no logout button because the session is not seeded). Three representative failures (`logout dari halaman akun`, `dari kartu marketplace menuju detail`, `item navigasi utama mengarah ke halaman tanpa 404`) were re-run against stashed clean HEAD: **identical set fails at baseline**. Landing tests and all touched pages pass.

## Defects found by the tests during this task

1. **No-JS content blackout (the review's key find, confirmed RED first)** — `Reveal` SSRs `data-reveal="hidden"`, and the stylesheet hid it unconditionally; without JS the entire below-hero page was invisible. Fixed by media-gating the hidden rule on `scripting: enabled` (fail-open by default), not by touching component behavior — the no-IO/reduced-motion fail-open paths in `Reveal.test.tsx` were already green.
2. **Invalid `<dl>` content model** — all six manifest cells emitted `dd` before `dt`, and the decorative hairline `<span>` was a direct child of `<dl>`. Fixed with `dt`-first DOM (valid, screen-reader order correct) plus flex `order` utilities so the rendered layout is unchanged; the rule span now lives inside the `dd`.

## Notes / follow-ups

- `components/landing/SectionHeading.tsx` (used by `Faq.tsx`) belongs to an older design era and was deliberately left alone — out of scope for this pass.
- `skills-lock.json`, `.agents/skills/high-end-visual-design/`, and `.claude/` are environment/skill artifacts, not application code.
- The 21 pre-existing `umkm-flow` e2e failures (login-state/seed cascades) and the live-DB enum drift remain out of scope but should be triaged separately.
