/**
 * Shared deterministic math for the landing page.
 *
 * Pure math only: no React, no three.js, no DOM. Everything the renderer and
 * the scroll overlay need is a pure function of a scroll progress value in
 * [0, 1], which keeps the whole story scrubbable and unit-testable.
 *
 * Design rules encoded here:
 * - Easing never overshoots, so nothing bounces past its target.
 * - Every helper conserves NaN so a bad measurement cannot silently clamp into
 *   a plausible-looking value.
 */

export function clamp01(value: number): number {
  if (Number.isNaN(value)) return Number.NaN;
  return Math.min(1, Math.max(0, value));
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

/** Smoothstep: Hermite interpolation through 0..1, anchored at both ends. */
export function smoothstep(t: number): number {
  return t * t * (3 - 2 * t);
}

/** Decelerates: most of the distance is covered early. */
export function easeOutCubic(t: number): number {
  return 1 - (1 - t) ** 3;
}

/** Accelerates: little of the distance is covered early. */
export function easeInCubic(t: number): number {
  return t ** 3;
}

/** Symmetric S-curve used for camera segments. */
export function easeInOutCubic(t: number): number {
  return t < 0.5 ? 4 * t ** 3 : 1 - (-2 * t + 2) ** 3 / 2;
}

/**
 * Deterministic 0..1 hash. No Math.random, so the same input always yields the
 * same value across reloads and the scene stays fully scrub-reproducible.
 */
export function hash(n: number): number {
  const s = Math.sin(n * 127.1) * 43758.5453;
  return s - Math.floor(s);
}

/** Wrap a value into [0, span), so it loops instead of ever leaving the band. */
export function wrap(value: number, span: number): number {
  return ((value % span) + span) % span;
}