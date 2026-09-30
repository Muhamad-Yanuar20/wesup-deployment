/**
 * Cargo lattice and scene phase geometry for the landing-page hero.
 *
 * Pure data and pure math only: no React, no three.js, no DOM. The renderer
 * imports these numbers, and the unit tests assert the packing invariants that
 * the renderer cannot see for itself.
 *
 * The single most important rule encoded here: **lattice steps are derived from
 * the crate extents, never hand-tuned.** A hand-tuned step is how the previous
 * lattice ended up with a 0.36-unit gap along X and a 0.11-unit overlap along
 * Z — neighbouring crates had been spaced by eye rather than by contact. Equal
 * step and extent is what "stacked flush" means, and it is now unrepresentable
 * to get wrong.
 */

/* ------------------------------------------------------------------ */
/* Cargo box geometry                                                  */
/* ------------------------------------------------------------------ */

/**
 * Cargo interior of the box truck.
 *
 * `halfWidth` is the *interior* half-width, not the exterior: the side walls
 * are centred at `halfWidth + wall / 2`, so the inner face sits exactly at
 * `halfWidth`. Every clearance below is measured against that inner face.
 */
export const CARGO = {
  /** Rear-most plane: the open roller door the loading camera looks through. */
  rearX: -3.2,
  /** Front-most plane of the usable cargo, against the cab bulkhead. */
  frontX: 2.0,
  /** Height of the cargo floor above the ground. */
  floorY: 1.18,
  /** Interior ceiling of the cargo. */
  roofY: 3.95,
  /** Interior half-width. */
  halfWidth: 1.26,
  /** Thickness of the cargo walls and floor. */
  wall: 0.07,
} as const;

/** Clear half-width of the door aperture, set by the roller-shutter slats. */
export const DOOR_CLEAR_HALF_WIDTH = CARGO.halfWidth - 0.04;

/* ------------------------------------------------------------------ */
/* Scene phases                                                        */
/* ------------------------------------------------------------------ */

/**
 * Scroll progress at which each act of the scene begins. These are the only
 * phase numbers in the codebase — the narrative beats and the renderer both
 * read them, so the overlay copy can never drift away from the visuals.
 */
export const SCENE_PHASES = {
  /** First crate leaves its spawn. */
  loadStart: 0.045,
  /** Last crate is seated. */
  loadEnd: 0.7,
  /** Roller shutter starts unrolling. */
  shutterStart: 0.74,
  /** Shutter fully closed. */
  shutterEnd: 0.88,
  /** Truck starts rolling. Camera freezes from this instant onward. */
  departStart: 0.9,
} as const;

/** Progress range across which the truck departs. */
const DEPART_END = 1;

/**
 * When the wholesale-tier beat fires: halfway through the fill, which is where
 * the pallet reads as half loaded on screen.
 */
export const TIER_UNLOCK_AT =
  SCENE_PHASES.loadStart + (SCENE_PHASES.loadEnd - SCENE_PHASES.loadStart) * 0.5;

/** When the final pickup beat fires, late enough to see the truck down the road. */
export const PICKUP_AT = SCENE_PHASES.departStart + (DEPART_END - SCENE_PHASES.departStart) * 0.6;

/* ------------------------------------------------------------------ */
/* Pallet lattice                                                      */
/* ------------------------------------------------------------------ */

/**
 * Edge length of a single crate.
 *
 * Capped at 0.78 by the cargo width, not chosen for looks. Three rows seated
 * flush put the outer crates at `1.5 * size`, and the door aperture only opens
 * to `DOOR_CLEAR_HALF_WIDTH`. See `doorZClearance()`.
 */
/**
 * Edge length of a single crate.
 *
 * Capped at 0.78 by the cargo width, not chosen for looks. Three rows seated
 * flush put the outer crates at `1.5 * size`, and the door aperture only opens
 * to `DOOR_CLEAR_HALF_WIDTH`. See `doorZClearance()`.
 */
const CRATE_SIZE = 0.78;

/** Crate height. Square-faced, so it stacks flush on every axis. */
const CRATE_HEIGHT = 0.78;

