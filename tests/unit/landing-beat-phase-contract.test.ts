import { describe, expect, it } from "vitest";

import { PICKUP_AT, SCENE_PHASES, TIER_UNLOCK_AT } from "@/lib/landing/crate-lattice";
import { BEATS, STAGE_EDGES, stageForProgress } from "@/lib/landing";

/* The renderer and the overlay used to disagree about how many stages the
 * scene has: the canvas shipped its own three-element edge list while the
 * overlay rendered six narrative beats, so the last two beats never appeared
 * on screen and the truck drove away under stale copy. These assertions pin the
 * two to the same numbers. */

describe("beat / phase contract", () => {
  it("derives one stage edge per beat gap", () => {
    expect(STAGE_EDGES).toHaveLength(BEATS.length - 1);
    expect(STAGE_EDGES).toEqual(BEATS.slice(1).map((b) => b.at));
  });

  it("keeps the edge list strictly increasing", () => {
    for (let i = 1; i < STAGE_EDGES.length; i += 1) {
      expect(STAGE_EDGES[i]).toBeGreaterThan(STAGE_EDGES[i - 1]);
    }
  });

  it("starts the first beat at the top of the scene", () => {
    expect(BEATS[0].at).toBe(0);
  });

  it("fires the fill beat when the first crate launches", () => {
    const beat = BEATS.find((b) => b.id === "bergabung");
    expect(beat?.at).toBe(SCENE_PHASES.loadStart);
  });

  it("fires the tier beat mid-fill, while the pallet reads as filling", () => {
    const beat = BEATS.find((b) => b.id === "tier-terbuka");
    expect(beat?.at).toBe(TIER_UNLOCK_AT);
    expect(TIER_UNLOCK_AT).toBeGreaterThan(SCENE_PHASES.loadStart);
    expect(TIER_UNLOCK_AT).toBeLessThan(SCENE_PHASES.loadEnd);
  });

  it("fires the closed-door beat as the shutter starts unrolling", () => {
    const beat = BEATS.find((b) => b.id === "pintu-ditutup");
    expect(beat?.at).toBe(SCENE_PHASES.shutterStart);
  });

  it("fires the departure beat exactly when the camera freezes", () => {
    const beat = BEATS.find((b) => b.id === "berkeliiar");
    expect(beat?.at).toBe(SCENE_PHASES.departStart);
  });

  it("fires the pickup beat inside the drive-away", () => {
    const beat = BEATS.find((b) => b.id === "siap-diambil");
    expect(beat?.at).toBe(PICKUP_AT);
    expect(PICKUP_AT).toBeGreaterThan(SCENE_PHASES.departStart);
    expect(PICKUP_AT).toBeLessThan(1);
  });

  it("reaches the last beat by the end of the scene", () => {
    expect(stageForProgress(1)).toBe(BEATS.length - 1);
  });

  it("resolves every stage index a STAGE_EDGES-driven renderer can emit", () => {
    /* A renderer counting `score >= edge` emits [0, STAGE_EDGES.length]; that
     * range has to index BEATS without falling off either end. */
    for (let stage = 0; stage <= STAGE_EDGES.length; stage += 1) {
      expect(stage).toBeLessThan(BEATS.length);
    }
    expect(STAGE_EDGES.length).toBe(BEATS.length - 1);
  });

  it("keeps every beat reachable in ascending order", () => {
    let previous = -1;
    for (const edge of STAGE_EDGES) {
      const stage = stageForProgress(edge);
      expect(stage).toBeGreaterThan(previous);
      previous = stage;
    }
  });
});
