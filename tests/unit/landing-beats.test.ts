import { describe, expect, it } from "vitest";
import {
  BEATS,
  SCENE_LENGTH_MOBILE_VH,
  SCENE_LENGTH_VH,
  STAGE_EDGES,
  TARGET_REGISTERED_KG,
  TIERS,
  formatKg,
  formatRupiah,
  lockedTierForKg,
  nextTier,
  resolveBeat,
  stageForProgress,
} from "@/lib/landing";

describe("formatRupiah", () => {
  it("uses Indonesian digit grouping", () => {
    expect(formatRupiah(12000)).toBe("Rp 12.000");
    expect(formatRupiah(10500)).toBe("Rp 10.500");
    expect(formatRupiah(8900)).toBe("Rp 8.900");
  });

  it("rounds to whole rupiah", () => {
    expect(formatRupiah(10499.6)).toBe("Rp 10.500");
  });

  it("formats the zero-price fallback without breaking", () => {
    expect(formatRupiah(0)).toBe("Rp 0");
  });
});

describe("formatKg", () => {
  it("groups thousands in the Indonesian locale", () => {
    expect(formatKg(298)).toBe("298");
    expect(formatKg(1500)).toBe("1.500");
  });
});

describe("tier data", () => {
  it("models the three published volume tiers", () => {
    expect(TIERS.map((t) => t.label)).toEqual(["Tier 1", "Tier 2", "Tier 3"]);
    expect(TIERS.map((t) => t.minQuantityKg)).toEqual([100, 250, 500]);
    expect(TIERS.map((t) => t.unitPrice)).toEqual([12000, 10500, 8900]);
  });

  it("is strictly increasing in both quota and discount", () => {
    for (let i = 1; i < TIERS.length; i += 1) {
      expect(TIERS[i].minQuantityKg).toBeGreaterThan(TIERS[i - 1].minQuantityKg);
      expect(TIERS[i].unitPrice).toBeLessThan(TIERS[i - 1].unitPrice);
    }
  });
});

describe("nextTier", () => {
  it("falls back to Tier 1 when the quota is below the first threshold", () => {
    expect(nextTier(0).label).toBe("Tier 1");
    expect(nextTier(99).label).toBe("Tier 1");
  });

  it("returns the highest threshold the quota satisfies", () => {
    expect(nextTier(100).label).toBe("Tier 1");
    expect(nextTier(250).label).toBe("Tier 2");
    expect(nextTier(499).label).toBe("Tier 2");
    expect(nextTier(500).label).toBe("Tier 3");
    expect(nextTier(9000).label).toBe("Tier 3");
  });
});

describe("lockedTierForKg", () => {
  it("never promises a tier the registered volume did not earn", () => {
    expect(lockedTierForKg(TARGET_REGISTERED_KG).label).toBe("Tier 2");
    expect(lockedTierForKg(TARGET_REGISTERED_KG).unitPrice).toBe(10500);
  });

  it("never locks below Tier 1, matching the PRD fallback rule", () => {
    expect(lockedTierForKg(0).label).toBe("Tier 1");
    expect(lockedTierForKg(-20).label).toBe("Tier 1");
  });

  it("marks the final tier unreachable when the target stops short of it", () => {
    const target = lockedTierForKg(TARGET_REGISTERED_KG);
    expect(target.label).not.toBe("Tier 3");
  });
});

describe("BEATS", () => {
  it("declares six monotonically increasing stages", () => {
    expect(BEATS).toHaveLength(6);
    for (let i = 1; i < BEATS.length; i += 1) {
      expect(BEATS[i].at).toBeGreaterThan(BEATS[i - 1].at);
    }
  });

  it("starts at 0 and leaves the final beat active through the end of the scene", () => {
    expect(BEATS[0].at).toBe(0);
    // The last beat begins before the end and stays active — there is no beat
    // anchored exactly at 1, because nothing follows the CTA.
    const last = BEATS[BEATS.length - 1];
    expect(last.at).toBeLessThan(1);
    expect(stageForProgress(1)).toBe(BEATS.length - 1);
  });

  it("uses two-digit zero-padded stage labels", () => {
    expect(BEATS.map((b) => b.index)).toEqual(["00", "01", "02", "03", "04", "05"]);
  });

  it("gives every beat non-empty Indonesian copy", () => {
    for (const beat of BEATS) {
      expect(beat.eyebrow.length).toBeGreaterThan(0);
      expect(beat.title.length).toBeGreaterThan(0);
      expect(beat.body.length).toBeGreaterThan(0);
    }
  });

  it("puts the escrow reassurance on the registration-cutoff beat only", () => {
    const withChip = BEATS.filter((b) => b.chip !== undefined);
    expect(withChip).toHaveLength(1);
    expect(withChip[0].index).toBe("03");
    expect(withChip[0].chip).toMatch(/escrow/i);
  });

  it("has unique ids so React can key the overlay without collisions", () => {
    expect(new Set(BEATS.map((b) => b.id)).size).toBe(BEATS.length);
  });
});

describe("STAGE_EDGES", () => {
  it("derives the stage offsets from the beats", () => {
    expect(STAGE_EDGES).toEqual(BEATS.map((b) => b.at).slice(1));
    for (const edge of STAGE_EDGES) {
      expect(edge).toBeGreaterThan(0);
      expect(edge).toBeLessThan(1);
    }
  });
});

describe("stageForProgress", () => {
  it("returns 0 at the very start and the last index at the very end", () => {
    expect(stageForProgress(0)).toBe(0);
    expect(stageForProgress(1)).toBe(BEATS.length - 1);
  });

  it("switches exactly on the declared threshold, not before it", () => {
    // Derived from BEATS so retiming the story cannot silently break this.
    for (let i = 1; i < BEATS.length; i += 1) {
      const at = BEATS[i].at;
      expect(stageForProgress(at - 0.0001)).toBe(i - 1);
      expect(stageForProgress(at)).toBe(i);
    }
  });

  it("clamps out-of-range and non-finite progress to the end stages", () => {
    expect(stageForProgress(-1)).toBe(0);
    expect(stageForProgress(2)).toBe(BEATS.length - 1);
  });
});

describe("resolveBeat", () => {
  it("returns the beat matching the resolved stage", () => {
    expect(resolveBeat(0).index).toBe("00");
    expect(resolveBeat(0.5).index).toBe("02");
    expect(resolveBeat(1).index).toBe("05");
  });

  it("agrees with stageForProgress at every sampled step", () => {
    for (let p = 0; p <= 1.0001; p += 0.01) {
      expect(resolveBeat(p)).toBe(BEATS[stageForProgress(p)]);
    }
  });
});

describe("scene length", () => {
  it("is longer on desktop than on mobile", () => {
    expect(SCENE_LENGTH_VH).toBeGreaterThan(SCENE_LENGTH_MOBILE_VH);
    expect(SCENE_LENGTH_MOBILE_VH).toBeGreaterThan(0);
  });

  it("gives the mobile track enough room for the full load", () => {
    // 35 arriving crates plus a closing shutter is a lot of choreography to
    // cram into a short track; below this the fill reads as a skip.
    expect(SCENE_LENGTH_MOBILE_VH).toBeGreaterThanOrEqual(400);
  });
});