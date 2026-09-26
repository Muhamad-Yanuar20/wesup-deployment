# TDD Evidence Report — Hit-and-Run Auto-Suspend (PRD 9, §2.2.3 & §3.4)

## Source plan
Sanksi **Hit & Run** berasal dari PRD modul 9 (Reputation & Penalty) §2.2.3 dan §3.4: escalation ladder berjenjang (Peringatan → Suspend 7 hari → Suspend permanen), blokir 7 hari dihitung **retrospektif** dari deadline Payment Window, dan **No-Show** memakai sanksi forfiter 100% tanpa menambah `strike_count`.

Kode produksi sudah ada sebagai working tree yang belum di-commit: satu migration 486 baris (`20260919000000_hit_and_run_auto-suspend.sql`) yang mencampur lima concern, dan sanction ladder yang **hanya** diverifikasi dengan test statis yang membaca teks SQL. Tidak ada satu pun nilai yang menentukan apakah UMKM boleh tetap berjualan yang pernah dieksekusi.

Laporan ini Covers **pass verifikasi dan pemecahan migration**, bukan penambahan fitur dari nol. Semua klaim di bawah berasal dari output command yang benar-benar dijalankan.

## User journeys
- Sebagai UMKM, saya diperingatkan pada miss pembayaran pertama dan **tidak** kehilangan akses jualan.
- Sebagai UMKM, saya diblokir tepat 7 hari setelah deadline Payment Window — bukan 7 hari sejak saat penalty ditegakkan.
- Sebagai UMKM, blokir saya **berakhir sendiri** begitu 7 hari lewat, tanpa penalty tambahan.
- Sebagai UMKM, saya **tidak** dijatuhi strike hanya karena No-Show; forfiter escrow adalah sanksi yang memadai.
- Sebagai UMKM yang telat membayar namun webhook-nya masih diproses provider, saya **tidak** dihukum sebelum provider direkonsiliasi.
- Sebagai supplier, saya dapat menyapu batch yang window pembayarannya sudah lewat tanpa menunggu UMKM membuka halaman pesanan.

## Task report

### Task 1 — pecah migration monolith menjadi 4 file per concern
- **File produksi:** `20260919000000_hit_and_run_escalation.sql`, `20260919003000_payment_window_reconciliation.sql`, `20260919004000_complaint_escrow_freeze.sql`, `20260919005000_materialize_hit_and_run.sql`
- **File test:** `tests/migrations/hit-and-run-auto-suspend.test.ts` (14 test, ditulis ulang)
- **Validation command:** `npx vitest run tests/migrations/hit-and-run-auto-suspend.test.ts`

Semua timestamp tetap di bawah `20260920020000` karena `materialize_umkm_orders(uuid[])` pada revisi tersebut mendelegasikan ke `materialize_umkm_order(uuid)` yang didefinisikan di file materialize.

Asersi lama menghitung 3 call site tetapi mendeskripsikannya "three definitions" — sehingga penghapusan satu call site tidak akan terdeteksi. Diperbaiki menjadi dua assert terpisah: hitungan call site (3) dan keberadaan definisi di file escalation.

**GREEN:**
```
Test Files  1 passed (1)
     Tests  14 passed (14)
```

### Task 2 — test statis versus bukti eksekusi
Task 1 hanya memindahkan teks. Untuk memastikan pemecahan tidak mengubah perilaku, keenam body function dibandingkan **read-only** terhadap `pg_proc.prosrc` yang ter-deploy di live DB (tanpa menulis apa pun):

```
extracted 6 function definitions from 4 files
  MATCH    apply_hit_and_run_escalation(...)          <- 20260919000000_hit_and_run_escalation.sql
  MATCH    lazy_lift_expired_suspension(...)          <- 20260919000000_hit_and_run_escalation.sql
  MATCH    reconcile_batch_payment_window(...)        <- 20260919003000_payment_window_reconciliation.sql
  MATCH    submit_order_complaint(...)                <- 20260919004000_complaint_escrow_freeze.sql
  MATCH    materialize_umkm_order(...)                <- 20260919005000_materialize_hit_and_run.sql
  MATCH    materialize_supplier_order(...)            <- 20260919005000_materialize_hit_and_run.sql

index notifications_hit_and_run_key_idx deployed: true
matched=6 differing=0 missing=0
```

### Task 3 — 14 test live untuk ladder, lazy lift, dan jalur uang
- **File test:** `tests/live/hit-and-run-escalation.integration.test.ts`
- **Validation command:** `npx vitest run tests/live/hit-and-run-escalation.integration.test.ts`

Menjalankan fungsi yang benar-benar ter-deploy menemukan fakta yang tidak bisa dilihat dari teks SQL. Semua berikut adalah kegagalan **RED yang nyata** selama penyusunan test, dan masing-masing menunjukkan risiko nyata:

| Temuan | Gejala RED | Konsekuensi bila tidak ditemukan |
|---|---|---|
| Ladder mengklasifikasi `strike_count` **yang sudah dinaikkan**, bukan `+1` | `expected 'active' to be 'suspended_permanent'` | Off-by-one di seluruh sanction ladder |
| `reconcile_batch_payment_window` mengotorisasi **supplier**, bukan UMKM yang dihukum | `error: not allowed` | Sweep hanya bisa dijalankan dari halaman finance supplier |
| Sweep menaikkan `strike_count` itu sendiri | `expected +0 to be 1` pada `escalated.suspended` | Ringkasan hasil sweep tidak mencerminkan run ini |
| Trigger registrasi **menegakkan** window | `error: registration window is closed` | Fixture harus dibangun terbuka lalu dikurangi waktunya |
| `handle_new_user` sudah membuat baris `profiles` | `duplicate key value violates unique constraint "profiles_pkey"` | Insert profil eksplisit selalu bentrok |
| Prefix judul `Fixture %` dipakai teardown suite lain | `violates foreign key constraint "payments_registration_id_fkey"` | Suite paralel menghapus data suite ini di tengah test |

