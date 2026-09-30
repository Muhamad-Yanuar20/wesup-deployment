import { describe, expect, it } from "vitest";

import { CARGO, SCENE_PHASES } from "@/lib/landing/crate-lattice";
import {
  CAMERA_KEYS,
  CAMERA_LOCK_AT,
  DEPART_FREEZE_AT,
  DEPARTURE_EASE,
  DOLLY_TOTAL,
  FROZEN_DEPART_LOOK,
  FROZEN_DEPART_POS,
  MIN_TRUCK_FRAMING_DISTANCE,
  STATION_MAX_X,
  TRUCK_DEPART_TOTAL,
  cameraSettle,
  departureCameraRig,
  departureDollyOffset,
  departureProgress,
  sampleCamera,
  sampleCameraRail,
  truckDepartureX,
} from "@/lib/landing/camera-rail";

/* The station is the anchor of this scene. It is never given a transform, so
 * every pixel of apparent drift came from the camera — and the camera has three
 * independent handles on it, not one. A frozen *position* with a still-panning
 * *look target* moves the whole frame just as surely as a dolly does; so does
 * a frozen rail with pointer parallax still applied afterwards; and on top of
 * that, once the truck leaves, the rig has to *travel* down the road — as a
 * pure translation, never a pan — so the anchored dock falls behind the lens.
 * Each of those three is pinned separately below. */

const FREEZE = DEPART_FREEZE_AT;

describe("departure freeze", () => {
  it("freezes at the same progress the departure starts", () => {
    expect(DEPART_FREEZE_AT).toBe(SCENE_PHASES.departStart);
  });

  it("holds one exact pose for every progress at or past the freeze", () => {
    const stops = [FREEZE, 0.91, 0.95, 0.99, 1, 1.5, 42];
    for (const p of stops) {
      const { pos, look } = sampleCamera(p);
      expect(pos).toEqual(FROZEN_DEPART_POS);
      expect(look).toEqual(FROZEN_DEPART_LOOK);
    }
  });

  it("freezes the look target, not only the position", () => {
    /* This is the subtle one. Holding position while the target pans sweeps
     * 10.2 degrees with no parallax to betray it, so it reads as the set
     * sliding rather than the camera turning. */
    for (const p of [FREEZE, 0.93, 0.97, 1]) {
      expect(sampleCamera(p).pos).toEqual(FROZEN_DEPART_POS);
      expect(sampleCamera(p).look).toEqual(FROZEN_DEPART_LOOK);
    }
  });

  it("is load-bearing: the raw rail would have drifted during the departure", () => {
    /* Guards the short-circuit. Both the freeze key and the final key hold the
     * same pose, so the raw Catmull-Rom segment between them overshoots; the
     * frozen branch has to bypass the spline for the pose to be truly held.
     * Without this, deleting the short-circuit would still pass the tests
     * above, because the overshoot is small enough to look like nothing. */
    let drift = 0;
    for (let p = FREEZE; p <= 1.0001; p += 0.002) {
      const raw = sampleCameraRail(p);
      drift = Math.max(
        drift,
        Math.hypot(
          raw.look[0] - FROZEN_DEPART_LOOK[0],
          raw.look[1] - FROZEN_DEPART_LOOK[1],
          raw.look[2] - FROZEN_DEPART_LOOK[2],
        ),
      );
    }
    expect(drift).toBeGreaterThan(1e-4);
  });

  it("hands over from the rail without a visible jump", () => {
    /* The freeze must be continuous: the pose it snaps to has to be the pose
     * the rail had already reached. Catmull-Rom is mathematically exact at a
     * key but not bit-exact, so this compares with a tolerance rather than
     * demanding identical floats. */
    const raw = sampleCameraRail(FREEZE);
    for (let i = 0; i < 3; i += 1) {
      expect(raw.pos[i]).toBeCloseTo(FROZEN_DEPART_POS[i], 9);
      expect(raw.look[i]).toBeCloseTo(FROZEN_DEPART_LOOK[i], 9);
    }
    const before = sampleCamera(FREEZE - 1e-6);
    for (let i = 0; i < 3; i += 1) {
      expect(before.pos[i]).toBeCloseTo(FROZEN_DEPART_POS[i], 5);
    }
  });

  it("keeps the final key holding the frozen pose", () => {
    const last = CAMERA_KEYS[CAMERA_KEYS.length - 1];
    expect(last.pos).toEqual(FROZEN_DEPART_POS);
    expect(last.look).toEqual(FROZEN_DEPART_LOOK);
  });

  it("orders the rail by progress with no duplicate times", () => {
    for (let i = 1; i < CAMERA_KEYS.length; i += 1) {
      expect(CAMERA_KEYS[i].at).toBeGreaterThan(CAMERA_KEYS[i - 1].at);
    }
  });
});

