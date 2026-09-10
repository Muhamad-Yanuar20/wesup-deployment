# Marketplace Route Visualization TDD Evidence

## Red

- Detail marketplace sebelumnya hanya memiliki satu marker pickup.
- Tidak ada kontrak server untuk menghitung rute berdasarkan lokasi UMKM yang sedang login.
- Koordinat dari OSRM menggunakan urutan [longitude, latitude], sedangkan Leaflet membutuhkan [latitude, longitude].

## Green

- Adapter lib/marketplace/routing.ts membangun URL OSRM, memvalidasi respons, mengubah urutan koordinat, dan menyediakan fallback garis lurus.
- GET /api/marketplace/[id]/route mengambil origin dari umkm_profiles milik sesi aktif dan menolak koordinat atau user ID dari browser.
- Guest, Supplier, Admin, dan UMKM tanpa lokasi tidak menerima rute pribadi.
- Detail marketplace memuat rute secara progresif dan menampilkan marker origin, marker pickup, polyline, jarak, durasi, atribusi, loading, error, dan fallback.

## Automated evidence

- Adapter OSRM: urutan koordinat, jarak, durasi, provider error, dan fallback.
- Endpoint: origin sesi, penolakan koordinat browser, guest/non-UMKM gate, dan lokasi profil kosong.
- Komponen: pickup-only mode, route success, response invalid, dan fallback error state.
- Regression suite: 114 test files, 1.172 tests passed.
- npx tsc --noEmit: passed.
- npm run lint: passed with existing warnings only.

## Manual scenarios

1. Login sebagai dua UMKM dengan titik berbeda dan buka batch yang sama; marker origin, polyline, jarak, dan durasi harus berbeda.
2. Buka detail sebagai guest atau Supplier; hanya pin pickup yang ditampilkan.
3. Putuskan OSRM atau pakai respons NoRoute; garis amber putus-putus dan pesan perkiraan garis lurus tetap muncul.
4. Gunakan keyboard untuk fokus tombol “Tampilkan seluruh rute” dan kontrol zoom; peta tetap dapat dibaca melalui ringkasan teks.
