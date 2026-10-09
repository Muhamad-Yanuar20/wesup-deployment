import { SCENE_PHASES } from "./crate-lattice";
import { clamp01, easeInOutCubic } from "./math";

export type Vec3 = readonly [number, number, number];

/** Progress at which the camera rail locks into its final keyed pose. */
export const DEPART_FREEZE_AT = SCENE_PHASES.departStart;

/**
 * The camera rail, as a Catmull-Rom spline through these keys.
 *
 * The station is an anchor and must never appear to translate. The station
 * group itself is never given a transform — everything that used to make it
 * drift came from the camera, in two separate ways:
 *
 * 1. A residual dolly between the last two keys, which moved near (station) and
 *    far (skyline) geometry at different rates. That differential is what the
 *    eye reads as the set relocating rather than the camera moving.
 * 2. A pan of the look target across the departure span, sweeping 10.2 degrees
 *    from x=1.0 to x=8.5 while position stayed put. A pan has no parallax to
 *    give it away, so it felt subtler — but it still moves every pixel of the
 *    station, which is exactly what "the station is moving" means.
 *
 * Fix: the rail is sampled up to `DEPART_FREEZE_AT` and then hard-frozen in
 * BOTH position and orientation. Revision 4 then travels past the dock without
 * undoing that freeze: the whole rig is pushed along the road by a **pure
 * translation** (`departureCameraRig`), applying the same offset to the
 * position and the look target so the orientation stays bit-for-bit constant.
 * The dock stays anchored in world space; the camera overtakes it and it exits
 * frame behind — "the station gets behind and disappears". Pointer parallax
 * and the idle bob are locked out *before* the translation starts
 * (`cameraSettle`), so the rig is fully rigid at the moment the truck moves.
 *
 * The final key duplicates the freeze key on purpose, to hold the pose so the
 * spline stays well-conditioned at the end of the rail. `sampleCameraRail`
 * short-circuits before it can reach it.
 */
export const CAMERA_KEYS: readonly {
  readonly at: number;
  readonly pos: Vec3;
  readonly look: Vec3;
}[] = [
  { at: 0.0, pos: [-12.8, 4.4, 9.6], look: [-2.6, 2.2, 0.0] },
  { at: 0.15, pos: [-10.6, 3.2, 5.8], look: [-2.4, 2.0, 0.0] },
  { at: 0.34, pos: [-8.2, 2.5, 3.4], look: [-1.4, 1.9, 0.0] },
  { at: 0.52, pos: [-8.8, 4.4, 5.2], look: [-1.6, 2.2, 0.0] },
  { at: 0.72, pos: [-10.8, 3.5, 6.6], look: [-2.2, 2.1, 0.0] },
  { at: 0.9, pos: [-11.3, 3.9, 7.0], look: [1.0, 1.8, 0.0] },
  { at: 1.0, pos: [-11.3, 3.9, 7.0], look: [1.0, 1.8, 0.0] },
];

/** Catmull-Rom in one scalar dimension, given four control values. */
function catmullRom1D(p0: number, p1: number, p2: number, p3: number, t: number) {
  const t2 = t * t;
  const t3 = t2 * t;
  return (
    0.5 *
    (2 * p1 +
      (-p0 + p2) * t +
      (2 * p0 - 5 * p1 + 4 * p2 - p3) * t2 +
      (-p0 + 3 * p1 - 3 * p2 + p3) * t3)
  );
}

function sampleTriple(a: Vec3, b: Vec3, c: Vec3, d: Vec3, t: number): Vec3 {
  return [
    catmullRom1D(a[0], b[0], c[0], d[0], t),
    catmullRom1D(a[1], b[1], c[1], d[1], t),
    catmullRom1D(a[2], b[2], c[2], d[2], t),
  ];
}

/** The pose the camera holds at the freeze, before any departure dolly. */
const FREEZE_KEY = CAMERA_KEYS.find((k) => k.at === DEPART_FREEZE_AT)!;
export const FROZEN_DEPART_POS = FREEZE_KEY.pos;
export const FROZEN_DEPART_LOOK = FREEZE_KEY.look;

/**
 * Raw spline sample, ignoring the post-departure freeze.
 *
 * This is the pose the camera is *about* to freeze at, and the pose it uses
 * everywhere before the departure.
 */
