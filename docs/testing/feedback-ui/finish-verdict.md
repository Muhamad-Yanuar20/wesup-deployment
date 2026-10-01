## verdict

- Resolved — payment closing timestamp: the recaptured order shows opening on 3 Oct and closing on 4 Oct, consistent with the schedule, at 1440/768/320. At 390 the fixed bottom navigation overlaps that header region in the full-page capture; the schedule still shows 4 Oct, corrected source reads paymentClosesAt, and the supplied browser assertion verifies the header at every width. Opening countdown remains 48:00:00 where visible.
- Resolved — heading kickers: independently opened login, wizard and order full images at 1440/768/390/320 show the three labels removed; Newsreader titles, supporting copy, breadcrumb and meaningful wizard steps remain. The zoom200 login likewise has no kicker.
- Resolved — nested state frames: finance transfer history is now an unframed empty message within its payout surface, and Admin catalog recovery occupies one enclosing panel at all four widths. Retry and error identity remain; finance input and local mutation error remain visible.
- Evidence valid — all 28 required full images and zoom200 reopened from the original paths; desktop/mobile/user-768/user-320 aliases SHA256-match the recaptured wizard originals. No regressions introduced by the correction batch identified in the scored surfaces.

## remaining

Clear. Ship covers the scored fixes, not the whole surface.

disposition: ship