describe("departure progress", () => {
  it("runs from 0 at the freeze to 1 at the end", () => {
    expect(departureProgress(FREEZE)).toBe(0);
    expect(departureProgress(1)).toBe(1);
  });

  it("is clamped outside the departure span", () => {
    expect(departureProgress(0)).toBe(0);
    expect(departureProgress(-3)).toBe(0);
    expect(departureProgress(7)).toBe(1);
  });

  it("only advances once the truck has started moving", () => {
    expect(departureProgress(SCENE_PHASES.shutterStart)).toBe(0);
    expect(departureProgress(SCENE_PHASES.departStart)).toBe(0);
  });
});

describe("pointer and bob lockout", () => {
  it("is at full strength until the lockout ramp starts", () => {
    /* The load and shutter acts keep the pointer parallax and idle bob. */
    for (const p of [0, 0.3, 0.5, 0.8, FREEZE - 0.04]) {
      expect(cameraSettle(p)).toBe(1);
    }
  });

  it("is finished by the lock point, before the dolly starts", () => {
    /* Revision 4: the rig must already be rigid when the truck pulls away, so
     * the departing translation never carries a leftover parallax nudge. */
    for (let p = CAMERA_LOCK_AT; p <= 1.0001; p += 0.01) {
      expect(cameraSettle(p)).toBe(0);
    }
  });

  it("reaches zero exactly at the lock point, continuously", () => {
    expect(cameraSettle(CAMERA_LOCK_AT)).toBe(0);
    expect(cameraSettle(CAMERA_LOCK_AT - 1e-6)).toBeCloseTo(0, 6);
    expect(cameraSettle(1)).toBe(0);
  });

  it("locks before the departure starts", () => {
    expect(CAMERA_LOCK_AT).toBeLessThan(DEPART_FREEZE_AT);
  });

  it("never goes negative or above one", () => {
    for (let p = 0; p <= 1.0001; p += 0.01) {
      expect(cameraSettle(p)).toBeGreaterThanOrEqual(0);
      expect(cameraSettle(p)).toBeLessThanOrEqual(1);
    }
  });

  it("stays locked at zero for the whole departure span", () => {
    for (let p = FREEZE; p <= 1.0001; p += 0.001) {
      expect(cameraSettle(p)).toBe(0);
    }
  });
});