export function sampleCameraRail(p: number): { pos: Vec3; look: Vec3 } {
  const n = CAMERA_KEYS.length;
  let i = 0;
  while (i < n - 2 && p > CAMERA_KEYS[i + 1].at) i += 1;
  const k0 = CAMERA_KEYS[Math.max(i - 1, 0)];
  const k1 = CAMERA_KEYS[i];
  const k2 = CAMERA_KEYS[i + 1];
  const k3 = CAMERA_KEYS[Math.min(i + 2, n - 1)];
  const e = easeInOutCubic(clamp01((p - k1.at) / (k2.at - k1.at)));
  return { pos: sampleTriple(k0.pos, k1.pos, k2.pos, k3.pos, e), look: sampleTriple(k0.look, k1.look, k2.look, k3.look, e) };
}

/**
 * The raw rail pose for a given scroll position: the spline up to the
 * freeze, then the frozen pose for every remaining value.
 *
 * The freeze is applied to position AND look target together. Freezing only one
 * of the two would still pan the frame. This is the *pre-dolly* pose — the
 * renderer composes it with `departureCameraRig` to travel down the road.
 */
export function sampleCamera(p: number): { pos: Vec3; look: Vec3 } {
  if (p >= DEPART_FREEZE_AT) {
    return { pos: FROZEN_DEPART_POS, look: FROZEN_DEPART_LOOK };
  }
  return sampleCameraRail(p);
}

/** How far through the departure the truck is, 0 at the freeze point. */
export function departureProgress(p: number): number {
  return clamp01((p - DEPART_FREEZE_AT) / (1 - DEPART_FREEZE_AT));
}

/* ------------------------------------------------------------------ */
/* Departure travel                                                    */
/* ------------------------------------------------------------------ */

/**
 * Normalised easing shared by everything that moves during the departure.
 *
 * The truck accelerates down the road and the camera dollies with it, so both
 * ride the same curve: `(3.4t + 10t²) / 13.4`, the original quadratic-distance
 * formula scaled to [0, 1]. Basing the truck, the dolly and the dust spawn
 * points on one ease keeps them locked together for the whole drive-away, and
 * keeps every motion a closed-form function of progress so the scene stays
 * scrub-reversible.
 */
export const DEPARTURE_EASE = (t: number): number =>
  clamp01((3.4 * t + 10 * t * t) / 13.4);

/** Total X the truck's cargo travels during the departure, in world units. */
export const TRUCK_DEPART_TOTAL = 26;

/**
 * Total X the camera rig translates during the departure, in world units.
 *
 * Deliberately equal to `TRUCK_DEPART_TOTAL`: truck and rig ride the same
 * curve to the same total, so the truck holds a *constant* lateral offset from
 * the look target for the whole drive-away. That counteracts the mobile
 * framing bug where the 26-vs-19 split let the truck drift ~7 world units past
 * the frozen look lane — on a narrow (portrait) field of view the truck then
 * crossed the viewport's right edge while still opaque and read as "cut off".
 * Equal travel keeps the truck dead-centred at every width for the first leg
 * of the departure; the recede is carried by the scenery slide, the road-dash
 * wrap and the dock being overtaken, not by the truck shearing across the
 * frame. (The tail, after `TRUCK_OVERRUN_START`, deliberately breaks this: the
 * truck alone overruns and drives out of frame — see `truckOverrunX`.)
 */
export const DOLLY_TOTAL = 26;

/**
 * Minimum distance the truck's rear cargo plane must keep ahead of the camera
 * at the end of the departure, in world units.
 *
 * Because the truck and the rig travel equal totals, this is a *constant*
 * (not a worst-case): rear cargo plane at world `truckX + rearX` vs camera at
 * world `-11.3 + dollyX` gives `26 - 3.2 - (-11.3 + 26) = 8.1` lateral gap for
 * every frame of the drive-away, which at the 7-unit Z standoff is ~10.7 units
 * of true depth. With the 36° vertical field of view that keeps the 3.95-unit
 * truck inside ~60% of the frame height, readable as "down the road" rather
 * than filling the screen, on every aspect ratio. The constant holds through
 * the equal-travel leg; during the overrun tail the gap only grows (the truck
 * pulls ahead of the stopped camera), so the framing never gets tighter than
 * this number.
 */
export const MIN_TRUCK_FRAMING_DISTANCE = 8.1;

/**
 * The dock's leading (+X) edge in world units.
 *
 * The canopy is a 12.4-wide box centred on x=0.3, so it runs to x=6.5; the
 * near-side columns reach x=6.2. The departure invariant pins the camera to
 * overtake this face, so the whole dock ends up behind the lens — that is "the
 * station gets behind and disappears" as a number.
 */
export const STATION_MAX_X = 6.5;

/** Truck position during the departure, in world units. */
export const truckDepartureX = (t: number): number =>
  TRUCK_DEPART_TOTAL * DEPARTURE_EASE(t);

