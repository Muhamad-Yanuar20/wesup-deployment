/**
 * Procedural canvas textures for the landing scene (zero asset payload).
 *
 * Each factory takes the three.runtime object as a parameter rather than
 * importing it at module scope: the scene pulls three.js in through a dynamic
 * import so a reduced-motion or data-saver visitor never downloads the library.
 *
 * All textures are fully deterministic — no Math.random — so the scene is
 * scrub-reproducible across reloads.
 */

import { CRATE } from "@/lib/landing/crate-lattice";

export function makeLiveryTexture(THREE: typeof import("three")) {
  try {
    const c = document.createElement("canvas");
    c.width = 1024;
    c.height = 232;
    const g = c.getContext("2d");
    if (!g) return null;
    g.fillStyle = "#f4f6f9";
    g.fillRect(0, 0, 1024, 232);
    g.fillStyle = "#2563eb";
    g.fillRect(0, 182, 1024, 24);
    g.fillRect(0, 216, 1024, 8);
    g.fillStyle = "#0f172a";
    g.font = "700 94px 'IBM Plex Sans', Arial, sans-serif";
    g.fillText("WESUP", 56, 126);
    g.fillStyle = "#64748b";
    g.font = "500 28px 'IBM Plex Sans', Arial, sans-serif";
    g.fillText("WHOLESALE, UNLOCKED", 56, 166);
    g.fillStyle = "#2563eb";
    g.fillRect(906, 12, 42, 42);
    g.fillRect(882, 60, 42, 42);
    g.fillRect(930, 60, 42, 42);
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = 8;
    return tex;
  } catch {
    return null;
  }
}

export function makeCrateLabelTexture(THREE: typeof import("three")) {
  try {
    const c = document.createElement("canvas");
    c.width = 256;
    c.height = 160;
    const g = c.getContext("2d");
    if (!g) return null;
    g.fillStyle = "#f6f8fb";
    g.fillRect(0, 0, 256, 160);
    g.strokeStyle = "#c7cfda";
    g.lineWidth = 3;
    g.strokeRect(4, 4, 248, 152);
    // Barcode.
    let x = 18;
    let seed = 7;
    const rand = () => {
      seed = (seed * 16807) % 2147483647;
      return seed / 2147483647;
    };
    while (x < 238) {
      const w = 1.5 + rand() * 3.5;
      g.fillStyle = rand() > 0.5 ? "#1f2937" : "#f6f8fb";
      g.fillRect(x, 14, w, 34);
      x += w;
    }
    // Stencil stamp.
    g.fillStyle = "#dc4b3f";
    g.font = "700 22px 'IBM Plex Mono', monospace";
    g.save();
    g.translate(66, 108);
    g.rotate(-0.06);
    g.fillText("FRAGILE", 0, 0);
    g.restore();
    g.strokeStyle = "#dc4b3f";
    g.lineWidth = 2;
    g.strokeRect(16, 82, 108, 34);
    // Up-arrow "this side up" glyph.
    g.strokeStyle = "#334155";
    g.lineWidth = 2.5;
    g.beginPath();
    g.moveTo(200, 130);
    g.lineTo(200, 96);
    g.moveTo(188, 108);
    g.lineTo(200, 94);
    g.lineTo(212, 108);
    g.stroke();
    g.fillStyle = "#334155";
    g.font = "600 11px 'IBM Plex Mono', monospace";
    g.fillText("THIS SIDE UP", 168, 144);
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = 4;
    return tex;
  } catch {
    return null;
  }
}

/**
 * Corrugated-cardboard surface for the crate bodies.
 *
 * The base is deliberately near-white. In three.js the standard-material
 * fragment chain resolves `map * color * instanceColor`, and this mesh tints its
 * instances from in-flight blue to seated kraft — a mid-tone or coloured base
 * would multiply against those tints and turn the in-flight crates muddy.
 * Contrast is kept low so the paper reads as fibre rather than camouflage, and
 * so the differing UV scales between the extrusion's flat caps and its side
 * walls stay invisible.
 */
export function makeCrateCardboardTexture(THREE: typeof import("three")) {
  try {
    const size = 256;
    const c = document.createElement("canvas");
    c.width = size;
    c.height = size;
    const g = c.getContext("2d");
    if (!g) return null;
    g.fillStyle = "#ffffff";
    g.fillRect(0, 0, size, size);

    // Deterministic fibre speckle — no Math.random, so the texture is stable
    // across reloads and the scene stays fully scrub-reproducible.
    let seed = 20260927;
    const rand = () => {
      seed = (seed * 16807) % 2147483647;
      return seed / 2147483647;
    };
    for (let i = 0; i < 5200; i += 1) {
      const a = 0.03 + rand() * 0.07;
      g.fillStyle = rand() > 0.5 ? `rgba(120,104,80,${a})` : `rgba(255,255,255,${a})`;
      const w = 1 + rand() * 2.5;
      g.fillRect(rand() * size, rand() * size, w, 1);
    }

    // Flute seams: the corrugation that shows through a cut edge.
    g.strokeStyle = "rgba(120,104,80,0.10)";
    g.lineWidth = 1;
    for (let y = 10; y < size; y += 21) {
      g.beginPath();
      g.moveTo(0, y);
      g.lineTo(size, y);
      g.stroke();
    }

    // Fold creases where the four flaps meet.
    g.strokeStyle = "rgba(96,82,62,0.14)";
    g.lineWidth = 2;
    g.beginPath();
    g.moveTo(size / 2, 0);
    g.lineTo(size / 2, size);
    g.moveTo(0, size / 2);
    g.lineTo(size, size / 2);
    g.stroke();

    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    /* roundedBox is an ExtrudeGeometry, whose default UV generator emits UVs
     * in world units rather than 0..1. At roughly one tile per crate face that
     * puts the grain at a believable scale. */
    const perFace = 1 / CRATE.size;
    tex.repeat.set(perFace, perFace);
    tex.anisotropy = 4;
    return tex;
  } catch {
    return null;
  }
}

export function makeDustTexture(THREE: typeof import("three")) {
  try {
    const c = document.createElement("canvas");
    c.width = 128;
    c.height = 128;
    const g = c.getContext("2d");
    if (!g) return null;
    const grad = g.createRadialGradient(64, 64, 0, 64, 64, 64);
    grad.addColorStop(0, "rgba(255,255,255,0.85)");
    grad.addColorStop(0.5, "rgba(255,255,255,0.28)");
    grad.addColorStop(1, "rgba(255,255,255,0)");
    g.fillStyle = grad;
    g.fillRect(0, 0, 128, 128);
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
  } catch {
    return null;
  }
}

export function makeSignTexture(THREE: typeof import("three")) {
  try {
    const c = document.createElement("canvas");
    c.width = 1024;
    c.height = 192;
    const g = c.getContext("2d");
    if (!g) return null;
    g.fillStyle = "#2563eb";
    g.fillRect(0, 0, 1024, 192);
    g.fillStyle = "#ffffff";
    g.font = "700 108px 'IBM Plex Sans', Arial, sans-serif";
    g.fillText("WESUP", 64, 122);
    g.font = "500 34px 'IBM Plex Sans', Arial, sans-serif";
    g.fillStyle = "rgba(255,255,255,0.75)";
    g.fillText("KUMPULKAN VOLUME — BUKA HARGA GROSIR", 66, 168);
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = 8;
    return tex;
  } catch {
    return null;
  }
}