/**
 * Scroll timeline for the landing-page hero scene.
 *
 * Pure data and pure math only: no React, no three.js, no DOM. This module
 * owns the *story* — the beats the overlay renders, the pricing tiers they
 * reference, and the derived scroll edges that let the renderer report which
 * stage is active.
 *
 * The physics that used to live here (the crate lattice, camera rail, fill and
 * departure curves) now lives in `./crate-lattice` and `./camera-rail`, because
 * the renderer actually reads those and this module did not — the two had
 * drifted apart and the superseded geometry was only kept alive by this
 * module's own tests. Shared scalar math moved to `./math`.
 *
 * Design rules encoded here:
 * - The narrative beats read the *live* phases from `crate-lattice` so the
 *   overlay copy stays in step with what the renderer draws.
 * - Easing never overshoots, so nothing bounces past its target.
 */

import { PICKUP_AT, SCENE_PHASES, TIER_UNLOCK_AT } from "./crate-lattice";
import { clamp01 } from "./math";

/** Total scroll length of the scene, in viewport heights. */
export const SCENE_LENGTH_VH = 560;
export const SCENE_LENGTH_MOBILE_VH = 420;

/* ------------------------------------------------------------------ */
/* Narrative                                                           */
/* ------------------------------------------------------------------ */

export interface Beat {
  readonly id: string;
  /** Zero-padded stage label rendered in the overlay. */
  readonly index: string;
  /** Scroll progress at which this beat becomes active. */
  readonly at: number;
  readonly eyebrow: string;
  readonly title: string;
  readonly body: string;
  /** Optional trust marker shown alongside the beat. */
  readonly chip?: string;
}

export const BEATS: readonly Beat[] = [
  {
    id: "pengacakan",
    index: "00",
    at: 0,
    eyebrow: "00 — Awal Bermuat",
    title: "Satu Kiriman, Banyak Pemilik",
    body: "Palet masih kosong. Pesanan akan berdatangan dari UMKM lain di Bandung, lalu seluruhnya berangkat sebagai satu muatan.",
  },
  {
    id: "bergabung",
    index: "01",
    at: SCENE_PHASES.loadStart,
    eyebrow: "01 — Pallet Terisi",
    title: "Setiap Daftar Menambah Peti",
    body: "Tiap pendaftaran menempatkan satu peti. Tidak ada minimum order besar yang harus Anda penuhi sendirian.",
  },
  {
    id: "tier-terbuka",
    index: "02",
    at: TIER_UNLOCK_AT,
    eyebrow: "02 — Tier Terbuka",
    title: "Volume Naik, Harga Turun",
    body: "Setiap kilogram tambahan merendahkan harga per satuan. Yang tampil adalah tier yang benar-benar tercapai, bukan yang paling murah.",
  },
  {
    id: "pintu-ditutup",
    index: "03",
    at: SCENE_PHASES.shutterStart,
    eyebrow: "03 — Pendaftaran Ditutup",
    title: "Muatan Penuh, Harga Terkunci",
    body: "Pintu tertutup, harga dikunci pada tier yang tercapai. Bila target belum terpenuhi, harga jatuh ke Tier 1 — pesanan Anda tetap berjalan.",
    chip: "Escrow 24 jam — dana ditahan sampai barang diterima",
  },
  {
    id: "berkeliiar",
    index: "04",
    at: SCENE_PHASES.departStart,
    eyebrow: "04 — Berangkat",
    title: "Melaju ke Titik Kumpul",
    body: "Tanpa ongkos kirim last-mile. Anda mengambil sendiri di titik kumpul supplier, pada jadwal yang sudah disepakati.",
  },
  {
    id: "siap-diambil",
    index: "05",
    at: PICKUP_AT,
    eyebrow: "05 — Ambil Barang",
    title: "Siap Diambil di Bandung",
    body: "Tunjukkan Kode QR pengambilan atau sebutkan PIN 4 digit. Supplier memindainya untuk menuntaskan serah terima.",
  },
] as const;

/**
 * Scroll-progress edges that separate one beat from the next, consumed by the
 * renderer to emit stage changes.
 *
 * Derived from `BEATS` rather than maintained alongside it, because the two used
 * to drift: the renderer shipped its own three-element edge list while the
 * overlay rendered six beats, so the last two never appeared on screen. The
 * length is `BEATS.length - 1` by construction, and a renderer driven by these
 * edges reports stage indices in `[0, BEATS.length)`.
 */
export const STAGE_EDGES: readonly number[] = BEATS.slice(1).map((b) => b.at);

/* ------------------------------------------------------------------ */
/* Pricing                                                             */
/* ------------------------------------------------------------------ */

export interface Tier {
  readonly label: string;
  readonly minQuantityKg: number;
  readonly unitPrice: number;
}

export const TIERS: readonly Tier[] = [
  { label: "Tier 1", minQuantityKg: 100, unitPrice: 12000 },
  { label: "Tier 2", minQuantityKg: 250, unitPrice: 10500 },
  { label: "Tier 3", minQuantityKg: 500, unitPrice: 8900 },
] as const;

/** Hardcoded registered volume for the hero narrative. */
export const TARGET_REGISTERED_KG = 298;
export const TARGET_QUOTA_KG = 500;

/* ------------------------------------------------------------------ */
/* Formatting                                                          */
/* ------------------------------------------------------------------ */

/** Indonesian rupiah formatting: Rp 12.000 */
export function formatRupiah(amount: number): string {
  return `Rp ${Math.round(amount).toLocaleString("id-ID")}`;
}

/** Indonesian digit grouping: 1.500 */
export function formatKg(quantity: number): string {
  return Math.round(quantity).toLocaleString("id-ID");
}

/* ------------------------------------------------------------------ */
/* Beats                                                               */
/* ------------------------------------------------------------------ */

/** Index into BEATS for a scroll progress value. */
export function stageForProgress(progress: number): number {
  const p = clamp01(progress);
  let index = 0;
  for (let i = 0; i < BEATS.length; i += 1) {
    if (p >= BEATS[i].at) index = i;
  }
  return index;
}

export function resolveBeat(progress: number): Beat {
  return BEATS[stageForProgress(progress)];
}

/* ------------------------------------------------------------------ */
/* Tiers                                                               */
/* ------------------------------------------------------------------ */

/** Highest published tier the given registered volume satisfies. */
export function nextTier(registeredKg: number): Tier {
  let match = TIERS[0];
  for (const tier of TIERS) {
    if (registeredKg >= tier.minQuantityKg) match = tier;
  }
  return match;
}

/**
 * The tier actually locked at the registration cutoff. Never promises a tier
 * the registered volume did not earn.
 */
export function lockedTierForKg(registeredKg: number): Tier {
  return nextTier(Math.max(0, registeredKg));
}