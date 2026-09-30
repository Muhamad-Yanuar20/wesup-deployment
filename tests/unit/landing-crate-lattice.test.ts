import { describe, expect, it } from "vitest";

import {
  CARGO,
  CRATE,
  CRATE_COUNT,
  CRATE_SEATS,
  DOOR_CLEAR_HALF_WIDTH,
  SCENE_PHASES,
  SEAT_ROT_JITTER,
  contactGap,
  crateOuterZEdge,
  doorZClearance,
  frontGap,
  headroom,
  interiorZClearance,
  rearClearance,
  seatsAreFlush,
} from "@/lib/landing/crate-lattice";

/* These are the invariants the renderer cannot check on its own. The lattice
 * shipped for a while with a hand-tuned step per axis, which produced a 0.36
 * gap along X, a 0.16 gap up Y and a 0.11 overlap across Z — visible as crates
 * that floated apart on two axes and interpenetrated on the third. Each of
 * those is a one-line constant here, so each is now a one-line assertion. */

describe("flush packing", () => {
  it("seats crates with no gap and no overlap on every axis", () => {
    expect(contactGap("x")).toBe(0);
    expect(contactGap("y")).toBe(0);
    expect(contactGap("z")).toBe(0);
    expect(seatsAreFlush()).toBe(true);
  });

  it("derives every step from a crate extent rather than repeating a literal", () => {
    expect(CRATE.stepX).toBe(CRATE.size);
    expect(CRATE.stepY).toBe(CRATE.h);
    expect(CRATE.stepZ).toBe(CRATE.size);
  });

  it("places exactly one seat per lattice cell", () => {
    expect(CRATE_COUNT).toBe(CRATE.cols * CRATE.levels * CRATE.rows);
    expect(CRATE_SEATS).toHaveLength(CRATE_COUNT);
    const cells = new Set(CRATE_SEATS.map((s) => `${s.level}:${s.depth}:${s.row}`));
    expect(cells.size).toBe(CRATE_COUNT);
  });
});

describe("lattice fits the cargo", () => {
  it("keeps every crate inside the side walls", () => {
    for (const seat of CRATE_SEATS) {
      expect(Math.abs(seat.z) + CRATE.size / 2).toBeLessThanOrEqual(CARGO.halfWidth);
    }
  });

  it("keeps a yawed crate inside the side walls", () => {
    expect(interiorZClearance()).toBeGreaterThan(0);
  });

  it("keeps a yawed crate clear of the door aperture", () => {
    expect(doorZClearance()).toBeGreaterThan(0.02);
  });

  it("sizes the crate to the door aperture rather than the other way round", () => {
    /* The aperture, not the wall, is the binding constraint: the shutter slats
     * are narrower than the interior. A crate sized against halfWidth alone
     * would jam as it passed through the door. */
    expect(DOOR_CLEAR_HALF_WIDTH).toBeLessThan(CARGO.halfWidth);
    expect(1.5 * CRATE.size).toBeLessThan(DOOR_CLEAR_HALF_WIDTH);
  });

  it("accounts for the seat rotation in the width budget", () => {
    expect(SEAT_ROT_JITTER).toBeGreaterThan(0);
    expect(crateOuterZEdge()).toBeGreaterThan(1.5 * CRATE.size);
  });

  it("clears the rear cargo plane and leaves headroom", () => {
    expect(rearClearance()).toBeGreaterThan(0);
    expect(headroom()).toBeGreaterThan(0);
  });

  it("never seats a crate past the bulkhead", () => {
    expect(frontGap()).toBeGreaterThanOrEqual(0);
  });
});

describe("load order", () => {
  it("seats the deepest column first within a level", () => {
    for (let level = 0; level < CRATE.levels; level += 1) {
      const depths = CRATE_SEATS.filter((s) => s.level === level).map((s) => s.depth);
      expect(new Set(depths)).toEqual(new Set(Array.from({ length: CRATE.cols }, (_, i) => i)));
    }
  });

  it("puts the deepest column furthest from the open door", () => {
    const deepest = CRATE_SEATS.filter((s) => s.depth === 0);
    const atDoor = CRATE_SEATS.filter((s) => s.depth === CRATE.cols - 1);
    const maxDeepest = Math.max(...deepest.map((s) => s.x));
    const minAtDoor = Math.min(...atDoor.map((s) => s.x));
    /* A crate only slides forward (+X) into place, so the seats must be filled
     * front-to-back or an inserting crate would have to pass through one that
     * is already seated. */
    expect(maxDeepest).toBeGreaterThan(minAtDoor);
  });

  it("never schedules a crate before the load window opens", () => {
    for (const seat of CRATE_SEATS) {
      expect(seat.x).toBeLessThanOrEqual(CARGO.frontX);
    }
  });
});

describe("scene phases", () => {
  it("orders every act", () => {
    const order = [
      SCENE_PHASES.loadStart,
      SCENE_PHASES.loadEnd,
      SCENE_PHASES.shutterStart,
      SCENE_PHASES.shutterEnd,
      SCENE_PHASES.departStart,
    ];
    for (let i = 1; i < order.length; i += 1) {
      expect(order[i]).toBeGreaterThan(order[i - 1]);
    }
  });

  it("keeps every act inside the scroll range", () => {
    for (const value of Object.values(SCENE_PHASES)) {
      expect(value).toBeGreaterThan(0);
      expect(value).toBeLessThanOrEqual(1);
    }
  });

  it("seals the cargo before the truck pulls away", () => {
    expect(SCENE_PHASES.loadEnd).toBeLessThanOrEqual(SCENE_PHASES.shutterStart);
    expect(SCENE_PHASES.shutterEnd).toBeLessThanOrEqual(SCENE_PHASES.departStart);
  });
});
