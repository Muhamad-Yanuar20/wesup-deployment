# Peta Leaflet tidak menutupi navigasi

Tanggal: 2026-10-22.

## Penyebab dan perubahan

Pane Leaflet memakai z-index 400–1000. Tanpa stacking context sendiri, pane itu
ikut dibandingkan dengan navigasi sticky di halaman yang sama dan menimpanya saat
digulir. Kelima pembungkus peta kini memakai utilitas `isolate`
(`isolation: isolate`), sehingga z-index di dalam peta terkurung di pembungkusnya.

Pembungkus yang diperbaiki: `MarketplaceRouteMap`, `MarketplaceRadiusMap`,
`PickupLocationMap`, `BusinessLocationPicker`, dan `LeafletMap` (demo).

## Red → green

- Red: 6 tes gagal — 5 pemeriksaan statis "wrapper peta memakai isolate" dan 1
  tes render komponen yang memeriksa isolation pada wrapper.
- Green: 13 tes di 2 berkas lulus
  (`tests/unit/map-stacking-context.test.ts`,
  `tests/components/MarketplaceRadiusMap.test.tsx`).
- Verifikasi browser di halaman batch: kelas wrapper
  `relative isolate h-[320px] w-full overflow-hidden border border-wesup-ink/15`
  dan `computed isolation: isolate`.
- E2E Playwright (`tests/e2e/map-stacking-context.spec.ts`) lulus: probe ber-z
  40 di atas peta menang, dan ancestor terdekat peta ber-`isolation: isolate`.
- Gate akhir: 222 berkas / 2.111 tes, lint 0 error (13 warning lama), build sukses.

Bukti: [red unit](map-stacking-context/red-unit.log),
[green unit](map-stacking-context/green-unit.log),
[e2e](map-stacking-context/e2e.log),
[browser](map-stacking-context/browser.log),
[peta](map-stacking-context/map-wrapper.png),
[layering](map-stacking-context/map-layering.png).
