# Supplier draft visibility and catalog navigation — 22 October 2026

Authority: approved in-chat plan. Execution branch: `codex/fix-supplier-draft-navigation`, base `746370b`. Existing login-link removal is preserved. No automatic push.

## Ledger and decisions

- Tasks: RED regressions; owner-scoped local/server draft list; targeted wizard recovery; fixed catalog return link; automated/browser verification and review.
- Use the existing checkout and its configured dependencies/environment on a dedicated feature branch; keep this report as the Windows execution ledger.
- Shared interface: the list produces `recovery` (a storage key), optional server `draft` ID and optional `copy` source. The wizard validates the owner, copy scope and server identity before restoration. Backend endpoints/payloads/schema remain unchanged.
- RED: first fixture needed complete summary counters; after correcting the fixture, both tests failed for the reported behavior (local draft absent; no catalog return link), without unhandled errors. Raw run: ignored `node_modules/.cache/role-a/drafts-red.log`.
- GREEN: initial four targeted files, 32 tests passed. List uses the shared landing AppPanel and square paper/ink/red treatment. Matching account/local rows are merged; differing local contents require an explicit recovery choice. Current server revision is retained.
- Independent final static review found no actionable issues; the reviewer also ran the four targeted files (32 passed). Scope included ownership, copy/legacy keys, identity merging, targeted restoration, revisions, lifecycle and navigation.

## Final verification

| Check | Result | Evidence |
| --- | --- | --- |
| `npm test` | 226 files / 2123 tests passed | [tests.log](supplier-draft-navigation/tests.log) |
| Browser desktop 1440 and mobile 390 | 12 passed | [browser.log](supplier-draft-navigation/browser.log) |
| Ready-state screenshot/overflow assertions | 2 passed | [browser-evidence.log](supplier-draft-navigation/browser-evidence.log) |
| `npm run lint` | Exit 0; 0 errors, 14 existing warnings | [lint.log](supplier-draft-navigation/lint.log) |
| `npx tsc --noEmit` | Exit 0 | Explicit command after build |
| `npm run build` | Exit 0, including schema preflight | [build.log](supplier-draft-navigation/build.log) |
| Fixture audit | 0 owned navigation fixture users remaining | Read-only audit after teardown |

Browser coverage includes local edit → catalog → targeted resume → confirmed partial server save → catalog → server resume without manual reload; directly opened batch and legacy transaction redirect both return to catalog. Existing fresh-form/manual recovery, role navigation and field geometry checks also pass. Components/helpers cover account/local conflicts, newest local copy, legacy/copy formats, foreign-account isolation, corrupt records, denied storage, failed API reads, focus/storage refresh, current server revision, consent reset and publication cleanup.

The first browser run had 9 passed / 3 failed: one geometry measurement ran before the field became visible; two failures were teardown FK restrictions because the new saved-draft fixture must be deleted before its auth user. Added visibility waits and explicit owner-scoped draft deletion. Two verified disposable accounts from that run were cleaned up by exact IDs; no unrelated account/data was touched. The corrected complete run passed all 12 tests.

Screenshots were deliberately captured only after account reads and catalog loading finished, then inspected. See [device desktop](supplier-draft-navigation/catalog-device-1440.png), [device mobile](supplier-draft-navigation/catalog-device-390.png), [account desktop](supplier-draft-navigation/catalog-account-1440.png), [account mobile](supplier-draft-navigation/catalog-account-390.png). Historical screenshots were not overwritten.

Live verification used the latest production build on a temporary port 3001 server, leaving the user's development server on 3000 untouched. Requires configured Supabase/Upstash credentials, DATABASE_URL, and installed Playwright Chromium. The separate previously reported development-server 404 issue is not addressed by this fix. No API/backend/schema/PRD edits or automatic commit/push were performed.

## Self-evaluation

Delivery update: the user subsequently requested commit and push to `main`; remote main matched base `746370b` before delivery.

Overall 4.0/5. Accuracy 4: automated and real browser assertions agree, but browser failure combinations are sampled rather than exhaustive. Completeness 4: both requested flows and recovery variants are covered; cross-tab behavior is component-tested rather than a two-window browser journey. Clarity 4: labels distinguish account/device state; the existing catalog status counters still describe batches, while unfinished offer drafts occupy their separate panel. Actionability 4: reproducible tests, logs and screenshots are saved, with live environment required for reruns. Conciseness 4: evidence is centralized here; the final answer can link to it.

Potential follow-ups: two-window browser coverage for storage refresh, and a separate product decision on whether batch-status counters should eventually include unfinished offers. Would the user agree? The reported draft visibility and back navigation are demonstrated directly; broader catalog filtering remains outside this plan.