export const CRATE = {
  size: CRATE_SIZE,
  h: CRATE_HEIGHT,
  /** Columns along the cargo, front-most to rear-most. */
  cols: 4,
  /** Layers up the cargo. */
  levels: 3,
  /** Rows across the cargo. */
  rows: 3,
  /** Seat of the rear-most column, the one nearest the open door. */
  firstX: -2.75,
  /* Steps are derived from the extents above — see the module note. */
  stepX: CRATE_SIZE,
  stepY: CRATE_HEIGHT,
  stepZ: CRATE_SIZE,
  /** Share of each crate's window spent flying to the door lane. */
  flightFrac: 0.55,
} as const;

export const CRATE_COUNT = CRATE.cols * CRATE.levels * CRATE.rows;

/**
 * Half-width of the random seat-rotation, in radians.
 *
 * Kept small on purpose: a crate is a box, so yawing it widens its silhouette
 * across Z, and flush-packed rows have no slack to absorb the extra width.
 */
export const SEAT_ROT_JITTER = 0.03;

export interface CrateSeat {
  readonly x: number;
  readonly y: number;
  readonly z: number;
  readonly level: number;
  /** 0 is the column deepest into the cargo, `cols - 1` the one at the door. */
  readonly depth: number;
  readonly row: number;
}

/**
 * Seat of every crate, in load order.
 *
 * Order is level-major, then depth, then row, so within a level the deepest
 * column seats first. That ordering is what makes the insert pipeline
 * collision-free: a crate only ever slides forward through volume that is still
 * empty, because everything in front of its target seat is already occupied and
 * everything behind it is not.
 */
export const CRATE_SEATS: readonly CrateSeat[] = Array.from(
  { length: CRATE_COUNT },
  (_, i) => {
    const level = Math.floor(i / (CRATE.cols * CRATE.rows));
    const depth = Math.floor((i % (CRATE.cols * CRATE.rows)) / CRATE.rows);
    const row = i % CRATE.rows;
    return {
      x: CRATE.firstX + (CRATE.cols - 1 - depth) * CRATE.stepX,
      y: CARGO.floorY + CRATE.h / 2 + level * CRATE.stepY,
      z: (row - 1) * CRATE.stepZ,
      level,
      depth,
      row,
    };
  },
);

/* ------------------------------------------------------------------ */
/* Packing invariants                                                  */
/* ------------------------------------------------------------------ */

/** Whether every axis seats flush: no gap and no overlap between neighbours. */
export function seatsAreFlush(): boolean {
  return (
    CRATE.stepX === CRATE.size && CRATE.stepY === CRATE.h && CRATE.stepZ === CRATE.size
  );
}

/** Signed face-to-face distance between neighbouring crates on one axis. */
export function contactGap(axis: "x" | "y" | "z"): number {
  const step = axis === "x" ? CRATE.stepX : axis === "y" ? CRATE.stepY : CRATE.stepZ;
  const extent = axis === "y" ? CRATE.h : CRATE.size;
  return step - extent;
}

/**
 * Widest point a crate reaches across the cargo, including the worst-case
 * silhouette of a yawed crate (a yawed square of half-extent `a` spans
 * `a * (cos t + sin t)`).
 */
export function crateOuterZEdge(): number {
  const t = Math.abs(SEAT_ROT_JITTER);
  return CRATE.size + (CRATE.size / 2) * (Math.cos(t) + Math.sin(t));
}

/** Gap between the widest crate and the cargo side walls. */
export function interiorZClearance(): number {
  return CARGO.halfWidth - crateOuterZEdge();
}

/** Gap between the widest crate and the door aperture. */
export function doorZClearance(): number {
  return DOOR_CLEAR_HALF_WIDTH - crateOuterZEdge();
}

/** Gap between the rear-most crate's back face and the rear cargo plane. */
export function rearClearance(): number {
  const nearestSeat = CRATE_SEATS.reduce((min, s) => Math.min(min, s.x), Infinity);
  return nearestSeat - CRATE.size / 2 - CARGO.rearX;
}

/** Vertical space left above the top layer. */
export function headroom(): number {
  const topSeat = CRATE_SEATS.reduce((max, s) => Math.max(max, s.y), -Infinity);
  return CARGO.roofY - (topSeat + CRATE.h / 2);
}

/** Unused cargo length ahead of the front-most crate. */
export function frontGap(): number {
  const deepestSeat = CRATE_SEATS.reduce((max, s) => Math.max(max, s.x), -Infinity);
  return CARGO.frontX - (deepestSeat + CRATE.size / 2);
}
