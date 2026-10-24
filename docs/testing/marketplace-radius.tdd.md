# Marketplace radius — visual verification

- Request: improve the radius filter's readability and align it with the current landing.
- Cause: the range's filled background covered the global 44px minimum input height, producing a large gray rectangle instead of a thin rail.
- Change: an isolated range class separates a transparent 44px hit area from a 3px rail. Red progress and a square paper-framed thumb follow landing tokens. The value is placed above the slider; 1–50km endpoint labels remain below it. Both WebKit and Firefox range pseudo-elements are styled.
- Desktop and mobile reuse the same filter component. Bounds, step, callback, debounce, search API and category/price filters are unchanged. Native keyboard interaction and visible focus remain available; the value includes an accessible kilometer description.
- Existing component tests: **17 passed**. Targeted ESLint: **passed**. No implementation-mirroring tests were added for this reversible visual change.
- Chromium checks on the running local app: Home → 1, End → 50, ArrowLeft → 49; transparent input background; 44px input height; visible keyboard focus. Mobile drawer checked at **320 and 390px**, with no document overflow. Desktop and mobile screenshots in `docs/testing/marketplace-radius/` were visually reviewed.
- No database changes, commit, push or deployment were performed for this visual adjustment.

## Compact follow-up and actual-discount rule

- User requested a shorter rectangular radius control. Moved the selected value into the legend row, removed the extra caption row, and placed non-interactive scale labels inside the slider enclosure. Chromium measured the complete radius field at **216 × 92px**, while retaining the native **44px** slider hit area. The rail and labels were visually reviewed on desktop and 320px mobile.
- Marketplace cards and detail now share `hasTierDiscount`: strike the base price only for **Tier 2 or later AND a finite, positive current price below the base price**. A later tier with equal prices is not a discount. Tier 1 is never shown with a crossed-out base price.
- RED: new card/detail matrix **6 failed / 2 passed**, reproducing the unconditional crossed-out price. GREEN: **69 tests / 6 files passed**, including the new matrix, existing card/detail pricing, live join progress, filters and tier progress.
- Existing pricing fixtures were made explicit about their achieved discounted tier; unrelated progress expectations were retained.
- Browser: verified native Home/End/Arrow keyboard behavior and no mobile overflow. Checked two currently available real product cards against their actual tier and price metadata. Captured `desktop-compact.png`, `mobile-compact.png` and the detail view in the same screenshot directory.
- Pricing display logic only: no price calculation, checkout payload, API, database or discount thresholds were changed.
- Follow-up targeted ESLint and `npx tsc --noEmit`: passed.