describe("departure dolly", () => {
  const EASE_AT = (t: number) => (3.4 * t + 10 * t * t) / 13.4;

  it("uses one easing shared by the truck and the camera", () => {
    for (let t = 0; t <= 1.0001; t += 0.01) {
      expect(truckDepartureX(t)).toBeCloseTo(TRUCK_DEPART_TOTAL * DEPARTURE_EASE(t), 12);
      expect(departureDollyOffset(t)).toBeCloseTo(DOLLY_TOTAL * DEPARTURE_EASE(t), 12);
    }
  });

  it("keeps the truck's original quadratic-acceleration curve", () => {
    for (const t of [0.1, 0.3, 0.5, 0.7, 0.9]) {
      expect(DEPARTURE_EASE(t)).toBeCloseTo(EASE_AT(t), 12);
    }
  });

  it("runs both travels from rest to full distance", () => {
    expect(DEPARTURE_EASE(0)).toBe(0);
    expect(DEPARTURE_EASE(1)).toBe(1);
    expect(truckDepartureX(0)).toBe(0);
    expect(truckDepartureX(1)).toBe(TRUCK_DEPART_TOTAL);
    expect(departureDollyOffset(0)).toBe(0);
    expect(departureDollyOffset(1)).toBe(DOLLY_TOTAL);
  });

  it("never reverses direction during the departure", () => {
    let lastTruck = -1;
    let lastDolly = -1;
    for (let t = 0; t <= 1.0001; t += 0.005) {
      const truck = truckDepartureX(t);
      const dolly = departureDollyOffset(t);
      expect(truck).toBeGreaterThanOrEqual(lastTruck);
      expect(dolly).toBeGreaterThanOrEqual(lastDolly);
      lastTruck = truck;
      lastDolly = dolly;
    }
  });

  it("puts the dock behind the camera by the end of the departure", () => {
    /* The dock's leading edge runs to STATION_MAX_X; the camera overtakes it
     * only if its total travel carries it past that face. This is "the station
     * gets behind and disappears" pinned as an invariant. */
    const cameraEndX = FROZEN_DEPART_POS[0] + DOLLY_TOTAL;
    expect(cameraEndX).toBeGreaterThan(STATION_MAX_X);
    expect(departureCameraRig(1).pos[0]).toBeCloseTo(cameraEndX, 12);
  });

  it("begins from the frozen pose the moment the truck leaves", () => {
    const rig = departureCameraRig(FREEZE);
    expect(rig.pos).toEqual(FROZEN_DEPART_POS);
    expect(rig.look).toEqual(FROZEN_DEPART_LOOK);
  });

  it("is a pure translation, never a pan", () => {
    /* The same offset reaches the position and the look target, so the
     * orientation vector stays bit-for-bit constant. No pixel pivots — the
     * dock simply recedes and exits frame behind. */
    const reference = departureCameraRig(FREEZE);
    const dir = [
      reference.look[0] - reference.pos[0],
      reference.look[1] - reference.pos[1],
      reference.look[2] - reference.pos[2],
    ];
    for (let t = 0.001; t <= 1.0001; t += 0.005) {
      const rig = departureCameraRig(FREEZE + t * (1 - FREEZE));
      expect(rig.look[0] - rig.pos[0]).toBeCloseTo(dir[0], 12);
      expect(rig.look[1] - rig.pos[1]).toBeCloseTo(dir[1], 12);
      expect(rig.look[2] - rig.pos[2]).toBeCloseTo(dir[2], 12);
    }
  });

  it("keeps the truck framed at the end of the road", () => {
    /* Truck rear cargo plane vs camera at full travel. The margin keeps the
     * box inside ~60% of the 36-degree frame instead of filling the screen. */
    const truckRearX = truckDepartureX(1) + CARGO.rearX;
    const cameraX = FROZEN_DEPART_POS[0] + DOLLY_TOTAL;
    expect(truckRearX - cameraX).toBeGreaterThanOrEqual(MIN_TRUCK_FRAMING_DISTANCE);
  });

  it("travels forward smoothly with no teleports", () => {
    let previous = departureCameraRig(0).pos[0];
    for (let p = 0.001; p <= 1.0001; p += 0.001) {
      const current = departureCameraRig(p).pos[0];
      expect(current - previous).toBeLessThan(0.4);
      previous = current;
    }
  });
});

describe("rail is scrub-safe", () => {
  it("returns finite values across the whole scroll range", () => {
    for (let p = 0; p <= 1.0001; p += 0.005) {
      const { pos, look } = sampleCamera(p);
      for (const v of [...pos, ...look]) {
        expect(Number.isFinite(v)).toBe(true);
      }
    }
  });

  it("is a pure function of progress, so scrubbing back rewinds exactly", () => {
    for (const p of [0.2, 0.45, 0.7, 0.95]) {
      expect(sampleCamera(p)).toEqual(sampleCamera(p));
    }
  });

  it("starts and ends on their declared keys", () => {
    expect(sampleCamera(0).pos).toEqual(CAMERA_KEYS[0].pos);
    expect(sampleCamera(0).look).toEqual(CAMERA_KEYS[0].look);
  });

  it("never teleports between adjacent samples", () => {
    let previous = sampleCamera(0).pos;
    for (let p = 0.001; p <= 1.0001; p += 0.001) {
      const current = sampleCamera(p).pos;
      const jump = Math.hypot(
        current[0] - previous[0],
        current[1] - previous[1],
        current[2] - previous[2],
      );
      /* The handover at the freeze is a hand-off between identical poses, so
       * the only step allowed here is the rail's own slowest advance. */
      expect(jump).toBeLessThan(0.25);
      previous = current;
    }
  });
});
