# Navigation and fresh supplier drafts — TDD evidence

Date: 1 October 2026 (WIB).

## Reported problems and causes

- Dashboard and Katalog were both active because each link independently matched every descendant URL. The same issue affected UMKM navigation and the duplicate pending-supplier Status/Akun destinations.
- Each navigation-bar mount started with guest state and fetched the session again. Moving between page shells briefly replaced the signed-in menu with public links.
- The offer wizard automatically read one local-storage slot per supplier and restored its product, saving identity, schedule, and last step, even when opening a new offer.

## Red evidence

Before implementation, `npx vitest run tests/components/NavigationBar.test.tsx tests/components/OfferWizard.test.tsx --reporter=dot` produced **12 failed / 8 passed**, plus one uncaught error from the old wizard reading `pickupStartsAt` on a corrupt null schedule.

Failures demonstrated two active links for supplier catalog/new/edit and nested UMKM orders; duplicate active pending-supplier links; automatic review-step restoration; overwritten/empty local recoveries; and absent explicit recovery controls. Tests were written before their implementation changes.

An additional publication regression was reproduced separately: `npx vitest run tests/components/OfferWizard.test.tsx -t 'removes every recovery'` failed because a copied offer's local recovery remained after the same offer was published from its server draft. Cleanup now follows the offer identity across that supplier's copy scopes, preserving unrelated drafts and other suppliers' storage.

## Implemented behavior

- The root layout resolves `getViewerAccessState` and seeds a persistent client navigation provider. Page-shell remounts and session revalidation keep the last known menu; connection failures and HTTP 5xx do not erase it. HTTP 401/403 clears workspace links. Login, logout, and new server snapshots update the shared state; cancelled/stale requests cannot undo logout.
- Dashboard matches its exact URL. Other entries match themselves and segment-bounded descendants. One most-specific entry wins, with the first entry winning an equal-URL tie. Desktop and mobile use the same result.
- New offers start at Produk with the normal defaults and supplier location. A named **Lanjutkan Draft** control explicitly restores a local recovery. Storage is separated by supplier and offer/creation identity; untouched forms are not persisted. Legacy local drafts remain readable and are migrated only when selected.
- A selected server draft and a copied offer retain their own initialization. Resuming a draft restores its step and saving identity, requires renewed publishing approval, and explains that unsaved photos must be reselected. Successful publication removes that offer's recoveries without recreating them on the following render.
- The server wizard key includes the supplier identity so switching accounts cannot reuse another supplier's form state. Public API contracts, migrations, prices, payment policy, and schedule validation were not changed.

## Green verification

| Check | Result |
| --- | --- |
| Final `npm test` | **190 test files / 1,732 tests passed**, exit 0 |
| `npx tsc --noEmit` | Passed, exit 0 |
| `npm run lint` | Exit 0; **0 errors / 200 warnings** in existing skill scripts and unrelated application/test files |
| `npm run build` | Passed, including transaction UX schema/RLS/grant/REST checks and Next.js TypeScript compilation |
| `PLAYWRIGHT_BASE_URL=http://localhost:3000 npx playwright test tests/e2e/navigation-drafts.spec.ts` | **4 passed**, desktop 1440px and mobile 390px |
| `git diff --check` | Passed |

The final suite includes immediate server-seeded menus, navigation remounts, slow requests, network/5xx failures, 401/403, server snapshots, actual login-form synchronization, logout races, active-route boundaries, explicit local recovery, multiple offers, supplier isolation, corrupt storage, server-draft priority, copies, renewed approval, lost save responses, and publication cleanup.

Browser checks used disposable supplier fixtures and an isolated browser context against localhost. The fixtures were removed in `afterAll`; the journeys did not save or publish offers to the server. While client session responses were held pending, both viewports kept all five role links and exactly one active item, including after navigation to Notifikasi. Opening a fresh offer after editing a previous form kept the new name empty and displayed both prior recoveries for explicit selection.

Visual checks inspected the desktop/mobile captures below. These show a blank new product form, named recovery choices, and Katalog as the only highlighted navigation entry. No prior screenshot baseline was provided, so these are functional/visual evidence rather than a pixel-baseline regression claim.

- [Desktop evidence](navigation-drafts/desktop.png)
- [Mobile evidence](navigation-drafts/mobile.png)

Non-blocking pre-existing tool warnings remain: Vite's future native config-loader warning, Next.js workspace-root inference from multiple lockfiles, and Playwright's NO_COLOR/FORCE_COLOR warning. PRD edits and other pre-existing local changes were preserved.

## Follow-up: capacity/unit alignment

The supplier reported that the capacity input and unit dropdown were not aligned. A browser regression measured a **20px difference** between their top edges at 1440px before the fix. The mobile test also demonstrated that the visible capacity hint was not associated with the input's accessible description.

Moved the capacity hint below its input, associated it through `aria-describedby`, and set both controls to the same 44px height. Labels and control tops now line up in the desktop two-column layout; mobile retains the stacked layout and shared left edge. Input values, validation, disabled/locked behavior, and the existing hint text remain unchanged.

- Red: `PLAYWRIGHT_BASE_URL=http://localhost:3000 npx playwright test tests/e2e/navigation-drafts.spec.ts -g 'aligns capacity'` — **2 failed**, including the measured 20px desktop offset.
- Green: the same command — **2 passed** at 1440px and 390px; desktop top/height differences are at most 1px and the hint is accessible.
- `npm test` — **190 files / 1,732 tests passed**, exit 0.
- Targeted ESLint for `ProductDetailStep.tsx` and the browser spec — passed without errors or warnings.
- `git diff --check` — passed.

[Desktop alignment evidence](navigation-drafts/alignment-desktop.png)
