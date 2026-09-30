# TDD Evidence Report — OpenAPI dan Swagger UI

**Task:** Menambahkan dokumentasi OpenAPI 3 dan Swagger UI yang dilindungi HTTP Basic Authentication tanpa mengubah kontrak API bisnis.

## RED → GREEN

| Area | Test | Hasil |
|---|---|---|
| Basic Auth | `tests/unit/docs-auth.test.ts` menguji path docs, konfigurasi kosong, challenge 401, kredensial salah, dan kredensial valid. | GREEN — 4 test passed |
| OpenAPI coverage | `tests/unit/openapi-document.test.ts` memastikan versi OpenAPI 3.0.3, security scheme cookie, seluruh 56 operasi, tag, dan response. | GREEN — 2 test passed |
| Protected specification | `tests/unit/docs-openapi-route.test.ts` memastikan `/docs/openapi.json` tidak bocor tanpa Basic Auth, mengembalikan `no-store`, dan memuat path pembayaran. | GREEN — 2 test passed |

## Implementasi

- `swagger-ui-react` digunakan untuk rendering Swagger UI pada `/docs`; tombol Try it out dinonaktifkan secara global.
- Spesifikasi bertipe berada di `lib/openapi/document.ts` dan schema bersama di `lib/openapi/schemas.ts`.
- `/docs` dan `/docs/openapi.json` memakai `SWAGGER_USERNAME` serta `SWAGGER_PASSWORD`; nilai tidak memiliki fallback hardcoded.
- Proxy memeriksa Basic Auth sebelum refresh Supabase dan matcher `/docs/:path*` tetap berlaku untuk navigasi maupun prefetch.
- Spec memakai `Cache-Control: private, no-store` dan `Vary: Authorization`.

## Verification

- Targeted Vitest: 8 passed.
- TypeScript check: passed.
- Lint: 0 error; warning yang tersisa berasal dari file existing, bukan endpoint docs.
- Full test, production build, dan browser smoke test dijalankan sebagai release gate.

Tidak ada perubahan pada PRD, migrasi database, business logic, atau kontrak request/response endpoint bisnis.
