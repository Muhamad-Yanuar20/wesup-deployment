/**
 * Scene assembly and render loop for the landing 3D hero.
 *
 * Everything three.js-specific lives here so the React wrapper in
 * `HeroSceneCanvas.tsx` stays thin. The three.runtime object arrives through
 * the wrapper's dynamic import — this module never imports it at module scope —
 * so a reduced-motion visitor never downloads the library.
 *
 * Division of labour:
 * - `textures.ts` — procedural canvas textures (zero asset payload).
 * - `geometry.ts` — the declarative `BatchBuilder` pipeline (materials,
 *   rounded geometry, static batching, instancing).
 * - `crate-lattice` / `camera-rail` — the shared, unit-tested cargo positions
 *   and camera/inertia curves the render loop is a pure consumer of.
 * - this file — the scene graph, the closed-form `applyScene` state machine,
 *   and the render loop.
 *
 * Every moving thing is a closed-form function of the scroll progress `p`, so
 * the scene is fully reversible under scrubbing: no accumulated simulation
 * state, just `p` in, frame out.
 */

import type { RefObject } from "react";

import { CARGO, CRATE, CRATE_SEATS, SCENE_PHASES, SEAT_ROT_JITTER } from "@/lib/landing/crate-lattice";
import { cameraSettle, departureCameraRig, departureProgress, truckDepartureX, truckOverrunX } from "@/lib/landing/camera-rail";
import { clamp, clamp01, easeOutCubic, hash, lerp, smoothstep, wrap } from "@/lib/landing/math";
import { STAGE_EDGES } from "@/lib/landing";

import { BatchBuilder } from "./geometry";
import {
  makeCrateCardboardTexture,
  makeCrateLabelTexture,
  makeDustTexture,
  makeLiveryTexture,
  makeSignTexture,
} from "./textures";

export interface SceneController {
  setVisible: (isVisible: boolean) => void;
  dispose: () => void;
}

/* ================================================================
 * Tunables — the cargo lattice and scene phases now live in
 * @/lib/landing/crate-lattice, shared with the narrative beats and
 * covered by unit tests. Only renderer-specific knobs remain here.
 * ================================================================ */

const CRATE_COUNT = CRATE.cols * CRATE.levels * CRATE.rows;
const SHUTTER_SLATS = 9;

function getQualityMode() {
  if (typeof window === "undefined") return { isMobile: false, isLowPower: false, isVeryLowPower: false };
  const isMobile = window.matchMedia("(max-width: 768px)").matches;
  const cores = navigator.hardwareConcurrency ?? 8;
  const mem = (navigator as unknown as { deviceMemory?: number }).deviceMemory ?? 8;
  const connection = (navigator as unknown as { connection?: { saveData?: boolean } }).connection;
  const saveData = connection?.saveData ?? false;
  const isLowPower = saveData || isMobile || cores <= 4 || mem <= 4;
  const isVeryLowPower = saveData || cores <= 2 || mem <= 2 || (isMobile && cores <= 4);
  return { isMobile, isLowPower, isVeryLowPower };
}

/** Scroll span of the damped bounce a crate plays after it seats. */
const SETTLE_WINDOW = 0.045;

// Must equal --hero-wash in app/globals.css. The wash veils this cove, and it
// only reads as atmosphere rather than as a translucent panel if the two are the
// same colour; a two-255th gap is enough to show as a visible band edge across
// the lower left of the scene. The Ethereal Glass direction paints both the
// void and the cove the same OLED black, so the copy sits on true black.
const COVE_COLOR = 0xF4F4F0;
const CRATE_IN_FLIGHT = 0xe61919;
const CRATE_SEATED = 0xd9c7a4;

/* ---------------- crate pipeline ----------------
 * One crate in the door at a time. Within a level the DEEPEST column
 * loads first, so an inserting crate only ever slides through space
 * that is still empty — collisions are impossible by construction. */

type CratePlan = {
  seat: { x: number; y: number; z: number; rot: number };
  spawn: { x: number; y: number; z: number; rot: number };
  door: { x: number; y: number; z: number };
  start: number;
  land: number;
  arc: number;
};

const WINDOW = (SCENE_PHASES.loadEnd - SCENE_PHASES.loadStart) / CRATE_COUNT;

const PLANS: CratePlan[] = Array.from({ length: CRATE_COUNT }, (_, i) => {
  /* Seats come from the shared lattice, which is what makes the packing
   * flush and unit-testable. Only the visual seat rotation is added here,
   * and it stays inside the lattice's jitter budget so a yawed crate still
   * clears the cargo walls and the door aperture. */
  const latticeSeat = CRATE_SEATS[i];
  const seat = {
    x: latticeSeat.x,
    y: latticeSeat.y,
    z: latticeSeat.z,
    rot: (hash(i * 5.1 + 3) - 0.5) * SEAT_ROT_JITTER * 2,
  };
  const spawn = {
    x: -13 - hash(i * 2.9) * 5,
    y: 2.6 + hash(i * 4.7 + 5) * 4.2,
    z: (i % 2 === 0 ? 1 : -1) * (3.6 + hash(i * 6.1 + 9) * 3.4),
    rot: (hash(i * 8.3 + 2) - 0.5) * 1.2,
  };
  return {
    seat,
    spawn,
    door: { x: CARGO.rearX - 0.95, y: seat.y, z: seat.z },
    start: SCENE_PHASES.loadStart + i * WINDOW,
    land: SCENE_PHASES.loadStart + (i + 1) * WINDOW,
    arc: 1.0 + hash(i * 3.7) * 0.7,
  };
});

/**
 * @param stageEl The DOM box that marks the free area of the hero (the part
 *   not covered by copy). The projection is centred on it, so the truck is
 *   composed into the visible area instead of the middle of the full canvas.
 * @param reduceMotion The hook already answers the media query before the
 *   canvas is allowed to mount (the scene only mounts when it is false), so
 *   re-probing `prefers-reduced-motion` in here would double the DOM query for
 *   no benefit. The caller passes the answer instead.
 */