/**
 * Progress at which the truck stops riding the equal-travel curve and starts
 * pulling ahead of the camera on its own.
 *
 * The first leg of the drive-away holds the truck dead-centre (equal travels,
 * see `DOLLY_TOTAL`). At this splice the camera keeps its dolly while the truck
 * alone accelerates ahead, so it recedes with distance, sweeps past the right
 * edge of the frame and drives off — "the truck is going somewhere else",
 * instead of dissolving in place. The splice is continuous (`truckOverrunX` is
 * exactly 0 up to here) and the overrun easing starts at zero slope, so the
 * peel begins without a velocity jerk. The window this leaves is the same tail
 * the old opacity dissolve used, so the overall scroll feel is unchanged.
 */
export const TRUCK_OVERRUN_START = 0.72;

/**
 * Total extra X the truck travels past the camera's travel at the very end,
 * in world units.
 *
 * With the rig sitting on its full dolly, the truck has to pull far enough
 * ahead that its rearmost (left) point clears the right edge of the frame at
 * the widest common aspect. Depth grows with the pull-ahead, so the needed
 * offset is set by viewport width: 48 clears 16:9 with ~11 world units to
 * spare and just about clears 21:9 (under a unit, where the fog haze base —
 * the truck is ~35-45% into the 28..110 fog ramp — already reads as "off into
 * the distance"). There is no hard pop at the end; the frame finishes on empty
 * road with the truck already gone out of view.
 */
export const TRUCK_OVERRUN_TOTAL = 48;

/**
 * Extra X the truck travels past the equal-travel curve, 0 before
 * `TRUCK_OVERRUN_START`.
 *
 * `r²` rise: zero slope at the splice (no jerk when the truck starts to pull
 * ahead) and accelerating toward the end, so the truck is moving fastest as it
 * clears the frame. Closed form like everything else, so the whole ending
 * rewinds exactly on scrub.
 */
export const truckOverrunX = (t: number): number => {
  if (t <= TRUCK_OVERRUN_START) return 0;
  const r = clamp01((t - TRUCK_OVERRUN_START) / (1 - TRUCK_OVERRUN_START));
  return TRUCK_OVERRUN_TOTAL * r * r;
};

/** Rigid X translation applied to both the camera position and look target. */
export const departureDollyOffset = (t: number): number =>
  DOLLY_TOTAL * DEPARTURE_EASE(t);

/**
 * The camera pose actually used during the departure: the frozen rail plus the
 * dolly.
 *
 * The raw spline is hard-frozen at `DEPART_FREEZE_AT` (`sampleCamera`), and the
 * dolly is a **pure translation** added on top: an identical offset is applied
 * to the position and the look target, so the orientation — and with it every
 * relative angle in the frame — is unchanged. A pan would drag the dock across
 * the frame; a translation just carries the whole rig past it. Before the
 * freeze the offset is zero, so the load and shutter acts keep their exact
 * Revision 3 framing.
 */
export function departureCameraRig(p: number): { pos: Vec3; look: Vec3 } {
  const dx = departureDollyOffset(departureProgress(p));
  const rail = sampleCamera(p);
  return {
    pos: [rail.pos[0] + dx, rail.pos[1], rail.pos[2]],
    look: [rail.look[0] + dx, rail.look[1], rail.look[2]],
  };
}

/* ------------------------------------------------------------------ */
/* Pointer / bob lockout                                               */
/* ------------------------------------------------------------------ */

/** Progress at which the camera rig becomes fully rigid. */
export const CAMERA_LOCK_AT = SCENE_PHASES.shutterEnd;

/** Progress at which the pointer/bob lockout ramp starts. */
const SETTLE_RAMP_AT = DEPART_FREEZE_AT - 0.04;

/**
 * Multiplier for every pointer- and time-driven camera offset.
 *
 * A hard freeze of the spline is not enough on its own: the pointer parallax
 * and the idle bob are added *after* the rail is sampled, so leaving them at
 * full strength would keep nudging the frame while the truck drives off — the
 * same "the set is breathing" artefact, just smaller.
 *
 * Revision 4 ramps them to zero across `[SETTLE_RAMP_AT, CAMERA_LOCK_AT]`,
 * finishing at exactly `CAMERA_LOCK_AT` (the moment the roller shutter seals).
 * That leaves a gap before the departure dolly starts at `DEPART_FREEZE_AT`, so
 * the dolly always runs with a fully rigid rig and there is no leftover nudge
 * for the eye to catch.
 */
export function cameraSettle(p: number): number {
  if (p >= CAMERA_LOCK_AT) return 0;
  if (p <= SETTLE_RAMP_AT) return 1;
  return 1 - easeInOutCubic((p - SETTLE_RAMP_AT) / (CAMERA_LOCK_AT - SETTLE_RAMP_AT));
}