import { describe, expect, it } from "vitest";
import {
  clamp,
  clamp01,
  easeInCubic,
  easeInOutCubic,
  easeOutCubic,
  hash,
  lerp,
  smoothstep,
  wrap,
} from "@/lib/landing/math";

describe("clamp01", () => {
  it("clamps to the unit interval and passes interior values through", () => {
    expect(clamp01(-3)).toBe(0);
    expect(clamp01(0)).toBe(0);
    expect(clamp01(0.42)).toBe(0.42);
    expect(clamp01(1)).toBe(1);
    expect(clamp01(4.2)).toBe(1);
  });

  it("conserves NaN so a bad measurement cannot silently clamp into a plausible value", () => {
    expect(Number.isNaN(clamp01(NaN))).toBe(true);
  });
});

describe("clamp", () => {
  it("clamps to the requested bounds", () => {
    expect(clamp(5, 0, 10)).toBe(5);
    expect(clamp(-3, 0, 10)).toBe(0);
    expect(clamp(12, 0, 10)).toBe(10);
  });
});

describe("lerp", () => {
  it("interpolates linearly and hits both endpoints", () => {
    expect(lerp(0, 10, 0)).toBe(0);
    expect(lerp(0, 10, 0.5)).toBe(5);
    expect(lerp(0, 10, 1)).toBe(10);
  });

  it("extrapolates past 1 for repeated sampling", () => {
    expect(lerp(0, 10, 1.5)).toBe(15);
  });
});

describe("smoothstep", () => {
  it("is anchored at both ends and lands on the midpoint", () => {
    expect(smoothstep(0)).toBe(0);
    expect(smoothstep(0.5)).toBe(0.5);
    expect(smoothstep(1)).toBe(1);
  });

  it("never overshoots the unit interval", () => {
    for (const t of [0, 0.1, 0.33, 0.5, 0.66, 0.9, 1]) {
      const v = smoothstep(t);
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThanOrEqual(1);
    }
  });
});

describe("easing functions", () => {
  it("all easings are anchored at 0 and 1", () => {
    for (const ease of [easeOutCubic, easeInOutCubic, easeInCubic]) {
      expect(ease(0)).toBe(0);
      expect(ease(1)).toBe(1);
    }
  });

  it("easeOutCubic decelerates: most distance is covered early", () => {
    // 1 - (1-t)^3: 0.25 -> 0.578, 0.5 -> 0.875, 0.75 -> 0.984
    expect(easeOutCubic(0.25)).toBeGreaterThan(0.5);
    expect(easeOutCubic(0.5)).toBeGreaterThan(0.8);
    expect(easeOutCubic(0.75)).toBeGreaterThan(0.95);
  });

  it("easeInCubic accelerates: little distance is covered early", () => {
    // t^3: 0.5 -> 0.125, 0.75 -> 0.422, 0.9 -> 0.729
    expect(easeInCubic(0.25)).toBeLessThan(0.2);
    expect(easeInCubic(0.5)).toBeLessThan(0.25);
    expect(easeInCubic(0.75)).toBeLessThan(0.5);
    expect(easeInCubic(0.9)).toBeGreaterThan(0.7);
  });

  it("easeInOutCubic is symmetric about the midpoint", () => {
    expect(easeInOutCubic(0.25) + easeInOutCubic(0.75)).toBeCloseTo(1, 10);
    expect(easeInOutCubic(0.5)).toBeCloseTo(0.5, 10);
  });

  it("never overshoots, so the truck cannot bounce past its travel target", () => {
    for (const ease of [easeOutCubic, easeInOutCubic, easeInCubic]) {
      for (const t of [0, 0.1, 0.33, 0.5, 0.66, 0.9, 1]) {
        const v = ease(t);
        expect(v).toBeGreaterThanOrEqual(0);
        expect(v).toBeLessThanOrEqual(1);
      }
    }
  });
});

describe("hash", () => {
  it("is deterministic, so the scene is scrub-reproducible", () => {
    expect(hash(3)).toBe(hash(3));
    expect(hash(7.25)).toBe(hash(7.25));
  });

  it("stays inside [0, 1)", () => {
    for (const seed of [0, 1, 2, 10, 36, 104.5, -3]) {
      const v = hash(seed);
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });
});

describe("wrap", () => {
  it("keeps values inside [0, span)", () => {
    expect(wrap(0, 1)).toBe(0);
    expect(wrap(0.5, 1)).toBe(0.5);
    expect(wrap(1.5, 1)).toBe(0.5);
    expect(wrap(-0.25, 1)).toBe(0.75);
    expect(wrap(7, 3)).toBe(1);
  });
});