export function buildScene(
  THREE: typeof import("three"),
  canvas: HTMLCanvasElement,
  stageEl: HTMLElement | null,
  progressRef: RefObject<number>,
  onStageChange: (stage: number) => void,
  initialVisible: boolean,
  reduceMotion = false,
): SceneController {
  const quality = getQualityMode();
  const isMobile = quality.isMobile;
  const isLowPower = quality.isLowPower;
  const isVeryLowPower = quality.isVeryLowPower;
  const instanceScale = isVeryLowPower ? 0.4 : isLowPower ? 0.6 : isMobile ? 0.8 : 1.0;
  const MOTION = reduceMotion ? 0 : 1;

  const scene = new THREE.Scene();
  // Paper cove: background and fog are the same colour, so every object fades
  // seamlessly into the plate (and the departing truck dissolves into it) with
  // no visible horizon edge. Fog starts further out because the camera can now
  // pull back on narrow stages.
  scene.background = new THREE.Color(COVE_COLOR);
  scene.fog = new THREE.Fog(COVE_COLOR, 40, 130);

  const camera = new THREE.PerspectiveCamera(36, 1, 0.1, 220);

  /* Stage framing. The overlay owns the left column / top band; `stageEl` marks
   * the free area. We centre the projection on it (setViewOffset) and size the
   * FOV so the truck always fits inside it. The camera pose is untouched, so the
   * rigid-dolly invariants in camera-rail.ts still hold. */
  const BASE_TAN = Math.tan(THREE.MathUtils.degToRad(18)); // original 36° vfov
  const MAX_TAN = Math.tan(THREE.MathUtils.degToRad(26)); // widest FOV we allow (52°)
  const framing = { pullBack: 1 };

  const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: !isVeryLowPower,
    alpha: false,
    powerPreference: "high-performance",
  });
  const dpr = window.devicePixelRatio || 1;
  renderer.setPixelRatio(
    Math.min(dpr, isVeryLowPower ? 1.0 : isLowPower ? 1.2 : isMobile ? 1.4 : 2),
  );
  renderer.shadowMap.enabled = !isVeryLowPower;
  /* PCFSoftShadowMap was removed in three r186 and silently falls back to
   * PCFShadowMap while logging a warning on every load. Ask for what we get. */
  if (renderer.shadowMap.enabled) {
    renderer.shadowMap.type = THREE.PCFShadowMap;
  }
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.02;
  renderer.outputColorSpace = THREE.SRGBColorSpace;

  type Mesh = InstanceType<typeof THREE.Mesh>;
  type Standard = InstanceType<typeof THREE.MeshStandardMaterial>;
  type Object3D = InstanceType<typeof THREE.Object3D>;
  type InstancedMesh = InstanceType<typeof THREE.InstancedMesh>;
  type BufferGeometry = import("three").BufferGeometry;

  const builder = new BatchBuilder(THREE);

  /* --------- hierarchy: STATION never moves; SCENERY slides; ------- */
  /* --------- TRUCK drives. Nothing else is transformable. ---------- */

  const station = new THREE.Group();
  scene.add(station);
  const scenery = new THREE.Group();
  scene.add(scenery);

  const stationBatches = builder.newBatches();
  const truckBatches = builder.newBatches();

  /* `place` closures can target the station (dashes, timber stacks, sacks,
   * bollards) without repeating a parent argument. */
  const addInstances = (
    geometry: BufferGeometry,
    material: Standard,
    count: number,
    place: (i: number, dummy: Object3D) => void,
    parent: Object3D = scene,
    casts = false,
  ): InstancedMesh => builder.addInstances(geometry, material, count, place, parent, casts);

  /* --------- lights ---------
   * Daylight workshop rig: a neutral paper-white hemisphere, a warm sun key
   * for the cast shadows, a soft paper fill, and a subtle white rim to peel
   * the truck off the cove. The scene now sits on paper (#F4F4F0), so light
   * reads as shade and material, not as glow against black. */

  scene.add(new THREE.HemisphereLight(0xffffff, 0xeae8e3, 1.0));

  const keyLight = new THREE.DirectionalLight(0xfff6ea, 1.9);
  keyLight.castShadow = true;
  keyLight.shadow.mapSize.set(
    isVeryLowPower ? 512 : isMobile ? 1024 : 2048,
    isVeryLowPower ? 512 : isMobile ? 1024 : 2048,
  );
  keyLight.castShadow = renderer.shadowMap.enabled;
  keyLight.shadow.camera.near = 2;
  keyLight.shadow.camera.far = 70;
  keyLight.shadow.camera.left = -16;
  keyLight.shadow.camera.right = 16;
  keyLight.shadow.camera.top = 16;
  keyLight.shadow.camera.bottom = -10;
  keyLight.shadow.bias = -0.0004;
  keyLight.shadow.normalBias = 0.02;
  scene.add(keyLight, keyLight.target);

  const fillLight = new THREE.DirectionalLight(0xeae8e3, 0.5);
  fillLight.position.set(-6, 8, 9);
  scene.add(fillLight);

  const rimLight = new THREE.DirectionalLight(0xffffff, 0.5);
  rimLight.position.set(13, 9, -9);
  scene.add(rimLight);

  // Warm practical hanging over the apron — the pool of light the loading
  // bay works under. Lower intensity than the night rig: with a bright key
  // this now only warms the apron, it no longer carries the exposure.
  const bayLight = new THREE.PointLight(0xfff3d6, 9, 24, 2);
  bayLight.position.set(0.3, 5.6, 0);
  station.add(bayLight);

  /* --------- procedural environment (for clearcoat/chrome) ----
   * A physically-based clearcoat or metal material with no environment
   * to reflect just looks like flat-shaded plastic, however round the
   * geometry is. This builds a small soft-gradient "daylight studio" — a pale
   * overhead, a light horizon, a paper floor — and bakes it into a PMREM so
   * MeshPhysicalMaterial has something believable to mirror. Its stops stay
   * light so it agrees with the paper cove rather than fighting it. */
  const envScene = new THREE.Scene();
  const envGeo = new THREE.SphereGeometry(24, 20, 14);
  const envCanvas = document.createElement("canvas");
  envCanvas.width = 8;
  envCanvas.height = 128;
  const envCtx = envCanvas.getContext("2d");
  if (envCtx) {
    const grad = envCtx.createLinearGradient(0, 0, 0, 128);
    grad.addColorStop(0, "#fbfaf7");
    grad.addColorStop(0.35, "#eceae4");
    grad.addColorStop(0.55, "#dcd9d2");
    grad.addColorStop(0.62, "#d0cdc6");
    grad.addColorStop(1, "#bfbcb6");
    envCtx.fillStyle = grad;
    envCtx.fillRect(0, 0, 8, 128);
  }
  const envTex = new THREE.CanvasTexture(envCanvas);
  envTex.colorSpace = THREE.SRGBColorSpace;
  const envMat = new THREE.MeshBasicMaterial({ map: envTex, side: THREE.BackSide });
  envScene.add(new THREE.Mesh(envGeo, envMat));
  const pmrem = new THREE.PMREMGenerator(renderer);
  pmrem.compileEquirectangularShader();
  const envRT = pmrem.fromScene(envScene, 0.04);
  if (!isVeryLowPower) {
    scene.environment = envRT.texture;
  }
  envGeo.dispose();
  envMat.dispose();
  envTex.dispose();
  pmrem.dispose();

  /* --------- ground, road, sidewalk (static) --------- */

  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(500, 500),
    builder.standard(0xdedbd4, 0.95),
  );
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  station.add(ground);

  const road = new THREE.Mesh(new THREE.PlaneGeometry(500, 7.4), builder.standard(0xc9c6c0, 0.9));
  road.rotation.x = -Math.PI / 2;
  road.position.y = 0.01;
  road.receiveShadow = true;
  station.add(road);

  const lineMat = builder.standard(0x050505, 0.85);
  builder.queuePart(stationBatches, new THREE.BoxGeometry(500, 0.02, 0.14), lineMat, [0, 0.022, -3.62]);
  builder.queuePart(stationBatches, new THREE.BoxGeometry(500, 0.02, 0.14), lineMat, [0, 0.022, 3.62]);
  builder.queuePart(stationBatches, builder.roundedBox(500, 0.12, 3.2, 0.04), builder.standard(0xd2cfc8, 0.95), [0, 0.06, 5.7]);
  builder.queuePart(stationBatches, builder.roundedBox(500, 0.16, 0.22, 0.05), builder.standard(0xbcb9b3, 0.9), [0, 0.08, 4.06]);

  const DASH_SPACING = 4;
  const DASH_COUNT = Math.max(12, Math.floor(40 * instanceScale));
  const DASH_SPAN = DASH_SPACING * DASH_COUNT;
  const dashGeometry = new THREE.PlaneGeometry(2, 0.3);
  dashGeometry.rotateX(-Math.PI / 2);
  const dashes = addInstances(
    dashGeometry,
    builder.standard(0x050505, 0.8),
    DASH_COUNT,
    (i, d) => d.position.set(i * DASH_SPACING - 60, 0.03, 0),
  );

  /* --------- loading bay (static, parented to `station`) ---------- */

  const structure = builder.standard(0xbfbcb6, 0.8);
  const steel = builder.standard(0xa9a6a0, 0.55, 0.25);
  const wallMat = builder.standard(0xd8d5cf, 0.9);
  const paint = builder.standard(0xe61919, 0.85);
  const timber = builder.standard(0x8a6f42, 0.85);
  const sackMat = builder.standard(0xa3926c, 0.95);
  const rubber = builder.standard(0x242930, 0.95);
  const lampGlow = new THREE.MeshStandardMaterial({
    color: 0xfff3d6,
    emissive: 0xf59e0b,
    emissiveIntensity: 1.1,
    roughness: 0.4,
  });

  // Painted apron + hatched safety zone.
  builder.queuePart(stationBatches, builder.roundedBox(11.5, 0.02, 0.16, 0.008), paint, [0.2, 0.03, 3.8]);
  builder.queuePart(stationBatches, builder.roundedBox(11.5, 0.02, 0.16, 0.008), paint, [0.2, 0.03, -3.8]);
  builder.queuePart(stationBatches, builder.roundedBox(0.16, 0.02, 7.6, 0.008), paint, [-5.4, 0.03, 0]);
  builder.queuePart(stationBatches, builder.roundedBox(0.16, 0.02, 7.6, 0.008), paint, [5.8, 0.03, 0]);
  addInstances(
    new THREE.BoxGeometry(0.12, 0.02, 2.4),
    builder.standard(0x050505, 0.85),
    14,
    (i, d) => {
      d.position.set(-5.0 + i * 0.42, 0.03, 2.6);
      d.rotation.set(0, -0.6, 0);
    },
  );
  for (const x of [-2.5, 0.5, 3.5]) {
    builder.queuePart(stationBatches, new THREE.BoxGeometry(0.04, 0.015, 7.6), builder.standard(0x1f232b, 0.95), [x, 0.025, 0]);
  }

  // Structure: columns with hazard bands, canopy, back wall, wall door.
  for (const [x, z] of [
    [-5.6, 4.3],
    [6.2, 4.3],
    [-5.6, -4.3],
    [6.2, -4.3],
  ]) {
    builder.queuePart(stationBatches, builder.roundedBox(0.36, 6.2, 0.36, 0.05), steel, [x, 3.1, z]);
    builder.queuePart(stationBatches, builder.roundedBox(0.42, 0.22, 0.42, 0.05), paint, [x, 0.5, z]);
  }
  builder.queuePart(stationBatches, builder.roundedBox(12.4, 0.24, 9.2, 0.06), structure, [0.3, 6.2, 0]);
  builder.queuePart(stationBatches, builder.roundedBox(12.4, 6.2, 0.3, 0.05), wallMat, [0.3, 3.1, -5.6]);
  builder.queuePart(stationBatches, builder.roundedBox(4.2, 3.6, 0.12, 0.04), steel, [0.2, 1.8, -5.42]);
  builder.queuePart(stationBatches, builder.roundedBox(4.6, 0.26, 0.34, 0.05), steel, [0.2, 3.68, -5.4]);

  // Brand sign — procedural canvas texture.
  const signTex = makeSignTexture(THREE);
  if (signTex) {
    const sign = new THREE.Mesh(
      new THREE.PlaneGeometry(4.6, 0.95),
      new THREE.MeshStandardMaterial({ map: signTex, roughness: 0.55 }),
    );
    sign.position.set(0.2, 4.62, -5.43);
    station.add(sign);
  }

  // Wall lamps.
  for (const x of [-3.2, 3.6]) {
    builder.queuePart(stationBatches, builder.roundedBox(0.5, 0.16, 0.24, 0.04), lampGlow, [x, 4.1, -5.35]);
    builder.queuePart(stationBatches, builder.roundedBox(0.34, 0.1, 0.2, 0.03), steel, [x, 4.26, -5.38]);
  }

  // Rubber dock bumpers + pallet stack + sack rack.
  for (const x of [-4.9, 5.3]) {
    builder.queuePart(stationBatches, builder.roundedBox(0.22, 0.5, 0.3, 0.05), rubber, [x, 0.25, -4.2]);
  }
  addInstances(
    builder.roundedBox(1.5, 0.16, 1.2, 0.03),
    timber,
    8,
    (i, d) => {
      const level = Math.floor(i / 4);
      d.position.set(-4.3 + level * 0.1, 0.1 + level * 0.42, 2.2 + (i % 4) * 0.02);
      d.rotation.set(0, 0.04 * ((i * 7) % 5) - 0.08, 0);
    },
  );
  addInstances(
    builder.roundedBox(0.52, 0.36, 0.34, 0.06),
    sackMat,
    12,
    (i, d) => {
      d.position.set(3.2 + Math.floor(i / 6) * 0.04, 0.5 + (i % 6) * 0.4, -3.6);
      d.rotation.set(0, 0.1 * ((i * 3) % 4) - 0.15, 0);
    },
  );
  builder.queuePart(stationBatches, new THREE.CylinderGeometry(0.06, 0.06, 2.6, 10), steel, [2.86, 1.3, -3.6]);
  builder.queuePart(stationBatches, new THREE.CylinderGeometry(0.06, 0.06, 2.6, 10), steel, [3.62, 1.3, -3.6]);
  builder.queuePart(stationBatches, builder.roundedBox(0.92, 0.1, 0.6, 0.03), timber, [3.24, 2.5, -3.6]);

  // Bollards + cones.
  addInstances(
    new THREE.CapsuleGeometry(0.13, 0.7, 4, 12),
    builder.standard(0xe61919, 0.6),
    4,
    (i, d) => d.position.set(-5.1 + i * 3.6, 0.5, 3.05),
  );
  const coneOrange = builder.standard(0xe61919, 0.6);
  for (const [cx, cz, ry] of [
    [-4.6, 3.3, 0.2],
    [-3.9, 3.45, -0.3],
    [-5.2, 2.9, 0.5],
  ]) {
    builder.queuePart(stationBatches, builder.roundedBox(0.5, 0.05, 0.5, 0.02), coneOrange, [cx, 0.03, cz], { y: ry });
    builder.queuePart(stationBatches, new THREE.ConeGeometry(0.16, 0.55, 12), coneOrange, [cx, 0.33, cz], { y: ry });
  }

  // Static decor crates (rounded, kraft + brand tape), clear of the truck.
  const kraftMat = builder.standard(0xd9c7a4, 0.72, 0.03);
  const tapeMat = builder.standard(0xe61919, 0.5);
  const decor: [number, number, number, number][] = [
    [-4.75, 0.355, -3.3, 0.05],
    [-3.85, 0.355, -3.32, -0.06],
    [-4.3, 1.065, -3.28, 0.03],
    [4.9, 0.355, -2.4, 0.25],
  ];
  for (const [x, y, z, ry] of decor) {
    builder.queuePart(stationBatches, builder.roundedBox(0.82, 0.71, 0.82, 0.06), kraftMat, [x, y, z], { y: ry });
    builder.queuePart(stationBatches, builder.roundedBox(0.845, 0.15, 0.845, 0.03), tapeMat, [x, y + 0.3, z], { y: ry });
  }

  // Pallet jack — the small hero prop that sells "working dock".
  const jack = new THREE.Group();
  jack.position.set(4.6, 0, 2.1);
  jack.rotation.y = -0.5;
  const jackMesh = (geo: BufferGeometry, mat: Standard, x: number, y: number, z: number) => {
    const m = new THREE.Mesh(geo, mat);
    m.position.set(x, y, z);
    m.castShadow = true;
    jack.add(m);
  };
  jackMesh(builder.roundedBox(1.15, 0.05, 0.16, 0.02), steel, 0.3, 0.09, 0.24);
  jackMesh(builder.roundedBox(1.15, 0.05, 0.16, 0.02), steel, 0.3, 0.09, -0.24);
  jackMesh(builder.roundedBox(0.14, 0.42, 0.1, 0.03), steel, -0.2, 0.3, 0.24);
  jackMesh(builder.roundedBox(0.14, 0.42, 0.1, 0.03), steel, -0.2, 0.3, -0.24);
  jackMesh(builder.roundedBox(0.55, 0.3, 0.62, 0.08), builder.standard(0xe61919, 0.55), -0.45, 0.6, 0);
  const handle = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 1.15, 8), steel);
  handle.position.set(-0.85, 1.0, 0);
  handle.rotation.x = -0.3;
  handle.castShadow = true;
  jack.add(handle);
  station.add(jack);

  builder.flushBatches(stationBatches, station);

  /* --------- roadside & skyline (slides during departure) --------- */

  const trunkMat = builder.standard(0x3d2814, 0.9);
  const leafMat = builder.standard(0x2f4a2b, 0.9);
  const treeCount = Math.max(10, Math.floor(26 * instanceScale));
  addInstances(
    new THREE.CapsuleGeometry(0.16, 1.2, 4, 10),
    trunkMat,
    treeCount,
    (i, d) => {
      d.position.set(-60 + i * 6.5, 0.9, -8.2 + hash(i * 3.3) * 1.6);
      d.scale.set(1, 0.85 + (i % 3) * 0.1, 1);
    },
    scenery,
  );
  // Clay-style trees: soft stacked spheres instead of polygonal cones.
  addInstances(
    new THREE.SphereGeometry(1.05, 14, 12),
    leafMat,
    treeCount,
    (i, d) => {
      d.position.set(-60 + i * 6.5, 2.35, -8.2 + hash(i * 3.3) * 1.6);
      d.scale.set(1, 0.82 + (i % 3) * 0.08, 1);
    },
    scenery,
  );
  addInstances(
    new THREE.SphereGeometry(0.72, 12, 10),
    leafMat,
    treeCount,
    (i, d) => {
      d.position.set(-60 + i * 6.5, 3.35, -8.2 + hash(i * 3.3) * 1.6);
      d.rotation.set(0, hash(i) * Math.PI, 0);
      d.scale.set(1, 0.85 + (i % 3) * 0.1, 1);
    },
    scenery,
  );
  addInstances(
    new THREE.CylinderGeometry(0.07, 0.09, 4.4, 8),
    steel,
    10,
    (i, d) => d.position.set(-50 + i * 20, 2.2, 10.5),
    scenery,
  );
  addInstances(
    builder.roundedBox(0.5, 0.12, 0.28, 0.04),
    lampGlow,
    10,
    (i, d) => d.position.set(-50 + i * 20, 4.5, 10.5),
    scenery,
  );
  addInstances(
    new THREE.BoxGeometry(1, 1, 1),
    builder.standard(0x2b2b28, 1),
    16,
    (i, d) => {
      const w = 5 + hash(i * 3.1) * 6;
      const h = 6 + hash(i * 5.7) * 12;
      d.position.set(-70 + i * 9.4 + hash(i) * 4, h / 2, -36 - hash(i * 2.2) * 20);
      d.scale.set(w, h, 7);
    },
    scenery,
  );

  /* --------- truck --------- */

  const truckRoot = new THREE.Group(); // departure translation only
  scene.add(truckRoot);
  const truckBody = new THREE.Group(); // suspension: squat, pitch, roll
  truckRoot.add(truckBody);

  const cabMat = builder.painted(0xe61919);
  const boxMat = builder.painted(0xf4f6f9, 0.5);
  const trimMat = builder.standard(0x242b36, 0.6, 0.25);
  const glassMat = builder.standard(0x8f979f, 0.18, 0.3);
  glassMat.envMapIntensity = 1.3;
  const chromeMat = builder.standard(0xdde5ee, 0.3, 0.55);
  chromeMat.envMapIntensity = 1.6;
  const frameMat = builder.standard(0x6b7686, 0.6, 0.2);
  const interiorMat = builder.standard(0xa8b2c0, 0.85);
  const headlampMat = new THREE.MeshStandardMaterial({
    color: 0xfff7cf,
    emissive: 0xfff3b0,
    emissiveIntensity: 0.9,
    roughness: 0.2,
  });
  const tailMat = new THREE.MeshStandardMaterial({
    color: 0x7f1d1d,
    emissive: 0xdc2626,
    emissiveIntensity: 0.35,
    roughness: 0.3,
  });
  const amberMat = new THREE.MeshStandardMaterial({
    color: 0xfbbf24,
    emissive: 0xf59e0b,
    emissiveIntensity: 0.9,
    roughness: 0.4,
  });

  const addPart = (
    geo: BufferGeometry,
    mat: Standard,
    x: number,
    y: number,
    z: number,
    rot: { x?: number; y?: number; z?: number } = {},
  ) => builder.queuePart(truckBatches, geo, mat, [x, y, z], rot);

  // Chassis.
  addPart(builder.roundedBox(7.2, 0.28, 0.26, 0.06), trimMat, 0.6, 0.72, 0.62);
  addPart(builder.roundedBox(7.2, 0.28, 0.26, 0.06), trimMat, 0.6, 0.72, -0.62);
  addPart(builder.roundedBox(6.9, 0.14, 2.2, 0.05), trimMat, 0.6, 0.98, 0);

  // Underbody equipment (all clearances audited against the wheels).
  const tankGeo = new THREE.CapsuleGeometry(0.26, 1.1, 4, 12);
  tankGeo.rotateZ(Math.PI / 2);
  addPart(tankGeo, chromeMat, 2.0, 0.56, 0.88);
  addPart(builder.roundedBox(0.72, 0.5, 0.46, 0.07), trimMat, 0.55, 0.62, -0.9);
  const airGeo = new THREE.CapsuleGeometry(0.12, 0.7, 4, 10);
  airGeo.rotateZ(Math.PI / 2);
  addPart(airGeo, chromeMat, -0.6, 0.56, 0.95);
  addPart(airGeo, chromeMat, -0.6, 0.56, -0.95);

  // Cab: rounded volumes with a raked screen.
  addPart(builder.roundedBox(1.98, 1.08, 2.3, 0.12), cabMat, 3.1, 1.47, 0);
  addPart(builder.roundedBox(1.74, 0.88, 2.36, 0.14), cabMat, 3.04, 2.38, 0);
  addPart(builder.roundedBox(1.5, 0.1, 2.2, 0.04), cabMat, 3.0, 2.87, 0);
  addPart(builder.roundedBox(0.1, 0.8, 2.08, 0.03), glassMat, 3.92, 2.42, 0, { z: -0.13 });
  addPart(builder.roundedBox(0.1, 0.8, 0.08, 0.03), cabMat, 3.88, 2.42, 0);
  addPart(builder.roundedBox(0.5, 0.09, 2.3, 0.03), cabMat, 3.85, 2.95, 0, { z: 0.2 });
  for (const mz of [-0.5, 0, 0.5]) {
    addPart(builder.roundedBox(0.12, 0.08, 0.16, 0.02), amberMat, 3.62, 3.0, mz);
  }
  for (const side of [1, -1]) {
    addPart(builder.roundedBox(0.5, 0.025, 0.03, 0.01), trimMat, 3.99, 2.3, side * 0.55, {
      z: -0.13,
      y: side * -0.3,
    });
  }
  // Grille, badge, bumper, lighting.
  addPart(builder.roundedBox(0.1, 0.68, 1.5, 0.03), trimMat, 4.2, 1.74, 0);
  for (let i = 0; i < 5; i += 1) {
    addPart(builder.roundedBox(0.05, 0.05, 1.42, 0.015), chromeMat, 4.26, 1.44 + i * 0.15, 0);
  }
  const logoGeo = new THREE.CylinderGeometry(0.09, 0.09, 0.05, 16);
  logoGeo.rotateZ(Math.PI / 2);
  addPart(logoGeo, chromeMat, 4.28, 2.16, 0);
  addPart(builder.roundedBox(0.34, 0.44, 2.3, 0.08), trimMat, 4.16, 1.18, 0);
  for (const side of [1, -1]) {
    addPart(builder.roundedBox(0.1, 0.32, 0.5, 0.04), headlampMat, 4.22, 1.62, side * 0.85);
    addPart(builder.roundedBox(0.05, 0.16, 0.28, 0.02), headlampMat, 4.33, 1.06, side * 0.8);
    addPart(builder.roundedBox(0.06, 0.1, 0.2, 0.02), amberMat, 4.24, 1.86, side * 0.84);
  }
  // Doors, steps (narrowed to clear the front wheels), mirrors.
  for (const side of [1, -1]) {
    addPart(builder.roundedBox(1.12, 0.6, 0.08, 0.03), glassMat, 3.08, 2.44, side * 1.14, { z: -0.05 });
    addPart(builder.roundedBox(0.2, 0.05, 0.04, 0.015), chromeMat, 2.86, 1.92, side * 1.18);
    addPart(builder.roundedBox(0.6, 0.07, 0.36, 0.02), trimMat, 3.16, 1.0, side * 0.98);
    addPart(builder.roundedBox(0.6, 0.07, 0.36, 0.02), trimMat, 3.16, 0.72, side * 0.98);
    addPart(builder.roundedBox(0.05, 0.05, 0.4, 0.015), trimMat, 3.9, 2.52, side * 1.32);
    addPart(builder.roundedBox(0.09, 0.46, 0.16, 0.03), glassMat, 3.9, 2.36, side * 1.56);
  }
  // Roof deflector + chrome exhaust stack.
  addPart(builder.roundedBox(0.8, 0.09, 2.2, 0.03), boxMat, 2.45, 2.98, 0, { z: 0.22 });
  addPart(new THREE.CylinderGeometry(0.09, 0.09, 1.6, 12), chromeMat, 2.3, 1.75, -1.34);
  addPart(new THREE.CylinderGeometry(0.13, 0.13, 0.5, 12), chromeMat, 2.3, 2.1, -1.34);
  addPart(new THREE.CylinderGeometry(0.11, 0.11, 0.08, 12), chromeMat, 2.3, 2.62, -1.34);

  /* Cargo box ---------------------------------------------------------- */

  const cargoLen = CARGO.frontX - CARGO.rearX;
  const cargoMidX = (CARGO.rearX + CARGO.frontX) / 2;
  const cargoH = CARGO.roofY - CARGO.floorY;
  const cargoMidY = (CARGO.floorY + CARGO.roofY) / 2;
  const cargoW = (CARGO.halfWidth + CARGO.wall) * 2;

  addPart(builder.roundedBox(cargoLen + 0.14, 0.08, cargoW, 0.03), boxMat, cargoMidX, CARGO.floorY - 0.04, 0);
  addPart(builder.roundedBox(cargoLen + 0.14, 0.08, cargoW, 0.03), boxMat, cargoMidX, CARGO.roofY + 0.04, 0);
  for (const side of [1, -1]) {
    addPart(builder.roundedBox(cargoLen + 0.14, cargoH, CARGO.wall, 0.03), boxMat, cargoMidX, cargoMidY, side * (CARGO.halfWidth + CARGO.wall / 2));
    // Capsule pilasters — soft ribs along the box sides.
    addInstances(
      new THREE.CapsuleGeometry(0.05, cargoH - 0.5, 4, 10),
      chromeMat,
      6,
      (i, d) => {
        d.position.set(CARGO.rearX + 0.3 + i * ((cargoLen - 0.6) / 5), cargoMidY, side * (CARGO.halfWidth + CARGO.wall + 0.03));
      },
      truckBody,
      true,
    );
    for (const mx of [-2.8, -1.4, 0, 1.4]) {
      addPart(builder.roundedBox(0.12, 0.06, 0.05, 0.015), amberMat, mx, 1.06, side * (CARGO.halfWidth + CARGO.wall + 0.01));
    }
  }
  addPart(builder.roundedBox(CARGO.wall, cargoH, cargoW, 0.03), boxMat, CARGO.frontX + CARGO.wall / 2, cargoMidY, 0);
  for (const x of [CARGO.rearX - 0.04, CARGO.frontX + 0.04]) {
    for (const side of [1, -1]) {
      addPart(builder.roundedBox(0.1, cargoH + 0.1, 0.1, 0.03), frameMat, x, cargoMidY, side * (CARGO.halfWidth + CARGO.wall / 2));
    }
  }

  // Rear opening: jambs, header, threshold.
  for (const side of [1, -1]) {
    addPart(builder.roundedBox(0.07, cargoH, 0.08, 0.02), frameMat, CARGO.rearX - 0.035, cargoMidY, side * (CARGO.halfWidth - 0.06));
  }
  addPart(builder.roundedBox(0.07, 0.14, cargoW, 0.03), frameMat, CARGO.rearX - 0.035, CARGO.roofY - 0.07, 0);
  addPart(builder.roundedBox(0.12, 0.05, 2.52, 0.02), chromeMat, CARGO.rearX - 0.01, CARGO.floorY - 0.05, 0);

  // Rear safety: underride guard, step bumper, taillights, plate, mudflaps.
  addPart(builder.roundedBox(0.08, 0.14, 2.2, 0.03), trimMat, CARGO.rearX - 0.42, 0.6, 0);
  for (const side of [1, -1]) {
    addPart(builder.roundedBox(0.08, 0.42, 0.1, 0.03), trimMat, CARGO.rearX - 0.42, 0.84, side * 0.95);
  }
  addPart(builder.roundedBox(0.18, 0.16, 2.3, 0.05), trimMat, CARGO.rearX - 0.36, 0.48, 0);
  for (const side of [1, -1]) {
    addPart(builder.roundedBox(0.06, 0.24, 0.34, 0.02), tailMat, CARGO.rearX - 0.3, 0.98, side * 1.02);
    addPart(builder.roundedBox(0.05, 0.09, 0.12, 0.015), amberMat, CARGO.rearX - 0.3, 0.8, side * 0.55);
    addPart(builder.roundedBox(0.06, 0.6, 0.55, 0.02), rubber, -2.55, 0.45, side * 1.45);
  }
  addPart(builder.roundedBox(0.04, 0.2, 0.44, 0.015), builder.standard(0xf6f8fb, 0.7), CARGO.rearX - 0.34, 0.7, 0);

  // Roller shutter + housing + tracks.
  const slatH = cargoH / SHUTTER_SLATS;
  const slats = addInstances(
    builder.roundedBox(0.06, slatH * 0.92, (CARGO.halfWidth - 0.04) * 2, 0.02),
    builder.standard(0xe6ebf2, 0.4, 0.3),
    SHUTTER_SLATS,
    () => {},
    truckBody,
    true,
  );
  const housingGeo = new THREE.CylinderGeometry(0.18, 0.18, cargoW * 0.98, 14);
  housingGeo.rotateX(Math.PI / 2);
  addPart(housingGeo, frameMat, CARGO.rearX - 0.1, CARGO.roofY + 0.22, 0);
  for (const side of [1, -1]) {
    addPart(builder.roundedBox(0.12, cargoH, 0.08, 0.02), frameMat, CARGO.rearX - 0.09, cargoMidY, side * (CARGO.halfWidth - 0.045));
  }

  // Interior: ribs + warm ceiling lamp so the box reads as a volume.
  addInstances(
    new THREE.BoxGeometry(0.06, 0.02, (CARGO.halfWidth - 0.06) * 2),
    interiorMat,
    14,
    (i, d) => d.position.set(CARGO.rearX + 0.2 + i * ((cargoLen - 0.4) / 13), CARGO.floorY + 0.015, 0),
    truckBody,
  );
  addPart(builder.roundedBox(0.05, cargoH, (CARGO.halfWidth - 0.04) * 2, 0.02), interiorMat, CARGO.frontX - 0.05, cargoMidY, 0);
  addPart(builder.roundedBox(0.5, 0.03, 0.5, 0.015), lampGlow, cargoMidX, CARGO.roofY - 0.04, 0);
  const interiorLight = new THREE.PointLight(0xfff1dc, 5, 6, 2);
  interiorLight.position.set(cargoMidX, CARGO.roofY - 0.35, 0);
  truckBody.add(interiorLight);

  builder.flushBatches(truckBatches, truckBody);

  // Livery decal planes (procedural canvas texture).
  const liveryTex = makeLiveryTexture(THREE);
  if (liveryTex) {
    const liveryMat = new THREE.MeshStandardMaterial({ map: liveryTex, roughness: 0.5, metalness: 0.05 });
    const liveryGeo = new THREE.PlaneGeometry(4.55, 1.02);
    for (const side of [1, -1]) {
      const plane = new THREE.Mesh(liveryGeo, liveryMat);
      plane.position.set(-0.55, 2.75, side * (CARGO.halfWidth + CARGO.wall + 0.045));
      if (side < 0) plane.rotation.y = Math.PI;
      truckBody.add(plane);
    }
  }

  /* Wheels — torus tires (axis along z, the true axle), unsprung. ------ */

  const tireMat = builder.standard(0x242930, 0.95);
  const hubMat = builder.standard(0xb9c2cf, 0.3, 0.7);
  const tireGeo = new THREE.TorusGeometry(0.385, 0.155, 14, 28); // outer radius 0.54
  const hubGeo = new THREE.CylinderGeometry(0.24, 0.24, 0.36, 16);
  hubGeo.rotateX(Math.PI / 2);
  const WHEEL_X = [3.0, 0.5, -1.7];
  const wheelPos: [number, number][] = [];
  for (const ax of WHEEL_X) for (const side of [1, -1]) wheelPos.push([ax, side * 1.3]);
  const tires = addInstances(
    tireGeo,
    tireMat,
    6,
    (i, d) => d.position.set(wheelPos[i][0], 0.54, wheelPos[i][1]),
    truckRoot,
    true,
  );
  const hubs = addInstances(
    hubGeo,
    hubMat,
    6,
    (i, d) => d.position.set(wheelPos[i][0], 0.54, wheelPos[i][1]),
    truckRoot,
  );

  /* --------- crates: body + tape + label, 3 draw calls total ---------- */

  const crateBodyGeo = builder.roundedBox(CRATE.size, CRATE.h, CRATE.size, 0.07, 3);
  /* The strapping band only just clears the crate shell. It used to be 3%
   * proud of the body, which was invisible when crates were spaced apart but
   * pushed 0.011 into the neighbouring crate once the lattice packed flush. */
  const tapeGeo = builder.roundedBox(CRATE.size * 1.012, 0.15, CRATE.size * 1.012, 0.03, 2);
  tapeGeo.translate(0, CRATE.h / 2 - 0.09, 0);
  const labelGeo = new THREE.PlaneGeometry(0.42, 0.26);
  labelGeo.rotateY(-Math.PI / 2);
  labelGeo.translate(-(CRATE.size / 2 + 0.006), 0.02, 0);

  const crateCardboardTex = makeCrateCardboardTexture(THREE);
  const crateBodies = new THREE.InstancedMesh(
    crateBodyGeo,
    crateCardboardTex
      ? new THREE.MeshStandardMaterial({
          color: 0xffffff,
          map: crateCardboardTex,
          roughness: 0.72,
          metalness: 0.03,
        })
      : new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.72, metalness: 0.03 }),
    CRATE_COUNT,
  );
  const crateTapes = new THREE.InstancedMesh(tapeGeo, tapeMat, CRATE_COUNT);
  const crateLabelTex = makeCrateLabelTexture(THREE);
  const crateLabels = new THREE.InstancedMesh(
    labelGeo,
    crateLabelTex
      ? new THREE.MeshStandardMaterial({ map: crateLabelTex, roughness: 0.85 })
      : new THREE.MeshStandardMaterial({ color: 0xf6f8fb, roughness: 0.8 }),
    CRATE_COUNT,
  );
  for (const mesh of [crateBodies, crateTapes, crateLabels]) {
    mesh.frustumCulled = false;
    mesh.castShadow = mesh === crateBodies;
    mesh.receiveShadow = true;
    truckBody.add(mesh);
  }
  const inFlightColor = new THREE.Color(CRATE_IN_FLIGHT);
  const seatColors = PLANS.map(
    (plan) =>
      new THREE.Color(CRATE_SEATED).multiplyScalar(0.9 + hash(plan.seat.x * 13.7 + plan.seat.z * 7.9) * 0.14),
  );
  const scratchColor = new THREE.Color();
  for (let i = 0; i < CRATE_COUNT; i += 1) crateBodies.setColorAt(i, inFlightColor);

  /* --------- departure dust: deterministic, scrub-safe puffs ---------
   * Every other moving thing in this scene is a closed-form function of
   * the scroll position `p`, so it can be scrubbed forward or backward
   * with no simulation state. Dust follows the same rule: each puff's
   * spawn point is precomputed from the truck's own closed-form motion
   * formula (the shared `departureProgress` + `truckDepartureX`) evaluated at
   * its fixed start time, so a puff never needs to "remember" anything — its
   * whole life is a pure function of (p - start). */
  const DUST_COUNT = 12;
  const DUST_LIFE = 0.34;
  const dustTex = makeDustTexture(THREE);
  const dustParticles: {
    sprite: InstanceType<typeof THREE.Sprite>;
    mat: InstanceType<typeof THREE.SpriteMaterial>;
    start: number;
    baseX: number;
    z: number;
  }[] = [];
  if (dustTex) {
    for (let i = 0; i < DUST_COUNT; i += 1) {
      const start = 0.06 + hash(i * 9.1 + 4) * 0.6;
      const baseX = truckDepartureX(start);
      const z = (i % 2 === 0 ? 1 : -1) * (1.15 + hash(i * 5.3) * 0.35);
      const mat = new THREE.SpriteMaterial({
        map: dustTex,
        color: 0xd8dee6,
        transparent: true,
        opacity: 0,
        depthWrite: false,
      });
      const sprite = new THREE.Sprite(mat);
      sprite.scale.set(0.01, 0.01, 1);
      scene.add(sprite);
      dustParticles.push({ sprite, mat, start, baseX, z });
    }
  }

  /* --------- render loop --------- */

  const dummy = new THREE.Object3D();
  const camPos = new THREE.Vector3();
  const lookTarget = new THREE.Vector3();

  const pointer = { x: 0, y: 0 };
  const pointerTarget = { x: 0, y: 0 };
  const canHover = window.matchMedia("(hover: hover)").matches;
  const onPointerMove = (e: PointerEvent) => {
    pointerTarget.x = (e.clientX / window.innerWidth) * 2 - 1;
    pointerTarget.y = (e.clientY / window.innerHeight) * 2 - 1;
  };
  if (!reduceMotion && canHover) {
    window.addEventListener("pointermove", onPointerMove, { passive: true });
  }

  const hideInstance = (mesh: InstancedMesh, i: number) => {
    dummy.position.set(0, -50, 0);
    dummy.scale.setScalar(0);
    dummy.rotation.set(0, 0, 0);
    dummy.updateMatrix();
    mesh.setMatrixAt(i, dummy.matrix);
  };

  const applyScene = (p: number, time: number, dt: number) => {
    /* Departure progress, hoisted above the camera because the pointer
     * parallax and idle bob have to fade out with it — both nudge the
     * camera, and any camera nudge drags the station across the frame. */
    const depT = departureProgress(p);
    const settle = cameraSettle(p);

    /* Camera: keyframed rail, rigid departure dolly, damped pointer parallax.
     * The parallax and bob are locked out (`settle`) before the dolly starts,
     * so the rig translating past the station is already perfectly still. */
    const pd = 1 - Math.exp(-6 * dt);
    pointer.x += (pointerTarget.x - pointer.x) * pd;
    pointer.y += (pointerTarget.y - pointer.y) * pd;
    const px = pointer.x * MOTION * settle;
    const py = pointer.y * MOTION * settle;
    const rail = departureCameraRig(p);
    /* Pull-back: uniform scale of the camera offset around the look target.
     * During the departure the rail is frozen, so this is still a pure
     * translation of the whole rig. */
    const pb = framing.pullBack;
    camPos.set(
      rail.look[0] + (rail.pos[0] - rail.look[0]) * pb,
      rail.look[1] + (rail.pos[1] - rail.look[1]) * pb,
      rail.look[2] + (rail.pos[2] - rail.look[2]) * pb,
    );
    lookTarget.set(rail.look[0], rail.look[1], rail.look[2]);
    camera.position.set(
      camPos.x + px * 0.6,
      camPos.y - py * 0.4 + Math.sin(time * 0.4) * 0.04 * MOTION * settle,
      camPos.z,
    );
    lookTarget.x += px * 0.35;
    lookTarget.y -= py * 0.22;
    camera.lookAt(lookTarget);

    /* Departure: the truck accelerates away and the camera dollies with it, so
       the dock stays anchored in the world and falls behind the lens — pure
       rigid translation, no pan. The scenery slides past independently. For the
       first leg the truck rides the same total as the rig, holding a constant
       lateral offset; the tail (`TRUCK_OVERRUN_START`) lets the truck alone
       pull ahead, recede and clear the frame, so the departure finishes on
       empty road instead of an in-place dissolve. */
    const truckX = truckDepartureX(depT) + truckOverrunX(depT);
    const groundX = 9 * depT + 44 * depT * depT;
    truckRoot.position.x = truckX;
    scenery.position.x = -groundX;

    // Road dashes wrap to sell the driving cue.
    for (let i = 0; i < DASH_COUNT; i += 1) {
      dummy.position.set(wrap(i * DASH_SPACING - groundX, DASH_SPAN) - 60, 0.03, 0);
      dummy.rotation.set(0, 0, 0);
      dummy.scale.setScalar(1);
      dummy.updateMatrix();
      dashes.setMatrixAt(i, dummy.matrix);
    }
    dashes.instanceMatrix.needsUpdate = true;

    // Wheels roll from actual distance: angle = distance / radius.
    const wheelAngle = -(groundX + truckX) / 0.54;
    for (let i = 0; i < 6; i += 1) {
      dummy.position.set(wheelPos[i][0], 0.54, wheelPos[i][1]);
      dummy.rotation.set(0, 0, wheelAngle);
      dummy.scale.setScalar(1);
      dummy.updateMatrix();
      tires.setMatrixAt(i, dummy.matrix);
      hubs.setMatrixAt(i, dummy.matrix);
    }
    tires.instanceMatrix.needsUpdate = true;
    hubs.instanceMatrix.needsUpdate = true;

    /* Suspension: weight squat + per-landing impulse kernels + shutter thunk.
       All closed-form functions of p → fully reversible scrubbing. */
    let seated = 0;
    let kickY = 0;
    let kickP = 0;
    let kickR = 0;
    for (let i = 0; i < CRATE_COUNT; i += 1) {
      if (p >= PLANS[i].land) seated += 1;
      const tau = (p - PLANS[i].land) / 0.05;
      if (tau > 0 && tau < 3) {
        const k = Math.exp(-1.7 * tau) * Math.sin(6.7 * tau);
        kickY += k;
        kickP += k * (PLANS[i].seat.x + 0.6);
        kickR += k * PLANS[i].seat.z;
      }
    }
    const loadFrac = seated / CRATE_COUNT;
    const thunkTau = (p - SCENE_PHASES.shutterEnd) / 0.045;
    const thunk =
      thunkTau > 0 && thunkTau < 3 ? Math.exp(-2 * thunkTau) * Math.sin(9 * thunkTau) * 1.3 : 0;
    const idle =
      (Math.sin(time * 33) * 0.0032 + Math.sin(time * 47 + 1.7) * 0.0022) * MOTION * settle;
    truckBody.position.y = clamp(-0.045 * loadFrac + kickY * 0.04 + idle, -0.12, 0.06);

    /* Launch pitch: nose lifts and the rear squats as the truck pulls away,
     * so the departure reads as weight rather than a slide. */
    const launch = 0.02 * Math.sin(Math.PI * clamp01(depT / 0.3)) * MOTION;
    truckBody.rotation.set(
      clamp(kickR * 0.03 + Math.sin(time * 0.9) * 0.0035 * MOTION * settle, -0.05, 0.05),
      0,
      clamp(0.011 * loadFrac + kickP * 0.05 + thunk * 0.05, -0.04, 0.05) + launch,
    );

    /* Roller shutter unrolls slat by slat out of the housing. */
    const shutterT = clamp01((p - SCENE_PHASES.shutterStart) / (SCENE_PHASES.shutterEnd - SCENE_PHASES.shutterStart));
    for (let i = 0; i < SHUTTER_SLATS; i += 1) {
      const r = clamp01(shutterT * 1.25 - i * 0.028);
      dummy.position.set(
        CARGO.rearX - 0.09,
        lerp(CARGO.roofY + 0.1, CARGO.roofY - (i + 0.5) * slatH, easeOutCubic(r)),
        0,
      );
      dummy.rotation.set(0, 0, 0);
      dummy.scale.set(1, Math.max(0.02, r), 1);
      dummy.updateMatrix();
      slats.setMatrixAt(i, dummy.matrix);
    }
    slats.instanceMatrix.needsUpdate = true;

    /* Crates: single-file pipeline. One crate in the door at a time. */
    for (let i = 0; i < CRATE_COUNT; i += 1) {
      const plan = PLANS[i];
      if (p < plan.start) {
        hideInstance(crateBodies, i);
        hideInstance(crateTapes, i);
        hideInstance(crateLabels, i);
        continue;
      }
      const flightEnd = plan.start + WINDOW * CRATE.flightFrac;
      let x: number;
      let y: number;
      let z: number;
      let rotY: number;
      let rotZ = 0;
      let s = 1;
      let sy = 1;
      if (p < flightEnd) {
        // Phase A: swoop from behind the viewer to the door lane.
        const e = smoothstep(clamp01((p - plan.start) / (flightEnd - plan.start)));
        x = lerp(plan.spawn.x, plan.door.x, e);
        y = lerp(plan.spawn.y, plan.door.y, e) + Math.sin(Math.PI * e) * plan.arc;
        z = lerp(plan.spawn.z, plan.door.z, e);
        rotY = lerp(plan.spawn.rot, 0, e);
        rotZ = Math.sin(Math.PI * e) * 0.08 * (i % 2 === 0 ? 1 : -1);
        s = easeOutCubic(clamp01((p - plan.start) / (WINDOW * 0.12)));
      } else {
        // Phase B: straight axial slide into the (guaranteed empty) seat.
        const e = smoothstep(clamp01((p - flightEnd) / (plan.land - flightEnd)));
        x = lerp(plan.door.x, plan.seat.x, e);
        y = lerp(plan.door.y, plan.seat.y, e);
        z = lerp(plan.door.z, plan.seat.z, e);
        rotY = plan.seat.rot * e;
        const tau = (p - plan.land) / SETTLE_WINDOW;
        if (tau > 0 && tau < 4 && MOTION) {
          const d = Math.exp(-2.6 * tau);
          y += 0.04 * d * Math.sin(8.5 * tau);
          rotY += 0.045 * d * Math.sin(7 * tau);
          const sq = Math.exp(-4.5 * tau) * Math.sin(9 * tau) * 0.05;
          sy = 1 - sq;
          s = 1 + sq * 0.5;
        }
      }
      dummy.position.set(x, y, z);
      dummy.rotation.set(0, rotY, rotZ);
      dummy.scale.set(s, sy, s);
      dummy.updateMatrix();
      crateBodies.setMatrixAt(i, dummy.matrix);
      crateTapes.setMatrixAt(i, dummy.matrix);
      crateLabels.setMatrixAt(i, dummy.matrix);
      scratchColor
        .copy(inFlightColor)
        .lerp(seatColors[i], clamp01((p - plan.start) / (plan.land - plan.start)));
      crateBodies.setColorAt(i, scratchColor);
    }
    crateBodies.instanceMatrix.needsUpdate = true;
    crateTapes.instanceMatrix.needsUpdate = true;
    crateLabels.instanceMatrix.needsUpdate = true;
    if (crateBodies.instanceColor) crateBodies.instanceColor.needsUpdate = true;

    /* Dust: pure function of (depT - start), reversible under scrubbing. */
    if (dustTex && MOTION) {
      for (const puff of dustParticles) {
        const age = depT - puff.start;
        if (age <= 0 || age >= DUST_LIFE) {
          puff.mat.opacity = 0;
          continue;
        }
        const t = age / DUST_LIFE;
        const rise = t * 1.1;
        const drift = t * 4.2;
        const scale = 0.3 + t * 1.1;
        puff.sprite.position.set(puff.baseX - 1.9 - drift, 0.22 + rise, puff.z);
        puff.sprite.scale.set(scale, scale, 1);
        puff.mat.opacity = Math.sin(Math.PI * t) * 0.3;
      }
    }

    /* Brake-light flare + shadow rig tracks the truck. */
    tailMat.emissiveIntensity = 0.35 + depT * 1.9 + (depT > 0 && depT < 0.25 ? 1.2 : 0);
    keyLight.position.set(truckX + 9, 15, 11);
    keyLight.target.position.set(truckX, 0, 0);
    keyLight.target.updateMatrixWorld();
  };

  const resize = () => {
    const width = canvas.clientWidth || canvas.parentElement?.clientWidth || 1;
    const height = canvas.clientHeight || canvas.parentElement?.clientHeight || 1;

    const c = canvas.getBoundingClientRect();
    const s = stageEl?.getBoundingClientRect();
    const hasStage = !!s && s.width > 1 && s.height > 1;
    const stageW = hasStage ? s!.width : width;
    const stageH = hasStage ? s!.height : height;
    // Offset of the stage centre from the canvas centre, in px (+x right, +y down).
    const shiftX = hasStage ? s!.left + s!.width / 2 - c.left - width / 2 : 0;
    const shiftY = hasStage ? s!.top + s!.height / 2 - c.top - height / 2 : 0;

    // The truck needs ~1.3x the stage height in horizontal room and ~80% of its
    // height vertically. Widen the FOV to fit; past MAX_TAN, pull the camera back.
    const need = BASE_TAN * Math.max(1, (1.3 * height) / stageW, (0.8 * height) / stageH);
    camera.fov = 2 * THREE.MathUtils.radToDeg(Math.atan(Math.min(need, MAX_TAN)));
    framing.pullBack = clamp(need / MAX_TAN, 1, 2);

    camera.aspect = width / Math.max(1, height);
    // Negative window offset = content moves toward the stage centre.
    camera.setViewOffset(width, height, -shiftX, -shiftY, width, height);
    renderer.setSize(width, height, false);
  };

  let smoothed = clamp01(progressRef.current);
  let lastTime = performance.now();
  let lastStage = -1;
  let frame = 0;
  let running = false;

  const render = (now: number) => {
    const dt = Math.min(0.05, Math.max(0.001, (now - lastTime) / 1000));
    lastTime = now;

    // Frame-rate-independent scroll damping — the "seamless" core.
    const target = clamp01(progressRef.current);
    const k = reduceMotion ? 60 : 9.5;
    smoothed += (target - smoothed) * (1 - Math.exp(-k * dt));
    if (Math.abs(target - smoothed) < 0.0004) smoothed = target;

    applyScene(smoothed, now * 0.001, dt);
    renderer.render(scene, camera);

    let stage = 0;
    for (const edge of STAGE_EDGES) if (smoothed >= edge) stage += 1;
    if (stage !== lastStage) {
      lastStage = stage;
      onStageChange(stage);
    }
  };

  const loop = (now: number) => {
    render(now);
    frame = requestAnimationFrame(loop);
  };

  const setVisible = (visible: boolean) => {
    if (visible === running) return;
    running = visible;
    if (visible) {
      lastTime = performance.now();
      frame = requestAnimationFrame(loop);
    } else {
      cancelAnimationFrame(frame);
    }
  };

  resize();
  render(performance.now());

  const resizeObserver = new ResizeObserver(() => {
    resize();
    renderer.render(scene, camera);
  });
  resizeObserver.observe(canvas);
  if (stageEl) resizeObserver.observe(stageEl);

  if (initialVisible) setVisible(true);

  const dispose = () => {
    setVisible(false);
    resizeObserver.disconnect();
    window.removeEventListener("pointermove", onPointerMove);
    liveryTex?.dispose();
    signTex?.dispose();
    crateLabelTex?.dispose();
    crateCardboardTex?.dispose();
    dustTex?.dispose();
    for (const puff of dustParticles) {
      scene.remove(puff.sprite);
      puff.mat.dispose();
    }
    // The PMREM render target backs `scene.environment`; the geometry and
    // material it was baked from were handed back at build time, but the
    // target itself only becomes collectable here.
    envRT.dispose();
    scene.traverse((object) => {
      const mesh = object as Mesh & { isInstancedMesh?: boolean };
      if (!mesh.isMesh) return;
      mesh.geometry.dispose();
      if (mesh.isInstancedMesh) mesh.dispose();
      const material = mesh.material;
      if (Array.isArray(material)) material.forEach((entry) => entry.dispose());
      else material.dispose();
    });
    renderer.dispose();
  };

  return { setVisible, dispose };
}