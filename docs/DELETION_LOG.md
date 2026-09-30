# Deletion Log

Dead-code and duplication removals from `refactor-cleaner` runs. Every entry
records what was removed, the evidence used to classify it, and how the removal
was verified.

Risk classes used below:

| Class | Meaning |
| --- | --- |
| **SAFE** | No reference anywhere in `app/`, `components/`, `hooks/`, `lib/`, `store/`, `tests/`, `scripts/`. |
| **CAREFUL** | Reached only through a dynamic import or a path string; verified before removing. |
| **RISKY** | Touches a contract asserted by a test, a dataflow, or an intentional lazy-load boundary. Left in place. |

---

## 2026-09-30 — Landing 3D hero scene dead-code pass

**Scope:** modified + untracked landing-hero work only
(`components/landing/scene/*`, `lib/landing/*`, `hooks/use-scroll-progress.ts`,
`app/page.tsx`, `app/layout.tsx`, `app/globals.css`, `hooks/index.ts`,
`playwright.config.ts`, the new `tests/**` landing + scene suites, `package.json`).

**Detection:** `knip` (unused files / exports / types / deps), `depcheck`,
`ts-prune`, `eslint`, plus exhaustive `grep` reference audits across every
source root. Deliberately out of scope: repo-wide pre-existing noise
(`.agents/skills/**`, `scripts/**`, `tests/live/**`, and tracked landing
components orphaned by the `app/page.tsx` rewrite).

### Dependencies removed

None. `three@^0.186.1` and `@types/three@^0.186.0` are both genuinely imported
by `components/landing/scene/renderer.ts` / `textures.ts` and were kept.

### Dependencies added (tooling)

`knip`, `depcheck`, `ts-prune` added as devDependencies, each wired to an npm
script so they are real tooling rather than unused devDeps:

| Script | Tool |
| --- | --- |
| `npm run clean:unused` | `knip` |
| `npm run clean:unreachable` | `ts-prune` |
| `npm run clean:deps` | `depcheck` |
| `npm run clean:deadcode` | all three, in sequence |

### Duplicates consolidated

None found. `lib/landing/camera-rail.ts` was checked first as the prime suspect
(it needs the same easing/clamp helpers the renderer does) and it **already**
imports `clamp01` and `easeInOutCubic` from `./math` rather than redefining
them. `math.ts` is the single implementation for every consumer
(`renderer.ts`, `camera-rail.ts`, `scene-timeline.ts`, `use-scroll-progress.ts`).

### Exports removed

All removals are in `lib/landing/index.ts` — dead *re-exports* only. No
underlying definition was deleted, so every deep-importing consumer
(`renderer.ts`, `textures.ts`, and the landing unit tests, which import
`@/lib/landing/crate-lattice`, `@/lib/landing/camera-rail`, and
`@/lib/landing/math` by path) is unaffected.

| Removed re-export | Source | Evidence |
| --- | --- | --- |
| `CARGO`, `CRATE`, `CRATE_COUNT`, `CRATE_SEATS`, `DOOR_CLEAR_HALF_WIDTH`, `PICKUP_AT`, `SCENE_PHASES`, `SEAT_ROT_JITTER`, `TIER_UNLOCK_AT`, `contactGap`, `crateOuterZEdge`, `doorZClearance`, `frontGap`, `headroom`, `interiorZClearance`, `rearClearance`, `seatsAreFlush` | `./crate-lattice` | All 7 barrel consumers (`app/page.tsx`, `HeroScene.tsx`, `renderer.ts`, 4 test files) import **only** `scene-timeline` symbols. Every crate-lattice consumer imports by deep path. SAFE. |
| `type CrateSeat` | `./crate-lattice` | No importer of any kind. SAFE. |
| `CAMERA_KEYS`, `CAMERA_LOCK_AT`, `DEPART_FREEZE_AT`, `DEPARTURE_EASE`, `DOLLY_TOTAL`, `FROZEN_DEPART_LOOK`, `FROZEN_DEPART_POS`, `MIN_TRUCK_FRAMING_DISTANCE`, `STATION_MAX_X`, `TRUCK_DEPART_TOTAL`, `cameraSettle`, `departureCameraRig`, `departureDollyOffset`, `departureProgress`, `sampleCamera`, `sampleCameraRail`, `truckDepartureX` | `./camera-rail` | `renderer.ts` imports the 4 it needs via `@/lib/landing/camera-rail`; `landing-camera-rail.test.ts` deep-imports the rest. Nobody used the barrel. SAFE. |
| `type Vec3` | `./camera-rail` | No importer. SAFE. |
| `type Beat`, `type Tier` | `./scene-timeline` | The only other `Tier` in the repo is a different type (`@/lib/orders/time-gatekeeper`). No importer. SAFE. |
| `export * from "./math"` (re-exports all 9 math helpers) | `./math` | Every math consumer imports by deep path: `renderer.ts`, `camera-rail.ts`, `scene-timeline.ts`, `use-scroll-progress.ts`, `landing-math.test.ts`. No barrel consumer takes a math symbol. SAFE. |

