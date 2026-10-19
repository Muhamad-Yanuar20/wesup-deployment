# Role A redesign — TDD and execution record

Plan: approved in this chat, 2026-10-19. Visual authority: DESIGN.md and the existing landing. The local high-end-visual-design skill is adapted to Swiss Industrial Print.

## Constraints and rulings

- Fourteen Role A routes plus their client components and shared shells. No API handlers, schema, business rules, landing components, admin page files, B/C page content or redirect stubs are changed.
- Ruling: use a local feature branch (`codex/redesign-role-a`) in the supplied checkout, preserving installed dependencies and environment. No extra checkout is required for this UI-only change.
- Ruling: retain the existing props of shared chrome. Supplier finance gets an optional `view` prop, defaulting to `overview`.
- Ruling: finance screens render only balances/accounts/payouts supplied by the existing API; no fabricated escrow transactions or timers.
- Ruling: existing order pages already render Layout. Keep the guard-only pesanan layout intact so navigation and main landmarks are not duplicated.
- Shared map chrome and the public/admin LoginForm are shared dependencies; their existing functional contracts remain intact.

## RED

- Command: `npx vitest run tests/unit/landing-brutalist-contract.test.ts tests/components/SupplierFinanceViews.test.tsx --maxWorkers=2`.
- Result before implementation: **59 failed, 26 passed**. The new contract detects old colors, radii, shadows and gradients. Behavioral failures demonstrate missing finance views and an ignored unavailable-module description.
- Baseline from planning: 94 tests in 11 files passed.
- Windows Vite cache uses `node_modules/.cache/role-a` as process-local TEMP/TMP to avoid the sandbox temporary-directory rename error.

## Execution ledger

- Shared chrome: paper/ink shell, role navigation and active markers, mobile safe area, PageHeader typography, inverted footer, supplied unavailable-module description. Guards and consumer props preserved.
- Auth: shared AuthHeader, paper plates and frame panels, mono labels, visible red selected-role boundary, Supplier steps/photo/review/status. Existing form validation, returnTo, compression and recovery preserved.
- Marketplace: frame-panel product readouts, spec rows, numeric typography, thin progress meters animated with transforms. Existing debounce, pagination, abort handling, consent, join, polling, share and server detail loader preserved.
- Finance: optional overview/escrow/bank-account views over the same GET; bank PUT and payout POST payloads unchanged. Confirmation, duplicate-submit protection, retained input on failure, retry, unavailable-vs-zero balances and primary-account requirement covered by component tests.
- Notifications: mono categories and timestamps, red unread markers; marking read only after PATCH succeeds, with failure/retry coverage.
- Utilities: scoped paper Swagger CSS (including vendor controls), Basic Auth and disabled Try it out retained; help reuses B's TransactionSupport; Leaflet selection/geolocation/manual fallback preserved.

## Browser and independent review corrections

- RED: actual 320px browser rendering exposed a Marketplace PageHeader overflow. The decorative icon is now hidden below sm, and heading text can wrap. All four widths are exercised in the browser suite.
- Independent reviewer found two P2 regressions: an unlayered shared background overrode the untouched admin login's dark background; map origin/pickup colors no longer agreed with their legends.
- RED: the admin contrast regression test measured **1.10:1**, below the required 4.5:1. Remove global substrate/text defaults; each redesigned root explicitly owns its colors.
- RED: expanding the palette contract caught two remaining orange/sky decorations. Remove the obsolete Supplier success glow and use matching ink origin/red pickup markers and legends. Browser tests inspect the real Leaflet SVG fills.
- The reviewer found no additional finance payload, guard, notification, or fixture-cleanup regressions. Every screenshot was not independently reviewed; the implementer inspected representative desktop/mobile screenshots.

## Verification coverage

| Area | Coverage |
| --- | --- |
| 4 public auth/registration pages | Real render at 320/390/768/1440; form/role/redirect/recovery tests in the full unit suite |
| Supplier status | Disposable pending Supplier with the normal server guard and profile read |
| Marketplace list/detail | Real server detail fixture, actual Leaflet render; search error/retry, tablet/mobile filter dialog and focus restoration; unit consent/profile gate/live join |
| Finance 3 views | Deterministic browser API responses; server guards real; payout confirmation, 409 recovery, focus restoration; component payload and pending/zero/primary-account cases |
| Supplier notifications | Success/failure read-state tests; browser mark-all-read |
| Help | Real server registration read for a disposable UMKM; existing shared support component |
| API docs | Actual Basic Auth challenge/spec load, paper rendering, disabled Try it out |
| Leaflet demo | Real interactive map render; existing coordinate tests and preserved manual/geolocation controls |
| Shared admin consumer | Fixed admin role and measured text/background contrast |

Browser fixture mutations are restricted to generated disposable accounts, one test batch and registration. Finance/notification mutations are intercepted. Cleanup deletes the fixture registration before its batch and users; early interrupted-run fixtures were identified by this task's unique prefix and removed.

## GREEN and final validation

Final checks after the review corrections:

| Command | Result | Evidence |
| --- | --- | --- |
| `npm test` | **221 files / 2037 tests passed**, including configured live tests | `role-a-tests-final.log` |
| `npx playwright test tests/e2e/role-a-redesign.spec.ts tests/e2e/docs.spec.ts` | **6 passed**; all 14 routes at 320/390/768/1440, admin contrast, map colors, recovery and focus | `role-a-browser-complete.log` |
| `npm run lint` | Exit 0; **0 errors, 14 existing warnings**, none in redesigned production files | `role-a-lint-final.log` |
| `npm run build` | Exit 0; schema preflight, compile, TypeScript and production route generation succeeded | `role-a-build-complete.log` |
| `npx tsc --noEmit` | Exit 0; no diagnostics | `role-a-typecheck-final.log` |
| `git diff --check` | Exit 0 | Checked after source normalization |
| Disposable-fixture audit | **0 users / 0 batches remaining** | Read-only audit after browser teardown |

The first sandbox run could not resolve Supabase/Redis hosts. The final suite/build/browser runs used approved network access. A pre-existing malformed `.next/dev/types/routes.d.ts` cache was archived and regenerated; no tracked Next configuration was changed. Older failure/debug logs are archived under ignored `node_modules/.cache/role-a/logs`.

Visual evidence is in `docs/testing/role-a/`: login, marketplace and finance at 390px and 1440px. The browser suite stores all route screenshots as ignored Playwright test artifacts. Screenshots contain disposable fixture data, and no session cookies or credentials are saved in these evidence files.

Limits: this is a responsive/interaction check with representative manual screenshot inspection, not a complete WCAG audit or a pixel-baseline comparison. Swagger's existing React lifecycle warning and Next's existing workspace-root warning remain; dependencies and project configuration were not changed for unrelated warnings.

## Delivery self-evaluation

| Axis | Score | Evidence / improvement |
| --- | --- | --- |
| Accuracy | 4/5 | Unit, live and browser checks passed; browser finance mutations use deterministic fixtures rather than real transfers. |
| Completeness | 4/5 | All 14 routes and four widths covered; independent screenshot inspection was sampled. |
| Clarity | 4/5 | Scope, rulings, regression fixes and verification are recorded here; the multi-surface diff remains substantial. |
| Actionability | 4/5 | Reproduction commands, final logs and six representative screenshots are available; work remains local for review. |
| Conciseness | 4/5 | Raw historical failures are archived; the delivery summary can link this record. |

Overall: 4.0/5. Future improvements would be committed screenshot baselines and a dedicated accessibility audit. Self-check: the implemented scope and stated verification limits match the approved plan.
