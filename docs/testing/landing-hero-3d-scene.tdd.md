# TDD Evidence Report — Scroll-Scrubbed 3D Landing Hero

**Task:** Replace the static Wesup landing hero with a scroll-scrubbed Three.js scene that narrates the product in six beats — UMKM register, crates load into a truck, volume unlocks a tier, registration closes and the price locks, the truck departs, pickup is ready. The scene had to stay trustworthy (no motion the user did not ask for), stay inside the existing light/blue Wesup identity, degrade to a readable static story without WebGL, and not make `/` slower to load.

**Source plan:** No `*.plan.md` file was persisted — the plan was produced in-session and approved by the user. Reference implementation: `Testingspline/index.html` (standalone scroll + Three.js prototype). Product facts trace to `prd/PRD.md` (group-buying tiers, cutoff price locking, 24h escrow, self-pickup in Bandung).

## User journeys

1. As a visitor, I want to understand how Wesup works by scrolling, so that the value proposition lands before I am asked to sign up. (six-beat overlay)
2. As a visitor, I want the tier pricing shown to be the tier the demo volume actually earned, so that I can trust the number I am reading. (298 kg → Tier 2 → Rp 10.500, never Rp 8.900)
3. As a visitor, I want to be reassured that my money is held until delivery, so that the escrow claim is credible. (escrow chip on the registration-cutoff beat only)
4. As a visitor on a slow connection, a low-power device, reduced motion, or a browser without WebGL, I want the same story and the same calls to action, so that the page is never an empty rectangle. (static fallback)
5. As a screen-reader or no-JavaScript visitor, I want the full six-stage story and both CTAs present in the server-rendered HTML, so that the page is complete without the 3D scene. (SSR'd overlay)
6. As an operator, I want `/` to stay statically prerendered and I want three.js kept out of the initial bundle, so that the landing page does not pay for an enhancement most visitors may never see. (`force-dynamic` removed, three.js code-split) — **the code-split half held; the static-prerender half was the wrong goal and cost the scene entirely. See Revision 5.**

## Task report

| Plan task | Execution summary | Validation command | Result |
|-----------|-------------------|--------------------|--------|
| Install renderer | `three@^0.186.1` + `@types/three@^0.186.0` (tarball ships no `.d.ts`, so the types package is required). No loaders, no `examples/jsm`, no R3F. | `npm ls three @types/three` | PASS — three.js isolated in its own 724 KB chunk (~128 KB gzip), not the 1.2 MB main chunk |
| Pure timeline module (RED) | Wrote `tests/unit/landing-scene-timeline.test.ts` — 56 tests over clamps, easings, rupiah/kg formatting, tier resolution, six beat thresholds, camera sampling, departure sampling, crate fill/seat progress. | `npx vitest run tests/unit/landing-scene-timeline.test.ts` | **RED** — `Cannot find package '@/lib/landing/scene-timeline'`, then **GREEN** 56/56 |
| `lib/landing/scene-timeline.ts` | Pure data + pure math, no React/DOM/three. Six beats, 36-crate deterministic arrival order, tier helpers, camera/departure/crate samplers. | `npx vitest run tests/unit/landing-scene-timeline.test.ts` | PASS |
| Scroll hook | `hooks/use-scroll-progress.ts` — caches element geometry, re-measures on resize/load/font-ready, per-frame path reads `window.scrollY` only. Capability gating via `useSyncExternalStore`. | `npx tsc --noEmit`, `npx eslint hooks/` | PASS after two React Compiler/lint corrections (below) |
| Hero shell (RED) | Wrote `tests/components/HeroScene.test.tsx` (10) + `HeroScene.scene.test.tsx` (3) — SSR content contract, escrow placement, honest tier, CTA reachability, WebGL/reduced-motion degradation, canvas mount, scroll-length CSS variables. | `npx vitest run tests/components/HeroScene` | **RED** — `Failed to resolve import`, then **GREEN** 13/13 |
| `components/landing/scene/HeroScene.tsx` | Sticky scroll track + sticky viewport, SSR'd six-beat overlay, volume meter, stage rail, CTA block. Canvas host rendered by the shell; renderer attached by the dynamic module. | `npx vitest run tests/components/HeroScene` | PASS |
| `components/landing/scene/HeroSceneCanvas.tsx` | Procedural three.js scene: `PCFShadowMap`, `MeshStandardMaterial`, ACES tone mapping, truck-following shadow frustum, 36 crates, seal strap, wrapping road dashes. `import("three")` inside an effect. | `npx tsc --noEmit`, `npx eslint components/landing/scene` | PASS |
| `app/globals.css` | Scene track height via custom properties (560vh desktop / 420vh mobile), beat cross-fade, rail width, and a full static-fallback block. | `npm run build` | PASS |
| Page wiring | `app/page.tsx` renders `<HeroScene />`, old hero markup deleted, **`force-dynamic` removed**. | `npm run build` | PASS — `┌ ○ /` is now static. **Superseded by Revision 5**: static is what blocked the scene, and `/` is now `┌ ƒ /` |
| Full suite | — | `npm test` | **PASS** — 170 files, 1551 tests, 0 failures (3 live tests skipped, no credentials) |
| Lint + build | — | `npm run lint`, `npm run build` | PASS — 0 errors (10 pre-existing warnings in unrelated test files) |

## Test specification

| # | What is guaranteed | Test file | Test type | Result |
|---|--------------------|-----------|-----------|--------|
| 1 | All six stage headlines and eyebrows are in the server-rendered DOM with no canvas mounted | `tests/components/HeroScene.test.tsx` | component | PASS |
| 2 | Escrow is mentioned exactly once across the beats, on beat `03` | `tests/components/HeroScene.test.tsx` | component | PASS |
| 3 | The volume meter states 298 / 500 kg and a progressbar matches the filled share | `tests/components/HeroScene.test.tsx` | component | PASS |
| 4 | The locked tier is Tier 2 / Rp 10.500 and Rp 8.900 never appears | `tests/components/HeroScene.test.tsx` | component | PASS |
| 5 | Both CTAs keep their hrefs in every rendering mode | `tests/components/HeroScene.test.tsx` | component | PASS |
| 6 | Stage rail lists all six stage labels without the 3D scene | `tests/components/HeroScene.test.tsx` | component | PASS |
| 7 | Missing WebGL ⇒ `data-webgl="off"`, static fallback present, no canvas | `tests/components/HeroScene.test.tsx` | component | PASS |
| 8 | `prefers-reduced-motion` ⇒ scene declined, canvas absent, flag exposed | `tests/components/HeroScene.test.tsx` | component | PASS |
| 9 | WebGL present ⇒ canvas mounted, `--scene-length` / `--scene-length-mobile` published | `tests/components/HeroScene.scene.test.tsx` | component | PASS |
| 10 | Six beats declared, strictly ascending, starting at 0 | `tests/unit/landing-scene-timeline.test.ts` | unit | PASS |
| 11 | `stageForProgress` switches exactly on declared thresholds and clamps out-of-range | `tests/unit/landing-scene-timeline.test.ts` | unit | PASS |
| 12 | `lockedTierForKg` never promises a tier the volume did not earn, and floors at Tier 1 | `tests/unit/landing-scene-timeline.test.ts` | unit | PASS |
| 13 | `sampleCamera` returns finite poses at every key and never jumps more than a quarter of the key distance per 0.001 step | `tests/unit/landing-scene-timeline.test.ts` | unit | PASS |
| 14 | Ground travels ≥ 5× the truck, and departure ratio is monotonic and non-overshooting | `tests/unit/landing-scene-timeline.test.ts` | unit | PASS |
| 15 | `crateSeatProgress` is anchored at 0 before the fill window and 1 for every crate at the cutoff | `tests/unit/landing-scene-timeline.test.ts` | unit | PASS |
| 16 | `ARRIVAL_ORDER` is a permutation of 0…35, so every crate seats exactly once | `tests/unit/landing-scene-timeline.test.ts` | unit | PASS |
| 17 | Rupiah formats in `id-ID` grouping and rounds to whole rupiah | `tests/unit/landing-scene-timeline.test.ts` | unit | PASS |
| 18 | All easings anchored at 0/1, none overshoot | `tests/unit/landing-scene-timeline.test.ts` | unit | PASS |
| 19 | `/` is prerendered static (no `force-dynamic`) | `npm run build` | build | **REVERSED — see Revision 5.** The goal itself was wrong: a static `/` ships nonce-less script tags, which the `strict-dynamic` CSP refuses, so the scene never mounted in a real browser. `/` is now `┌ ƒ /` via `await connection()`. No test ever asserted this, which is why it survived four revisions |
| 20 | three.js is a separate lazily-fetched chunk, not part of the initial bundle | `npm run build` + chunk scan | build | PASS |

## Defects found by the tests during this task

1. **`beat.chip` was dead data.** The timeline defined an escrow chip for the cutoff beat, but the UI never rendered it and instead hardcoded a second escrow line in the volume meter. Fixed by rendering `beat.chip` from the data and deleting the duplicate, so copy has one source of truth.
2. **The fallback hid the product story from assistive technology.** `aria-hidden` was applied to every non-active beat unconditionally, so with no WebGL five of the six stages were invisible to screen readers. Fixed to hide inactive beats only in the scrubbed overlay; in fallback mode all six are exposed.
3. **Redundant WebGL guard.** The probe checked `typeof window.WebGLRenderingContext` before calling `getContext`, which is a second thing that can be wrong (vendored prefixes) and bought nothing, since `getContext` is the real feature test. Removed.
4. **Render loop was never started.** The first canvas draft built a `start`/`stop` pair inside `buildScene` and never invoked it, so the scene would have mounted black. Replaced with a `SceneController` (`setVisible`/`dispose`) that the component drives, which also gave the visibility pause a real implementation.
5. **Module-scope `controllerRef` singleton** in the first canvas draft would have leaked a renderer across instances; moved to a per-component `useRef`.
6. **`dispose` referenced itself** inside its own object literal, where the identifier is not in scope. Hoisted to a named function.

## Corrections to the original test file (test bugs, not product bugs)

Three assertions in the new suite were wrong on first run and were fixed rather than the implementation:

- `easeOutCubic(0.75)` was asserted `< 0.95`; it is `0.984`. Assertion corrected with the true values documented inline.
- `easeInCubic(0.75)` was asserted `> 0.5`; `t³ = 0.422`. Corrected.
- `BEATS[last].at` was asserted `=== 1`. The final beat *begins* at `0.94` and stays active to the end — there is no beat anchored exactly at 1, because nothing follows the CTA. Corrected to assert the beat starts before the end and that `stageForProgress(1)` is the last index.

## Rejected approach

`react-hooks/set-state-in-effect` forbids resolving the WebGL/reduced-motion capability with `setState` in an effect body. Suppressing the rule (as `hooks/use-tier-progress.ts` does for its own external-sync case) was rejected: capability is a read-only browser fact, not a synchronisation, so it is exposed through `useSyncExternalStore` with a stable cached snapshot. React renders the server snapshot during hydration and swaps in the real value immediately after, with no cascading render and no suppression comment.

---

# Revision — Detailed Truck, Cargo Lattice, and Shutter (Sep 2026)

**Task:** Replace the abstract crate-and-cube scene with a recognisable Indonesian box truck and a real cargo box, so a visitor can see the goods they are buying. One crate must already be seated at scroll 0 (the hook), the remaining 35 must load visibly rather than pop into existence, the cargo must seal before the truck leaves, and the departure must read as a truck driving away from a dock.

**Decisions taken with the user:** plan directly in session (the configured planner model id was invalid, see below); a roller shutter rather than crate-by-crate doors; crates sliding in from off-camera rather than scaling in at the rear opening; subtle page-matched fog; a rear three-quarter view of the cargo opening; a longer mobile scene (`420vh`).

## Revised user journeys

7. As a visitor, I want the truck to look like a real box truck, because a floating cube grid reads as an abstract toy rather than the product.
8. As a visitor, I want to see one crate already loaded when I arrive, so that the volume meter has a physical counterpart and the scene never looks empty or reset.
9. As a visitor, I want the remaining crates to arrive one at a time on a staggered cadence, so that loading reads as a sequence rather than a bulk appear.
10. As a visitor, I want the cargo to visibly seal before departure, so that "the goods are secured" is a moment I can see rather than a claim.

## Task report (revision)

| Plan task | Execution summary | Validation command | Result |
|-----------|-------------------|--------------------|--------|
| Timeline tests (RED) | Extended `tests/unit/landing-scene-timeline.test.ts` from 56 to 84 tests: preloaded-crate invariant, frustum culling across six aspects, shutter window, camera jump, mobile scene length, cargo-fit geometry. | `npx vitest run tests/unit/landing-scene-timeline.test.ts` | **RED** — 23 failed / 58 passed, then **GREEN** 84/84 |
| Revised timeline | New windows (`FILL_START=0.1`, `SHUTTER_START=0.56`, `DEPART_START=0.76`), `SCENE_LENGTH_MOBILE_VH=420`, seven-key rear→chase camera, `PRELOADED_CRATES`, cargo dimension constants, and helpers `cargoRearOpening` / `crateSeatPoint` / `crateSpawnPoint` / `crateStagingPoint` / `crateVisibleAt` / `shutterProgress` / `isOffFrustum`. | `npx vitest run tests/unit/landing-scene-timeline.test.ts` | PASS 84/84 |
| Barrel exports | `lib/landing/index.ts` re-exports every new constant and helper; the canvas imports from the barrel. | `npx tsc --noEmit` | PASS after fix (see defect 7) |
| Beat 03 copy | Reworded to the full pallet and the closing shutter, escrow chip unchanged. | `npx vitest run tests/components/HeroScene.test.tsx` | PASS |
| `HeroSceneCanvas.tsx` rewrite | Detailed cab (raked screen, side glass, grille, bumper, mirrors, markers, mudguards), enclosed cargo with ribbed floor/side ribs/bulkhead/warm interior lamp, roller shutter driven per-slat, 36 instanced crates with per-instance colour, dock structure, roadside strip. | `npx tsc --noEmit`, `npx eslint components/landing/scene` | PASS |
| Scene composition | Numeric simulation of the renderer's own interpolation path: 1 crate on screen at `p=0`; all 36 enter frame; entries spread `10/13/12` across `p=0.1–0.4`; all 36 exactly on seat at `p=0.5`; shutter `0`→`1` across `0.56–0.64`; no seat intersects a wall. | ad-hoc `tsx` harness mirroring `applyProgress` | PASS |
| Browser visual pass | Playwright (Edge, `msedge`) captured 7 progress stops × 2 viewports (1440×900, 420×780). Pixel statistics used as a non-visual proxy: mean luminance, non-background coverage, blue/kraft/dark area fractions, and frame-to-frame delta. | `npx playwright test` (temporary spec) | PASS — no frame frozen, every phase differs, and the colour signature tracks the choreography |
| Draw-call budget | Measured by wrapping the WebGL context before app boot and attributing each draw to its rAF timestamp. | temporary Playwright spec | **188 → 67** per frame; see rejected approach below |
| Full suite | — | `npm test` | **PASS** — 170 files, 1579 tests, 0 failures (3 live skipped, no credentials) |
| Lint + build | — | `npm run lint`, `npm run build` | PASS — 0 errors, 10 pre-existing warnings in unrelated files; `/` still `┌ ○ /` static |

## Test specification (revision)

| # | What is guaranteed | Test file | Test type | Result |
|---|--------------------|-----------|-----------|--------|
| 21 | Exactly one crate is visible at `progress = 0`, and it is inside the cargo box | `tests/unit/landing-scene-timeline.test.ts` | unit | PASS |
| 22 | No crate spawns inside the camera frustum at any aspect from 0.46 to 2.4, before its arrival window | `tests/unit/landing-scene-timeline.test.ts` | unit | PASS |
| 23 | `shutterProgress` is 0 through the load window, 1 from the shutter end onward, and monotonically increasing between | `tests/unit/landing-scene-timeline.test.ts` | unit | PASS |
| 24 | The revised seven-key camera never jumps more than 0.25 per 0.001 of scroll | `tests/unit/landing-scene-timeline.test.ts` | unit | PASS |
| 25 | Mobile scene length is 420vh | `tests/unit/landing-scene-timeline.test.ts` | unit | PASS |
| 26 | No crate seat intersects a cargo wall, roof, floor, or bulkhead for all 36 crates | `tests/unit/landing-scene-timeline.test.ts` | unit | PASS |
| 27 | `sampleCamera(0)` and `sampleCamera(1)` return the declared key exactly (no float drift) | `tests/unit/landing-scene-timeline.test.ts` | unit | PASS |
| 28 | Every crate enters the frustum during the load window, and none after it | composition harness | integration | PASS |
| 29 | Static geometry collapses to one draw call per material, and the merged result is pixel-equivalent | Playwright pixel statistics | integration | PASS |

## Defects found by the tests during this revision

7. **The barrel was not exporting the new symbols.** `lib/landing/index.ts` re-exports an explicit list, so the fourteen new constants and helpers were invisible to the canvas: `Module '"@/lib/landing"' has no exported member 'CAMERA_FAR'`. Added them to the list.
8. **`new (THREE.Matrix4 as Matrix4)()`** cast the constructor to its own instance type, giving `TS2351: This expression is not constructable`. Used `new THREE.Matrix4()`.
9. **`addInstances` always parented to `scene`.** The shutter, wheels, hubs, cargo ribs, and interior floor were all baked into scene-space meshes, so they would have stayed behind while the truck drove away, and `roadside` was translated without containing anything. Added an explicit `parent` argument and threaded it through every batch.
10. **`PCFSoftShadowMap` was removed in three.js r186.** The renderer logged `THREE.WebGLShadowMap: PCFSoftShadowMap has been removed. Using PCFShadowMap instead.` on every load. Switched to `PCFShadowMap` and corrected the table in this report.
11. **Geometry typing was too narrow.** `addInstances` accepted only `Box | Cylinder` but was handed a `PlaneGeometry` (road dashes) and a `ConeGeometry` (tree canopies), which had been papered over with an `as unknown as Box` cast. Widened to `BufferGeometry`.
12. **188 draw calls per frame, 4.7× the 40 budget.** The truck and dock were built from ~80 individual boxes, each its own mesh. See the rejected approach below.

## Rejected approach (revision)

**Draw-call reduction via `BufferGeometryUtils.mergeGeometries`.** The obvious fix is three.js's official merge utility, but it lives under `three/examples/jsm`, which the plan explicitly excluded to keep the scene out of the examples bundle. It was replaced with a local merge in `HeroSceneCanvas.tsx`: parts are queued as non-indexed transformed geometry, then concatenated per material into a single `BufferGeometry` (position/normal/uv only — the whole set is box and cylinder primitives). This measured **188 → 67** draw calls per frame. Post-merge pixel statistics matched pre-merge values to within 0.5% on every metric, so the merge is visually lossless.

The residual 67 exceeds the plan's 40-call target. Closing the remaining gap would mean collapsing distinct materials, which flattens the light/blue Wesup identity the scene was built around for a number that is already comfortably cheap (three.js handles thousands of draw calls). The 40 figure was a plan estimate, not a user requirement; the measured 67 is recorded here instead of quietly re-baselining the target.

**Per-part shadow casting.** Every shadow caster costs a second draw call. Small trim, ribs, mirrors, and marker lights were each casting shadows the shadow map blurred away. Casting is now decided by bounding-box size (≥ 0.5 units), with the silhouette-defining instanced batches (cargo ribs, shutter, wheels, hubs) opting in explicitly. This alone took 188 → 164, which also showed the real problem was mesh count rather than the shadow pass.

**Post-creation mutation of merged parts.** Merging removes the ability to transform a part after it is created, and four parts were doing exactly that: the raked windscreen, the side glass, the cab roof, and the mudguards. Rather than exempt them from the batch, `addPart`/`addToBay` now take an optional `rotate` and bake the rotation into the transform, which keeps every part mergeable.

## Known gaps

- The plan called for a static forklift in the loading bay; the implemented scene has dock structure, pallets, sacks, a rack, bollards, and lighting but no forklift. Not implemented, and not verified as visually necessary.
- The draw-call count is measured in a real browser, but only at one viewport and one device pixel ratio; it has not been profiled on a low-power mobile GPU.

## Environment note

`.opencode/opencode.json` contains 22 references to the invalid model id `anthropic/claude-opus-4-5`, which fails session startup with `Model not found: anthropic/claude-opus-4-5. Did you mean: claude-opus-4-5, claude-opus-4-5-20251101?`. The user approved planning in-session instead, so the file was left unmodified — it is a separate fix and does not affect the product.


---

# Revision 3 — flush packing, cardboard, camera freeze, six-beat alignment

Four defects were reported against the revision-2 scene. All four were
reproduced before anything was changed, and each turned out to have two
independent causes rather than one.

| # | Defect | Root cause | Fix |
|---|--------|-----------|-----|
| 13 | Crates floated apart and interpenetrated | `stepX/stepY/stepZ` were hand-tuned per axis (`1.18 / 0.87 / 0.71`) against a crate of `0.82 × 0.71 × 0.82`, giving a 0.36 gap on X, 0.16 on Y and a 0.11 **overlap** on Z | Steps are now *derived* from the crate extents, so a gap is unrepresentable |
| 14 | Crate bodies read as flat plastic | Only the label decal had a texture; the body material had none | Near-white procedural cardboard map, so `map × color × instanceColor` keeps both the in-flight blue and seated kraft clean |
| 15 | The loading station appeared to slide away | The `station` group was never transformed — the drift came from the camera, via a residual dolly **and** a look-target pan | Rail hard-frozen in position *and* orientation from `departStart` |
| 16 | Last two narrative beats never appeared | The renderer shipped its own 3-element `STAGE_EDGES` while the overlay rendered 6 `BEATS` | `STAGE_EDGES` derived from `BEATS`; both read the live phases |

## Task report (revision 3)

| Plan task | Execution summary | Validation command | Result |
|-----------|-------------------|--------------------|--------|
| `lib/landing/crate-lattice.ts` | New pure module: `CARGO`, `CRATE` (with `stepX/stepY/stepZ` derived as `size/h/size`), `SCENE_PHASES`, 36 generated `CrateSeat`s, and invariant helpers (`contactGap`, `seatsAreFlush`, `doorZClearance`, `interiorZClearance`, `rearClearance`, `headroom`, `frontGap`). No `three` import, so it is testable in plain Node. | `npx vitest run tests/unit/landing-crate-lattice.test.ts` | **PASS** 16/16 |
| Lattice geometry | `size = h = 0.78`; 4 × 3 × 3 = 36. Clearances: door 0.038, interior 0.078, rear 0.060, headroom 0.43. The **door aperture** (1.22) rather than the interior half-width (1.26) is the binding constraint, because the shutter slats are narrower than the walls — a crate sized against the wall alone would jam entering. | invariant tests | PASS |
| Cardboard texture | `makeCrateCardboardTexture` — 256², near-white base, 5200 deterministic fibre flecks, flute seams, flap creases, `SRGBColorSpace`, `RepeatWrapping`, repeat `1/CRATE.size` (ExtrudeGeometry emits world-unit UVs, so ~1 tile per face), anisotropy 4. Added to the dispose list. | `npx tsc --noEmit`; browser pass | PASS |
| Tape clearance | Strapping band `size * 1.03 → size * 1.012`, and re-seated on the crate top via `CRATE.h / 2 - 0.09` instead of the literal `0.3`. At 1.03 it stood 0.011 proud and pushed into the neighbour once packing went flush. | lattice + browser pass | PASS |
| `lib/landing/camera-rail.ts` | Extracted `CAMERA_KEYS` + Catmull-Rom sampling out of the canvas into a pure, three-free module with `sampleCamera`, `sampleCameraRail`, `departureProgress` and `cameraSettle`. The freeze was previously a closure with no way to test it. | `npx vitest run tests/unit/landing-camera-rail.test.ts` | **PASS** 20/20 |
| Beat/phase contract | `STAGE_EDGES` is now `BEATS.slice(1).map(b => b.at)`, so the two cannot drift. Beats read the live `crate-lattice` phases; the timeline's superseded `FILL_*`/`SHUTTER_*`/`DEPART_*` stay on their original literals (see defect 19). | `npx vitest run tests/unit/landing-beat-phase-contract.test.ts` | **PASS** 11/11 |
| Full suite | — | `npx vitest run` | **PASS** — 173 files, 1626 tests, 0 failures (3 live skipped) |
| Typecheck / lint / build | — | `npx tsc --noEmit`, `npm run lint`, `npm run build` | PASS — 0 type errors; 0 lint errors / 10 pre-existing warnings; `/` still `┌ ○ /` static |
| Browser pass | Playwright (Edge) at p = 0.5 / 0.8 / 0.9 / 0.95 / 1.0, 1440×900, measuring draw calls and a pixel signature (mean luminance, kraft/blue/pale coverage). | `npx playwright test` (throwaway spec, since removed) | PASS — no `THREE.*` warnings, every stop renders a distinct frame |

## Test specification (revision 3)

| # | What is guaranteed | Test file | Test type | Result |
|---|--------------------|-----------|-----------|--------|
| 30 | Crate steps equal the crate extents on all three axes — a gap is unrepresentable | `landing-crate-lattice.test.ts` | unit | PASS |
| 31 | `contactGap` is exactly 0 on X, Y and Z, and `seatsAreFlush()` is true | `landing-crate-lattice.test.ts` | unit | PASS |
| 32 | One seat per lattice cell, no duplicates, 36 total | `landing-crate-lattice.test.ts` | unit | PASS |
| 33 | Every yawed crate clears both the side walls and the narrower door aperture | `landing-crate-lattice.test.ts` | unit | PASS |
| 34 | The lattice clears the rear plane and leaves headroom under the roof | `landing-crate-lattice.test.ts` | unit | PASS |
| 35 | Seats are filled deepest-column-first, so a crate only ever slides forward into place | `landing-crate-lattice.test.ts` | unit | PASS |
| 36 | `STAGE_EDGES` has exactly `BEATS.length - 1` entries and equals the beat positions | `landing-beat-phase-contract.test.ts` | unit | PASS |
| 37 | Each beat fires on the live phase it narrates (load, tier, shutter, departure, pickup) | `landing-beat-phase-contract.test.ts` | unit | PASS |
| 38 | The camera holds **one exact pose** for every progress at or past `departStart` | `landing-camera-rail.test.ts` | unit | PASS |
| 39 | The freeze covers the look target, not only the position | `landing-camera-rail.test.ts` | unit | PASS |
| 40 | The freeze is continuous — the rail and the frozen pose agree at the handover | `landing-camera-rail.test.ts` | unit | PASS |
| 41 | Pointer parallax and idle bob reach exactly 0 by the end of the scene, monotonically | `landing-camera-rail.test.ts` | unit | PASS |
| 42 | The rail never teleports (>0.25 per 0.001 of scroll) and is finite everywhere | `landing-camera-rail.test.ts` | unit | PASS |

## Defects found by the tests during this revision

13. **`CrateSeat` was declared as a tuple but populated as an object.** The interface extended `Vec3` (`readonly [number, number, number]`) while the generator returned `{ x, y, z, level, depth, row }`, so `tsc` rejected the whole module with `TS2322`. Changed to a named-field interface; the canvas reads `.x/.y/.z` rather than `[0]/[1]/[2]`.
14. **Retiming the shared phases broke the superseded camera rail's no-jump guarantee.** Sourcing `scene-timeline`'s `FILL_*`/`SHUTTER_*`/`DEPART_*` from the live phases moved `SHUTTER_END` and `DEPART_START` to `0.88` and `0.9`, squeezing that keyframe gap to 0.02 of scroll — a ~7-unit camera move across a sliver of the timeline. `sampleCamera > does not jump between adjacent keyframes` failed at 0.2558 against a 0.25 bound. Rather than loosen the test or reshape dead geometry, the timeline's own constants were returned to their original literals and only `BEATS[].at` was re-pointed at the live phases. The two sets are now explicitly scoped and the split is documented in the module.
15. **`sampleCamera` collides at the barrel.** `scene-timeline` already exports a `sampleCamera` for its superseded rail. It is deliberately *not* re-exported from `lib/landing/index.ts`; the live one is imported from `lib/landing/camera-rail` directly.
16. **`PCFSoftShadowMap` was still set in the renderer.** Revision 2's report claimed this was fixed, but `THREE.WebGLShadowMap: PCFSoftShadowMap has been removed. Using PCFShadowMap instead.` was still logged on every page load. The constant was removed in three r186; switched to `PCFShadowMap` and the browser pass now logs no `THREE.*` warnings at all. The revision-2 claim was wrong.
17. **The cardboard map added draw calls.** It does not: re-measuring with the map force-disabled and enabled gave 217 and 218 draws across two frames — noise, not a change. A material `map` on an existing `InstancedMesh` cannot alter the call count, and the measurement confirms it.
18. **The draw-call figure in revision 2 does not reproduce under this harness.** The earlier report recorded 67 calls/frame via per-rAF timestamp attribution; the current probe counts 218 draws across 2 rAFs (~109/frame) at the same stops. The method differs and the discrepancy is recorded rather than quietly re-baselined. The 67 figure has not been re-verified and should be treated as unconfirmed.
19. **The raw rail overshoots between the freeze key and the final key.** Both hold the same pose, so the Catmull-Rom segment between them bulges (look target reaches 1.0016 instead of 1.0). The short-circuit in `sampleCamera` is what keeps the pose genuinely held, and the overshoot is small enough to be invisible — so a test asserting only that the frozen pose is returned would still pass if the short-circuit were deleted. `is load-bearing: the raw rail would have drifted during the departure` now pins that.
20. **The render loop stops at full scroll.** `draws: 0` at p = 1.0 is the `IntersectionObserver` visibility gate in `use-scroll-progress.ts` — the sticky scene has left the viewport, so rendering is suspended. Intended, not a freeze bug.

## Verification of the tests themselves

The two highest-risk assertions were mutation-checked, because a freeze test that
cannot fail proves nothing:

| Mutation | Result |
|----------|--------|
| Remove the `p >= DEPART_FREEZE_AT` short-circuit in `sampleCamera` | **2 failed** — "holds one exact pose for every progress at or past the freeze", "freezes the look target, not only the position" |
| Pin `cameraSettle` to return `1` (parallax never fades) | **3 failed** — "reaches exactly zero by the end of the scene", "is the complement of departure progress", "leaves no residual parallax at the final frame" |

## Known gaps (revision 3)

- The throwaway Playwright probe measured pixel signatures, not pixels under
  human review. The visual goals — flush stacking, cardboard read, stationary
  station — are argued from geometry and unit invariants, and the draw-call and
  console results are direct measurements. No screenshot was inspected by eye.
- The 36 crates sit forward-biased: the deepest column ends at x = -0.41 while
  the bulkhead is at x = 2.0, leaving ~2.0 units of empty cargo at the door
  end. This is a consequence of keeping 36 crates at a door-passable size and
  was accepted explicitly, but it is visible and unaddressed.
- `scene-timeline`'s superseded lattice, camera rail and fill maths are still
  exported and still tested, alongside the live equivalents in
  `crate-lattice` and `camera-rail`. Two sources of truth for the same
  choreography now exist. Reconciling or deleting them was explicitly out of
  scope for this revision; defect 14 is the cost of that deferral, made
  explicit rather than absorbed.
- `tests/e2e` has no committed spec for this scene; the verification above was
  a throwaway spec, removed after use, so none of it runs in `npm run test:e2e`.

---

# Revision 4 — rigid camera dolly: the dock recedes and exits the frame

The user's playback of revision 3 (which had hard-frozen the rig in place) was
clear about the desired reading: *"the dock didn't move while the road and truck
move … the dock is like get behind and disappear from the screen."* The freeze
had removed the drift, but it also removed all travel — the truck was parked and
the dock stayed centred in front of it for the whole departure, so the set still
read as sliding on the scrolling road.

| # | Defect | Root cause | Fix |
|---|--------|-----------|-----|
| 21 | The dock read as moving even though the rig was frozen | The freeze pinned truck *and* camera at the bay; the road scrolled past a stationary set, which is the same retinal signal as a moving dock | Give the truck a real drive-away (`TRUCK_DEPART_TOTAL = 26`) and doll the camera past the dock instead of holding it still |
| 22 | The dock never left the frame — it could not "get behind" | The camera had no travel after the freeze | A **rigid dolly**: the frozen pose plus a pure `+X` translation applied equally to position and look target (`departureCameraRig`), ending with the camera at `x = 7.7` past `STATION_MAX_X = 6.5`, so the dock goes behind the lens (top of frame at `p≈0.972`, side at `p≈0.978`) |
| 23 | Pointer parallax and the idle bob kept nudging the frame when the truck moved | Both are applied *after* the rail and were left at full strength | `cameraSettle` ramps to 0 across `[0.86, 0.88]` and is exactly 0 from `CAMERA_LOCK_AT = shutterEnd`; the dolly starts at `DEPART_FREEZE_AT = 0.9`, so it always runs with a rigid rig |
| 24 | Lamps beside the dock clipped the frame while the camera travelled | Poles sat at `z = 6.4`, inside the camera path (`z ≈ 7.0`) | Poles moved to `z = 10.5`; they leave the frame at ~6.7 units instead of ~1.15 |

## Task report (revision 4)

| Plan task | Execution summary | Validation command | Result |
|-----------|-------------------|--------------------|--------|
| `lib/landing/camera-rail.ts` | New departure family: `DEPARTURE_EASE(t) = (3.4t + 10t²)/13.4` (the original quadratic, shared by truck, dolly and dust so they stay locked); `TRUCK_DEPART_TOTAL = 26`; `DOLLY_TOTAL = 19`; `MIN_TRUCK_FRAMING_DISTANCE = 10`; `STATION_MAX_X = 6.5`; `truckDepartureX`; `departureDollyOffset`; `departureCameraRig` (pure translation — same offset to pos and look, so orientation is bit-for-bit constant); `cameraSettle` repointed to ramp to 0 by `CAMERA_LOCK_AT`. Still three-free. | `npx vitest run tests/unit/landing-camera-rail.test.ts` | **PASS** 29/29 |
| `components/landing/scene/HeroSceneCanvas.tsx` | Camera block now composes `departureCameraRig(p)` with the pointer/bob offsets (scaled by `settle`); `truckX = truckDepartureX(depT)`; dust `baseX` pinned to `truckDepartureX(start)`; idle `pos.y`/`rot.x` time-terms multiplied by `settle` so they are zero across the drive-away (scrub deterministic); poles moved to `z = 10.5`. | `npx tsc --noEmit`; browser pass | PASS |
| `lib/landing/index.ts` | Barrel re-exports the new departure symbols (same names as the module-local ones in `camera-rail`). | `npx tsc --noEmit` | PASS |
| Tests | Rewritten to the dolly; two old fixed-box guarantees that contradicted the new intent (camera-settle complement of departure progress, fade based on departure) deleted. 29 tests (was 20). | `npx vitest run tests/unit/landing-camera-rail.test.ts` | **PASS** 29/29 |
| Full suite | — | `npx vitest run` | 1634 passed / 3 skipped / **1 pre-existing failure** in `tests/live/database.integration.test.ts:254` (live DB returns dispute-status enums the schema contract test does not expect; unrelated to this revision) |
| Typecheck / lint / build | — | `npx tsc --noEmit`, `npm run lint` (300s), `npm run build` | PASS — 0 type errors; 0 lint errors / 10 pre-existing warnings; `/` still `┌ ○ /` static |
| Browser pass | Playwright (Edge, 1280×720): fabricate a desktop capability gate, strip the proxy CSP via route interception (see gaps), scroll to p = 0/0.45/0.85/0.9/0.91/0.93/0.955/0.98/1, capture a frame each, diff consecutive frames. | `node probe-tmp.mjs` (throwaway, removed) | PASS — `data-webgl="on"`, canvas 1280×720; every departure pair differs (13.2–22.6 mean abs diff) so the dolly+truck are live at every stop, no freeze; stage rail advances 0→4→5 with the volume meter present; only console output is a SwiftShader shader-info warning (three.js WebGLProgram), no errors |

## Test specification (revision 4)

| # | What is guaranteed | Test file | Test type | Result |
|---|--------------------|-----------|-----------|--------|
| 43 | `DEPARTURE_EASE` is the original `(3.4t + 10t²)/13.4` curve and spans rest→full on both travels | `landing-camera-rail.test.ts` | unit | PASS |
| 44 | The dock ends up behind the camera: `FROZEN_DEPART_POS[0] + DOLLY_TOTAL > STATION_MAX_X` and the rig actually reaches it | `landing-camera-rail.test.ts` | unit | PASS |
| 45 | The dolly is a pure translation — `look − pos` is constant to 12 decimals across the entire departure (never a pan) | `landing-camera-rail.test.ts` | unit | PASS |
| 46 | The truck stays framed at the end of the road: rear-cargo-plane gap ≥ `MIN_TRUCK_FRAMING_DISTANCE` (10; actual ≈15.1 units) | `landing-camera-rail.test.ts` | unit | PASS |
| 47 | `cameraSettle` is 0 from `CAMERA_LOCK_AT` (0.88) and by dense sampling across `[CAMERA_LOCK_AT, 1]` at 0.01/0.001 steps | `landing-camera-rail.test.ts` | unit | PASS |
| 48 | Lockup completes before the dolly starts, and the dolly begins from the exact frozen pose at `DEPART_FREEZE_AT` (0.9) | `landing-camera-rail.test.ts` | unit | PASS |
| 49 | The rig never teleports (≤0.4 per unit of progress) and truck/dolly never reverse mid-departure | `landing-camera-rail.test.ts` | unit | PASS |

## Defects found by the tests during this revision

21. **The revision-3 'complement' invariant contradicted the new camera.** The
    legacy test asserted `cameraSettle(p) === 1 - departureProgress(p)`, i.e.
    the rig was meant to fade *during* the departure. Revision 4 locks the rig
    *before* the departure (settle 0 by p = 0.88, dolly starts at 0.9), so that
    assertion became a description of the bug it was supposed to prevent. It is
    one of the two fixed-box guarantees deleted, and the new reject-invariant is
    the opposite of it.
22. **`cameraSettle` left residual motion.** With the old `p >= CAMERA_LOCK_AT`
    guard the ramp was applied but never finished to exactly 0 before the dolly;
    the Ramp was retimed across `[0.86, 0.88]` using the same `easeInOutCubic`, so
    the settle reaches exactly 0 at `CAMERA_LOCK_AT`, leaving a 0.02-progress gap of
    full rigidity before the truck moves.
23. **Poles sat inside the camera path.** During the new travel the camera runs to
    `x = +7.7` at `z ≈ 7.0`; the lamp cylinder+glow at `z = 6.4` crossed the path
    ~1.15 units from the lens. Moved to `z = 10.5`; they now clear lateral leaving
    the frame ~6.7 units from the camera. The camera path itself is unchanged, so
    the load and shutter framing is untouched.

## Verification of the tests themselves

The two highest-risk new invariants were mutation-checked (file backed up,
mutated, run, restored — final state clean, 29/29 green):

| Mutation | Result |
|----------|--------|
| `departureDollyOffset` returns 0 (dolly removed) | **3 failed** — "runs both travels from rest to full distance", "uses one easing shared by the truck and the camera", "puts the dock behind the camera by the end of the departure" |
| `cameraSettle` lockout disabled (`if (false) return 0`) | **4 failed** — "is finished by the lock point, before the dolly starts", "reaches zero exactly at the lock point, continuously", "stays locked at zero for the whole departure span", "never goes negative or above one" |

## Known gaps (revision 4)

- The browser probe verified movement (every pair of consecutive frames across
  the dolly differs), stage progression 0→5 and zero console errors, but this
  agent cannot inspect image attachments, so the dock's visual exit is still
  argued from geometry + unit invariants. Screenshots are saved for a human at
  `C:\mnt\c\Codes\Projects\wesup\shots\dep-*.png` (host path; probe removed
  after use).
- **Pre-existing product concern surfaced by the probe:** the proxy
  (`proxy.ts`) sets a `strict-dynamic` + nonce CSP on every document, but Next.js
  only stamps nonces on dynamically rendered pages. `/` is statically
  prerendered (`┌ ○ /`), so under `next start` every one of its chunks is
  refused by its own CSP and the scene never mounts in a real browser session.
  The probe had to strip the CSP header via route interception to exercise the
  render. Fixes could include `await connection()` on the landing page or
  dropping `strict-dynamic`; both are out of scope here. **Fixed in Revision 5**
  via `await connection()`; the `strict-dynamic` option was considered and
  rejected. This entry was the only correct diagnosis of the defect in the whole
  report, sitting in a "known gaps" list for two revisions while the rest of the
  work was verified against a probe that removed the very header causing it.
- Full-suite run carries the pre-existing live-DB failure at
  `tests/live/database.integration.test.ts:254` (enum drift in the live
  database, unrelated to this revision).
- `.opencode/opencode.json` still holds 22 references to the invalid model id
  `anthropic/claude-opus-4-5` (see Environment note), so `@planner` cannot
  start; this revision was planned and approved in-session as before.
- The now-superseded revision-3 fade/complement tests were deleted rather than
  retained as expected-failures; the git history is the only record of them.

---

# Revision — Premium type overlay (Sep 2026)

**Task:** Keep the 3D scene as the picture. Pin copy, stage rail, and CTAs in a reserved left column (bottom panel on mobile) with a readable wash, Newsreader headlines, Geist Mono eyebrows, and a CSS word-stagger on beat change. Header overlays the first viewport instead of covering 64px of the canvas.

## User journeys (this revision)

11. As a visitor, I want the story and both CTAs on the sticky viewport, so I can sign up without scrolling past the whole scene.
12. As a visitor, I want headlines to sit in a reserved column, so type does not collide with the truck.
13. As a visitor who prefers reduced motion or has no WebGL, I still want a stacked readable story and the same CTAs, with no stagger.

## Task report

| Plan task | Execution summary | Validation command | Result |
|-----------|-------------------|--------------------|--------|
| Overlay column + CTAs in viewport | `HeroScene` overlay is a type column; CTAs/rail/trust live in `.hero-scene__cta` inside the sticky viewport. No sibling after the viewport. | `npx vitest run tests/components/HeroScene` | PASS — "pins the calls to action inside the overlay column, not after the scroll track" asserts both CTAs resolve inside `.hero-scene__overlay`, that `.hero-scene__cta` is inside `.hero-scene__viewport`, and that the viewport has no next sibling |
| Landing display font | Newsreader as `--font-newsreader` / `font-landing-display`; Geist remains the product sans. | `npm run build`, `npm run lint` | PASS (structural only) — the font resolves and both gates are clean. **Not visually verified**: no browser pass was run for this revision, so "premium" is asserted, not measured |
| Beat word stagger | Title split into word spans; CSS animation delayed by `--i`. Disabled when `data-webgl="off"` or reduced motion. | `npx vitest run tests/components/HeroScene` | PASS — 2 new tests (items 50–51), both mutation-checked. Existing content tests still match full titles because the `sr-only` node holds the whole string |
| Header overlay | Landing header is `fixed` translucent; features uses `scroll-mt-24` for `#features`. | `npm run build` | PASS (structural only) — **not visually verified.** The motivating complaint was that the old `sticky` header covered 64px of canvas; nothing in this revision re-measured that, so the fix is unproven in a browser |
| Full suite | — | `npx vitest run` | PASS — 175 files, 1638 tests, 0 failures beyond the pre-existing live-DB enum drift at `tests/live/database.integration.test.ts:254` (3 live skipped, no credentials) |
| Typecheck / lint / build | — | `npx tsc --noEmit`, `npm run lint`, `npm run build` | PASS — 0 type errors; 0 lint errors / 10 pre-existing warnings in unrelated files. `/` is `┌ ƒ /` dynamic — see Revision 5 for why that is now correct and was previously the bug |

## Test specification

| # | What is guaranteed | Test file | Test type | Result |
|---|--------------------|-----------|-----------|--------|
| 50 | Every headline is exposed to assistive tech exactly once, as whole words, and the per-word stagger spans are all inside an `aria-hidden="true"` subtree | `HeroScene.test.tsx` | component | PASS |
| 51 | Stagger delay indices (`--i`) run in reading order, so the words cascade rather than appearing together | `HeroScene.test.tsx` | component | PASS |
| 52 | Both CTAs resolve inside the overlay column, which is inside the sticky viewport, with no sibling after the viewport | `HeroScene.test.tsx` | component | PASS (carried over from the "CTA in viewport" task) |

## Defect found after this revision was written

24. **The word split was a screen-reader regression shipped unlabelled.** Splitting a headline into one span per word is required for the stagger, but the split is what assistive tech walks. As first written, the six beats would have been announced as disconnected fragments ("Harga" "Tier" "2" "terkunci") and, with the split left un-hidden, announced twice. The fix keeps an `sr-only` full-title node and marks the word subtree `aria-hidden`; items 50–51 now pin it. This was found by reading the final diff after the implementing session was terminated mid-edit, not by a test failure — no test existed to fail.

## Verification of the tests themselves

Both new tests were mutation-checked (file backed up, mutated, run, restored — final state clean, 13/13 green):

| Mutation | Result |
|----------|--------|
| Delete the `sr-only` full-title node from `BeatHeadline` | **2 failed** — "exposes each headline once, as whole words…", and the pre-existing "renders every stage headline into the DOM" |
| Pin `--i` to `0` for every word (stagger becomes simultaneous) | **1 failed** — "stagger delay indices run in reading order so the words cascade" |

The second mutation is the reason item 51 exists. The stagger is pure CSS driven by a custom property, so pinning the index to a constant produces markup that is structurally identical and visually inert — the DOM would still look correct and the feature would be dead.

## Known gaps (type overlay revision)

- **Nothing in this revision was seen in a browser.** The column, the wash, the Newsreader pairing, the stagger timing, and the header overlay are all verified as structure only. The two goals that are inherently visual — "type does not collide with the truck" (journey 12) and "header overlays the first viewport instead of covering 64px of canvas" — are argued from CSS, not measured. This is the same known gap revisions 3 and 4 recorded, now extended to a revision whose entire subject matter is visual.
- The wash is a hardcoded `rgb(248 250 252 / …)` in `globals.css` rather than a token, so it will not follow a future change to the surface palette.

---

# Revision 5 — CSP nonce fix: `/` was blocking its own scene

**Task:** The 3D scene never mounted in a real browser. Every script on the landing page was refused by the page's own Content Security Policy.

## The defect

`proxy.ts` attaches a `strict-dynamic` + nonce CSP to every public document, and passes the nonce down via the `x-nonce` request header. Next.js stamps that nonce onto the `<script>`/`<style>` tags **it emits while rendering a page for an incoming request**. A statically prerendered page has no request to stamp: it ships nonce-less tags, and because `strict-dynamic` disables host allowlisting, `'self'` is not consulted as a fallback. Every chunk is blocked by its own policy.

This was flagged as an out-of-scope "pre-existing product concern" in revision 4, and correctly diagnosed there: the probe had to strip the CSP header via route interception to exercise the render at all. The net effect was that every pixel of three.js work in revisions 1–4 was invisible to a real visitor, and no test caught it, because every verification was a component test or a probe with the CSP removed.

| # | Defect | Root cause | Fix |
|---|--------|-----------|-----|
| 25 | The scene never mounted in a real browser; `/` was blank apart from the type overlay | `/` was statically prerendered, so Next.js emitted no nonce and `strict-dynamic` refused the nonce-less chunks | `await connection()` in `app/page.tsx`, opting the landing page into per-request rendering so the nonce is actually stamped |

## The trade-off, recorded rather than absorbed

`connection()` is one of the two options revision 4 floated; the other was dropping `strict-dynamic` from `lib/security/csp.ts`. **`connection()` was chosen**, and the user approved it with the cost stated explicitly:

- **Given up:** `/` is no longer statically prerendered. `npm run build` reports `┌ ƒ /` instead of `┌ ○ /`, so every landing-page request is now server-rendered rather than served from a prerender artifact. `/` joins the other 60+ dynamic routes in the app, so this is no longer an outlier.
- **Kept:** the CSP stays `strict-dynamic` on every route, including `/pesanan/[id]/bayar` where Midtrans needs host allowlisting.
- **Rejected:** relaxing the policy globally to preserve prerendering. Weakening CSP on every route to save one page's render is the wrong trade for a payments app, and it would have masked the real problem rather than fixing it.

## Task report

| Plan task | Execution summary | Validation command | Result |
|-----------|-------------------|--------------------|--------|
| `app/page.tsx` | `await connection()` from `next/server`, with a comment recording why. This reverses revision 1's "remove `force-dynamic`" change. | `npm run build` | PASS — `/` is `┌ ƒ /` |
| `tests/unit/csp-nonce-page-contract.test.ts` | New contract test. It is a **source-reading** test, not a render test: it asserts `app/page.tsx` imports from `next/server` and calls `await connection()`. | `npx vitest run tests/unit/csp-nonce-page-contract.test.ts` | PASS |

## Test specification (revision 5)

| # | What is guaranteed | Test file | Test type | Result |
|---|--------------------|-----------|-----------|--------|
| 53 | The landing page opts into per-request rendering, so the proxy's nonce is stamped onto its script tags | `csp-nonce-page-contract.test.ts` | contract | PASS |

## Why this test is weaker than it looks

It reads `app/page.tsx` as text. It cannot prove the nonce is actually stamped, that the CSP is attached, or that the scene mounts — it only proves the opt-in call is present and has not been deleted. That is deliberate: the real assertion is a browser one (load `/`, confirm a canvas and no CSP violations), and this repo has no committed Playwright spec for the scene, so there was no harness to write a real one against. A source-reading test that pins a load-bearing call is better than nothing, but the underlying guarantee is still unverified end to end, and this report does not claim otherwise.

## Known gaps (revision 5)

- The scene has still never been confirmed to mount against a real, unmodified CSP in a committed test. The contract test is a proxy for that, not a substitute.
- Making `/` dynamic was chosen without measuring its cost. No TTFB, cache-hit, or edge-render figure was taken before or after. The claim is that matching the other 60+ routes is acceptable, not that it is free.
- `strict-dynamic` remains a latent trap for any future route added to the app: any statically prerendered public page will silently ship nonce-less scripts and break the same way. The contract test covers `/` only, and it covers it by reading source. A route-level guard in `proxy.ts`, or a test that enumerates the build manifest and fails on any public static route, would remove the whole class — neither was done here.



---

# Revision 6 — wash alignment, typography, and a real-browser pass

## The defect

Above 1152px the hero's readability wash began partway across the screen. `.hero-scene__overlay` carried `max-w-6xl`, and the wash gradient was painted on that centred column, so the left edge of the readability layer sat at the container's left edge (224px at 1920) instead of the viewport's. A 1440px-wide wash with a hard left edge read as a visible vertical seam running the full height of the hero, directly against the page's left boundary.

The copy column had the same defect in reverse: because the wash started at the container rather than the screen, there was no reason for the column to line up with the header, and it did not.

## Root cause and fix

The wash and the copy were one element, so one `max-width` governed both. They are now separate layers with different constraints:

| # | Defect | Root cause | Fix |
|---|--------|-----------|-----|
| 26 | A full-height vertical seam in the hero above 1152px | The wash gradient was painted on `.hero-scene__overlay`, which carried `max-w-6xl` | New `.hero-scene__wash` sibling layer, `left-0`, `w-full md:w-[52vw]`, positioned independently of the copy container |
| 27 | Copy column did not align with the header at desktop | Overlay was `max-w-6xl` and self-centring, with its own padding | Overlay now uses the shared `container mx-auto` gutter; `.hero-scene__column` is `max-width: min(32rem, 34vw)` on desktop |
| 28 | Wash gradient could still terminate abruptly | Desktop gradient's last stop had residual alpha | Desktop gradient now reaches alpha `0` at 100%; mobile keeps the full-width `to top` gradient |
| 29 | The wash could intercept clicks over the scene | Decorative layer sat above the scene with default pointer events | `pointer-events-none` and `aria-hidden="true"`, asserted in tests |
| 30 | WebGL fallback still painted a wash over a flat background | Fallback rendered a gradient with nothing behind it | Fallback hides the wash and the rail |
| 31 | Reduced-motion users received the full entrance animation | The animation set was unconditional | Animations are gated on `data-motion="on"`, set only when motion is permitted and WebGL is live |
| 32 | Block order was only expressed by `--i` on some children | Eyebrow, words, body, chip and meter were not all indexed | Indices fixed: eyebrow `0`, words `1…n`, body `2`, chip `3`, meter `4`; asserted top-to-bottom in the DOM |

## Decisions recorded rather than assumed

- **Only `transform` and `opacity` are animated.** Text `width`/`height` is never animated, so no reflow is triggered per word and the headline does not reflow as the beat changes.
- **CTA copy is unchanged** (`Mulai Hemat Bersama`). Two tests asserted the older `Mulai hemat` wording and were failing. The tests were wrong, not the copy, so the assertions were corrected rather than the product text. That correction was mutation-checked: reverting the regex to the old wording fails the suite.
- **The wash colour is `--hero-wash: 246 248 251`**, matching the scene's `COVE_COLOR = 0xf6f8fb`, so the flat fallback and the WebGL sky are the same tone.

## Task report

| Plan task | Execution summary | Validation command | Result |
|-----------|-------------------|--------------------|--------|
| `components/landing/scene/HeroScene.tsx` | Added wash layer, `data-motion`, per-beat `--i` indices, `--rail-index`, retuned headline scale/leading/tracking | `npx vitest run tests/components/HeroScene.test.tsx` | PASS (19) |
| `app/globals.css` | `--hero-wash` token, responsive wash gradient, container-aligned overlay, gated block/word/rule animations, rail indicator and breathing, fallback and reduced-motion overrides | `npx vitest run tests/components/HeroScene.test.tsx` | PASS |
| `app/layout.tsx` | Newsreader loaded with `axes: ["opsz"]`; `font-optical-sizing: auto` made explicit in CSS | browser probe of computed styles | PASS |
| Two stale CTA assertions | Corrected the regex to `/mulai hemat bersama/i`; product copy untouched | `npx vitest run tests/components/HeroScene.test.tsx` | PASS (23 across both files) |

## Test specification (revision 6)

| # | What is guaranteed | Test file | Test type | Result |
|---|--------------------|-----------|-----------|--------|
| 33 | The wash is anchored to the viewport's left edge and widens to 52vw on desktop, staying full-width on mobile | `HeroScene.test.tsx` | component | PASS |
| 34 | The wash is a sibling of the overlay, not the overlay itself | `HeroScene.test.tsx` | component | PASS |
| 35 | The overlay is container-aligned and no longer capped at `max-w-6xl` | `HeroScene.test.tsx` | component | PASS |
| 36 | The wash is hidden from assistive tech and cannot intercept pointer events | `HeroScene.test.tsx` | component | PASS |
| 37 | Beat blocks are ordered eyebrow → words → body → chip → meter in the DOM | `HeroScene.test.tsx` | component | PASS |
| 38 | Word stagger indices strictly increase | `HeroScene.test.tsx` | component | PASS |
| 39 | No entrance animation is emitted when WebGL is unavailable, or when the user prefers reduced motion | `HeroScene.test.tsx` | component | PASS |
| 40 | `data-motion="on"` is set when WebGL is live and motion is permitted | `HeroScene.scene.test.tsx` | component | PASS |

`tests/components/HeroScene.test.tsx` (19) and `tests/components/HeroScene.scene.test.tsx` (4) — **23 passed**.

## Mutation checks

Every meaningful mutation was killed, because a passing assertion proves nothing unless the wrong code fails it:

| Mutation | Result |
|----------|--------|
| Wash anchored to the right instead of the left | killed |
| Wash width changed from `52vw` | killed |
| Overlay restored to `max-w-6xl` | killed |
| Overlay container gutter removed | killed |
| `aria-hidden` removed from the wash | killed |
| `pointer-events-none` removed from the wash | killed |
| Block order permuted (chip before body) | killed |
| Word stagger indices made non-increasing | killed |
| `data-motion` forced to `off` in the fallback and reduced-motion paths | killed |
| `data-motion` never set to `on` in WebGL mode | killed |
| CTA assertion reverted to the old wording | killed |

## Real-browser verification

Revisions 1–4 verified the scene with component tests and a probe that stripped the CSP header. Revision 5 recorded that the scene had never been confirmed to mount against a real, unmodified CSP. This revision closes that gap: the browser pass below loaded `http://localhost:3000` with **no route interception and no header stripping**, and reported no console errors.

Screenshots were decoded in-process (zlib + PNG unfilter) and the pixels measured, rather than eyeballed.

| Viewport | Wash right edge | Wash width | Copy column x | Header x | Aligned | Headline | WebGL | Motion | Left-edge seam | Wash-boundary seam |
|----------|-----------------|------------|---------------|----------|---------|----------|-------|--------|----------------|-------------------|
| 1280×720 | 666 | 665.6 | 32 | 32 | yes | 44px Newsreader | on | on | 0.0% | 0.0% |
| 1440×900 | 749 | 748.8 | 112 | 112 | yes | 44px Newsreader | on | on | 0.0% | 0.0% |
| 1920×1080 | 998 | 998.4 | 224 | 224 | yes | 44px Newsreader | on | on | 0.0% | 0.0% |
| 2560×1440 | 1331 | 1331.2 | 544 | 544 | yes | 44px Newsreader | on | on | 0.0% | 0.0% |
| 390×844 | 390 | 390 | 16 | 16 | yes | 24px Newsreader | on | on | 0.0% | 0.0% |

The wash width is exactly `52vw` at every desktop width (665.6 = 0.52 × 1280, 748.8 = 0.52 × 1440, 998.4 = 0.52 × 1920, 1331.2 = 0.52 × 2560) and full-width on mobile. The copy column's left edge equals the header's left edge at all five widths, and the wash now reaches `x = 0`.

**How the seam is measured.** A vertical seam steps the colour at the same `x` on essentially every row, so each column boundary is scored by the *fraction of rows* whose colour jumps by more than 30 across that boundary. A real seam scores near 100%; a glyph, border or shadow scores a few percent. Both boundaries that can form a seam — the viewport's left edge and the wash's own right edge — score **0.0%** at all five viewports, meaning zero rows jump at either.

## Measurement traps hit while verifying this, and why the first numbers were wrong

Recording these because each one produced a confident, wrong "SEAM" verdict:

1. **One shared browser for all viewports.** WebGL initialised for the first page and never again, so viewports 2–5 silently rendered the *static fallback* and reported `webgl=off`. The wash was correctly `display: none` in those runs, so the numbers described the wrong layout entirely. Fixed by launching a browser per viewport.
2. **`visibility: hidden` does not stop a composited WebGL layer from painting.** Removing the overlay left the truck's silhouette in the pixels, and the scan reported a 616/765 "discontinuity" that was the truck. Fixed by removing the canvas element from the DOM.
3. **Named-class hide lists leak.** Hiding `.hero-scene__overlay`, `.hero-scene__cta`, `.hero-scene__beats` and `.hero-scene__rail` left the headline visible, producing a 373/765 "discontinuity" that was the `h1` glyphs. Fixed by hiding every child of the sticky viewport except the wash, structurally rather than by name.
4. **`clip` is in document coordinates, and the header is `position: fixed`.** A clipped strip at document `y=288` captured a fixed header sitting at document `y≈235–299` after a stage-scroll, so the "seam" was the header's bottom border. Fixed by pinning `scrollTo(0, 0)` and screenshotting the viewport without a document clip.
5. **A single worst pixel is the wrong statistic.** The largest adjacent-pixel jump in a hero is whatever the truck's edge or a text glyph happens to be. Only the *fraction of rows* jumping at a boundary distinguishes a line from an object.

After all five, the result is stable and the failures had nothing to do with the CSS under test.

## Other checks

- `npx tsc --noEmit` — clean.
- `npx eslint` on the changed TSX files — clean. The CSS file is not covered by the current ESLint config; the global stylesheet is not linted.
- `npm run build` — `✓ Compiled successfully`.
- `npm run lint` (repo-wide) exceeded a 300s timeout and produced no result, so **no claim is made about the full lint suite**. The targeted runs above are the only lint evidence.

## Known gaps (revision 6)

- **The browser pass is not a committed test.** It was an ad-hoc Playwright script, since deleted. Every guarantee in the table above reverts silently if someone edits the wash CSS again, because the component tests assert class names and geometry hooks, not rendered pixels. The highest-value follow-up is a committed Playwright spec that asserts the wash's rendered left edge is `x = 0` and that no column boundary at the wash's right edge steps more than a few percent of rows.
- **No visual review was performed.** Every claim here is numeric: bounding boxes, computed styles, and pixel measurements. Nobody confirmed the result looks good. Gradient stops and the `52vw` width are measured, not judged.
- **SwiftShader only.** WebGL ran on a software rasteriser. Real GPU drivers may composite the WebGL layer and the CSS gradient differently, and a blend-mode or filter added later would not show up here.
- **The wash colour is duplicated as a hex literal in `HeroSceneCanvas.tsx`.** `COVE_COLOR = 0xf6f8fb` and `--hero-wash: 246 248 251` must stay in sync by hand. A comment records the coupling; nothing enforces it.
- **The dev server crashed mid-run** at 1920×1080 (WebSocket `ERR_CONNECTION_REFUSED`, then a failed navigation), and full-viewport 2560×1440 screenshots time out on a page this heavy. Both were worked around — per-viewport browsers and clipped strips — but the underlying instability was not diagnosed, and the earlier runs in this report were re-taken after it.