Test live yang memverifikasi aturan uang:
- **No-Show tidak menambah strike** — escrow `forfeited`, `strike_count` tetap 0, tanpa notifikasi suspensi.
- **Webhook yang telat dilindungi** — `payment_attempts` berstatus `pending` membuat registrasi tetap `pending_payment`, payment tetap `pending`, strike 0.
- **Blokir retrospektif** — deadline 3 hari lalu menghasilkan blokir ~4 hari ke depan, bukan `now() + 7 days`.
- **Sweep lewat materializer batch** — `materialize_umkm_orders` membatalkan + `expired` + strike, membuktikan coupling ke revisi `20260920020000`.

### Task 4 — teardown yang melaporkan kegagalan
`payments`, `disputes`, `ratings`, dan `refund_requests` **tidak punya** `ON DELETE CASCADE` pada `registration_id`, urutan hapus wajib children-first. Teardown lama menelan error dengan `.catch(() => undefined)`, sehingga kebocoran baru muncul di suite lain. Diganti dengan pelaporan error yang menggagalkan suite.

**GREEN:**
```
Test Files  1 passed (1)
     Tests  14 passed (14)
```

### Task 5 — deadline komplain diukur dari pickup terkonfirmasi
Ditemukan saat membaca alur yang diuji: `getDeadlines` menghitung batas komplain dari `estimated_ready_at` (2.2.3), yang bisa beberapa hari sebelum barang benar-benar diambil, sehingga deadline yang tampil sudah lewat saat dispute window dibuka. PRD §3.3 mengaitkan window 24 jam pada **pickup terkonfirmasi** — moment ketika escrow freeze mungkin terjadi. Diperbaiki di `lib/orders/read-model.ts` beserta test-nya.

## Test specification

| # | Yang dijamin | Test file | Test type | Hasil | Evidence |
|---|--------------|-----------|-----------|-------|----------|
| 1 | Miss pertama = peringatan, akses tetap `active` | `tests/live/hit-and-run-escalation.integration.test.ts` | live | PASS | `npx vitest run tests/live/hit-and-run-escalation.integration.test.ts` |
| 2 | Miss kedua = blokir tepat `deadline + 7 hari` | idem | live | PASS | idem |
| 3 | Miss ketiga = `suspended_permanent` | idem | live | PASS | idem |
| 4 | Blokir dihitung retrospektif, bukan dari `now()` | idem | live | PASS | idem |
| 5 | Tanpa deadline → Functions menolak, akun tidak berubah | idem | live | PASS | idem |
| 6 | Reconcile twice → tidak ada notifikasi ganda / perpanjangan | idem | live | PASS | idem |
| 7 | Blokir kedaluwarsa terangkat saat sign-in | idem | live | PASS | idem |
| 8 | Blokir yang masih berjalan tidak disentuh | idem | live | PASS | idem |
| 9 | Blokir permanen tidak pernah terangkat | idem | live | PASS | idem |
| 10 | Non-admin tidak bisa lift blokir orang lain | idem | live | PASS | idem |
| 11 | Miss via `materialize_umkm_orders` → cancel + expire + strike | idem | live | PASS | idem |
| 12 | Provider attempt `pending` → tidak dihukum | idem | live | PASS | idem |
| 13 | No-Show → forfiter escrow, tanpa strike | idem | live | PASS | idem |
| 14 | Sweep supplier mengeskalasi miss yang lazy | idem | live | PASS | idem |
| 15 | Ordering + bentuk ladder + grant + dedupe | `tests/migrations/hit-and-run-auto-suspend.test.ts` | static | PASS | `npx vitest run tests/migrations/hit-and-run-auto-suspend.test.ts` |
| 16 | Deadline komplain 24 jam dari pickup terkonfirmasi | `tests/unit/order-read-model.test.ts` | unit | PASS | `npx vitest run tests/unit/order-read-model.test.ts` |
| 17 | Lift blokir saat login | `tests/unit/api-login-suspension-lift.test.ts` | unit | PASS | `npx vitest run tests/unit/api-login-suspension-lift.test.ts` |
| 18 | Lift blokir saat masuk workspace | `tests/unit/umkm-workspace-suspension-lift.test.ts` | unit | PASS | `npx vitest run tests/unit/umkm-workspace-suspension-lift.test.ts` |

## Coverage dan gap yang diketahui
- Test penuh: **1482 passed / 3 skipped** (`npx vitest run`); 3 skip adalah `tests/live/umkm-registration.integration.test.ts` yang membutuhkan `SUPABASE_SECRET_KEY` — pre-existing, disengaja diabaikan.
- `npx tsc --noEmit`: bersih. `npx eslint .`: **0 errors** (11 warning pre-existing). `npm run build`: sukses.
- Sisa residue diverifikasi nol setelah suite: 0 baris pada `auth.users`, `profiles`, `batches`, `supplier_profiles`, dan notifikasi suspensi.
- **Gap yang diketahui:** `reconcile_batch_payment_window` baru diuji melalui caller supplier; jalur `admin` pada guard yang sama belum diuji. `materialize_supplier_order` (path refund) tidak diberi test live tersendiri — masih tercakup statis.
- `supabase_migrations.schema_migrations` di remote **belum diverifikasi**; migration split tidak diterapkan ulang ke live DB sesuai keputusan (cek read-only di atas).

## Merge evidence
Lima commit terpisah: pemecahan migration + contract statis, test live + teardown, deadline komplain, plumbing auth, dan dokumen ini. Tidak ada squash pada cabang tugas ini.