**Result:** `lib/landing/index.ts` 71 → 21 lines, now a single-purpose barrel
for the narrative timeline. The retained `scene-timeline` block
(`BEATS`, `STAGE_EDGES`, `stageForProgress`, `TIERS`, `formatKg`, `formatRupiah`,
`lockedTierForKg`, `nextTier`, `resolveBeat`, `TARGET_*`, `SCENE_LENGTH_*`) is
proven live by the 7 consumer imports enumerated above.

### Files deleted

None.

### RISKY items deliberately left alone

- **`three` stays a lazy dynamic import.** `HeroScene.tsx` does
  `dynamic(() => import("./HeroSceneCanvas"), { ssr: false })` and the canvas
  does `await import("three")`. This is intentional: a reduced-motion or
  data-saver visitor must never download the library. Converting it to a static
  import was explicitly ruled out.
- **Scene DOM contract preserved.** `tests/e2e/hero-scene.spec.ts` pins
  `data-scene-root`, the `data-webgl` on/off attribute values,
  `data-testid="hero-scene-canvas"`, the `data-testid="hero-scene-wash"`
  bounding box at 5 viewports, and the nonce-CSP mount. No DOM, attribute, or
  geometry was touched.
- **Exported geometry helpers kept exported.** `seatsAreFlush`,
  `rearClearance`, `interiorZClearance`, `frontGap`, `headroom`, `contactGap`,
  `crateOuterZEdge`, `doorZClearance`, `DOOR_CLEAR_HALF_WIDTH` are unused by the
  renderer but are asserted by `tests/unit/landing-crate-lattice.test.ts`. Tests
  count as references, so only their barrel re-exports were removed.
- **`app/globals.css` landing styles untouched.** No dead-CSS removal was
  attempted: it is all reachable from `app/page.tsx` / `HeroScene.tsx` class
  names and the risk of a visual regression is not worth it for zero
  measurable gain.
- **Out-of-scope findings recorded, not acted on:** the tracked
  `components/landing/{Hero,Features,HowItWorks,CtaSection,LandingHeader,LandingFooter,index}.tsx`
  are now unreferenced because the modified `app/page.tsx` inlined their
  content. They are tracked and unmodified, so removing them is a product
  decision, not a refactor. Also pre-existing and unrelated: `tailwindcss` /
  `@tailwindcss/postcss` look unused to `depcheck` (used via PostCSS/CSS, which
  it cannot see), and `vite` is an undeclared dep of `vitest.config.ts`.

### Impact

- Files changed: 2 (`lib/landing/index.ts`, `package.json`).
- Lines removed: 50 (barrel re-exports).
- Dependencies: 3 devDeps added (tooling), 0 removed.

### Verification

| Gate | Baseline (before) | After |
| --- | --- | --- |
| `npm run lint` | 0 errors, 10 warnings | 0 errors, 10 warnings (unchanged) |
| `npm test` | 174 files passed / 1 failed / 1 skipped; 1604 tests passed | **identical** |
| `npm run build` | — | succeeded |
| `knip` unused exports in `lib/landing/**`, `components/landing/scene/**`, `hooks/use-scroll-progress.ts` | 42 barrel re-exports + 4 types | **0** |

The one failing test is `tests/live/database.integration.test.ts` — a pre-existing,
environmental failure (live-Supabase enum drift; `tests/live/*` needs real
credentials per `AGENTS.md`). It fails identically on the untouched baseline and
was not touched. No test file was modified in this pass.
