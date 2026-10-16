# Landing Brutalist Contract — TDD Evidence

## Red phase
- Created `tests/unit/landing-brutalist-contract.test.ts` with 6 assertions: font wiring (Archivo Black), paper substrate (#F4F4F0), red-only accent (#E61919), hero wash == cove at paper values, no rounded/gradients in landing scope, no ivory bleed.
- Ran test → failed (multiple files had rounded-* and gradients).

## Green phase — tokens + shell
- Updated `app/layout.tsx`: added `Archivo_Black`, `JetBrains_Mono`; wired `--font-landing-display: var(--font-archivo-black)`; removed `Space_Grotesk`.
- Updated `app/globals.css`: `--hero-wash: 244 244 240` (#F4F4F0), brutalist palette tokens (`--color-wesup-paper`, `--color-wesup-paper-sub`, `--color-wesup-red`, `--color-wesup-red-bright`, `--color-wesup-ink`, `--color-wesup-ink-sub`), `--font-mono` → JetBrains Mono.
- Updated `app/page.tsx`: shell `bg-wesup-paper text-wesup-ink` (removed `bg-wesup-void`).
- `renderer.ts`: `COVE_COLOR = 0xF4F4F0`, fog re-based on the paper cove.
- All 6 contract tests pass.

## Green phase — component pass
- Brutalist styling applied across: `section-style.ts`, `Eyebrow.tsx`, `SectionHeading.tsx`, `CardFrame.tsx`, `Faq.tsx`, and sections `SiteHeader`, `BatchManifest`, `HowItWorks`, `Features`, `ClosingCta`, `SiteFooter`, plus `scene/HeroScene.tsx`.
- Removed every `rounded-*`, gradient, glow, `backdrop-blur`, and dark-glass (`slate-*`, `emerald-*`, `white/*`) surface from landing scope; replaced with paper/ink/red and hard 1px borders. Footer inverted to an ink plate.
- Removed orb divs and deleted the now-dead `.wesup-void-base`, `.wesup-orb`, `@keyframes wesup-drift` rules from `globals.css`; grain switched to `mix-blend-mode: multiply` for paper.
- `CardFrame` lost its `radius` prop (hard edges only).

## Green phase — daylight re-light
- `renderer.ts` lighting rig re-authored for daylight: neutral hemisphere (1.0), warm key (1.9) with shadows, paper fill (0.5), white rim (0.5), low warm bay practical (9).
- PMREM environment re-authored as a light "daylight studio" gradient (paper floor, pale overhead).
- Ground/road/sidewalk lifted to paper-adjacent greys; road lines/dashes and hazard hatching switched to ink; hazard paint switched to brand red; skyline softened; truck cab, brand tape, crates-in-flight, cones/jack/bollards moved to red to keep the accent monochrome.
- Beat/stage animation logic and scene geometry untouched — lighting and material colours only.

## Green phase — departure framing (anti-sever)
- Root cause: `TRUCK_DEPART_TOTAL` (26) vs `DOLLY_TOTAL` (19) gave the truck a ~7-unit drift past the frozen look lane; on a narrow viewport the still-opaque truck crossed the right frame edge and read as "cut off". No truck material used `opacity` (only dust did), so nothing faded it out.
- `camera-rail.ts`: set `DOLLY_TOTAL = 26` so truck and rig ride the same curve to the same total — the truck now holds a *constant* lateral offset from the look target for the whole drive-away. `MIN_TRUCK_FRAMING_DISTANCE` re-derived as the equal-travel constant (8.1 x-gap ≈ 10.7 true depth, still ~60% of frame height).
- New test `holds the truck at a constant lateral offset from the camera look lane` pins the equal-travel guarantee; `travels forward smoothly` bound made relative to `DOLLY_TOTAL` so it scales with travel.

## Green phase — drive-away over-run (peel-off, no dissolve)
- Follow-up: the equal-travel leg froze the truck dead-centre at the end, so the drive-away had to *fade* it out to finish on an empty road — reading as "the truck just disappears". Requested behavior: the truck drives off the frame instead.
- `camera-rail.ts`: added `TRUCK_OVERRUN_START = 0.72`, `TRUCK_OVERRUN_TOTAL = 48`, and `truckOverrunX(t)` (`0` before the splice, then `TOTAL * r²` — zero slope at the splice for no velocity jerk, accelerating toward the exit). The 26/26 leg is untouched until 0.72, so the part of the animation that was "good" is byte-identical.
- `renderer.ts`: `truckX = truckDepartureX(depT) + truckOverrunX(depT)` (wheels already roll with `truckX`); **removed** the dissolve — the `truckDissolveMats`/`truckShadowMeshes` collection and the `depT ∈ [0.84, 1]` opacity fade. The truck now pulls ahead of the frozen dolly, recedes, and clears the right frame edge; the 28..110 fog ramp (~35-45% at exit) carries the "driving off into the distance" read, so there's still no hard pop.
- New `truck overrun peel-off` tests: rest→full overrun, zero before the splice, jerk-free splice (accelerating from rest), monotonic, teleport-free combined ride, and an end-state invariant proving the rearmost point sits past the 16:9 right edge at full travel (21:9 clears by under a world unit, fogged). `camera-rail.test.ts` 30 → 38.
- Also fixed pre-existing stale args in `HeroScene.scene.test.tsx`: the `buildScene` mock and `mock.calls[0]` read visibility at index `[4]`, but `onStageChange` now occupies 4 and the boolean is `[5]`; the `HeroSceneCanvas` harness was missing `stageRef`.

## Green phase — mobile hero compression
- `globals.css`: `.hero-scene__column` mobile gap 1.25rem → 1rem; `.hero-scene__rail` hidden below 639.98px (`display:none` keeps it in the DOM for rotate).
- `HeroScene.tsx`: headline 2rem → 1.7rem (mobile, desktop unchanged), body/chip/meter/trust-marker margins and padding tightened on mobile only.
- New `HeroScene mobile compression` tests pin the rail source rule and the smallest-breakpoint headline sizes.

## Green phase — Features spec sheet
- `Features.tsx` rewritten from a 5-card grid (with the `TrendingDown` watermark) to one bordered spec sheet: four `label → value` rows (`Harga berjenjang` with the live `lockedTier` price + red tier badge, `Jaminan pembayaran` → Escrow 24 jam, `Pengiriman` → Self-pickup tanpa ongkir last-mile, `Cakupan` → Bandung), mono label column, `sm:grid-cols-[14rem_1fr]` tab stops, `border-l` column rule, `divide-y` separators.
- New `tests/components/Features.test.tsx` pins the sheet structure, the four rows, and the live tier price/badge.

## Verification runs
- `npx vitest run tests/unit/landing-brutalist-contract.test.ts` → 6/6 pass.
- `npx vitest run tests/components/HeroScene.test.tsx` → 20/20 pass.
- `npx vitest run tests/components/SiteHeader.test.tsx` → 4/4 pass (test updated from the old rounded-glass nav pin to the hard-edged paper bar).
- `npx vitest run tests/components/HeroScene.scene.test.tsx tests/components/LandingFaq.test.tsx tests/components/Reveal.test.tsx` → 18/18 pass.
- `npx vitest run tests/unit/landing-camera-rail.test.ts` → 38/38 pass (incl. the constant-offset test and the new `truck overrun peel-off` suite).
- `npx vitest run tests/components/HeroScene.test.tsx tests/components/HeroScene.scene.test.tsx tests/components/Features.test.tsx` → 31/31 pass.
- `npx eslint components/landing lib/landing/camera-rail.ts tests/unit/landing-camera-rail.test.ts tests/components/Features.test.tsx tests/components/HeroScene.test.tsx tests/components/HeroScene.scene.test.tsx` → clean (pending rerun; eslint alone exceeds the shell timeout, scoped runs used).
- `npx tsc --noEmit` → clean.

## Notes
- Swiss Industrial Print light archetype: paper substrate, red-only accent, macro sans, grid/border construction, no gradients/shadows/translucency/border-radius.
- `npm test` / full `eslint` exceed the sandbox 120s shell timeout; focused per-file runs used instead.
- WebGL re-light is code-complete but not yet visually confirmed in a browser — the daylight rig should get a Playwright/manual pass to tune prop hues and exposure.
- Equal-travel + over-run resolve the departure "cut off" bug and let the truck drive off the frame instead of fading. The end-state invariant clears 16:9 with ~11 world units; 21:9 clears by under a unit (fog haze covers it). The *load-phase* truck crop on very narrow portrait phones is a separate, VFOV-limited framing trait (the 7.7-wide truck exceeds the portrait frustum width at the close-in load distance) and was intentionally left for a browser pass — widening the FOV or pushback would change the desktop hero's established framing.
