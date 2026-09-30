/**
 * Declarative three.js geometry builders for the landing scene.
 *
 * Centralises the material recipes and the static-batching pipeline the station
 * and the truck are both built from. Nothing here touches the scene graph or
 * the render loop: those stay in `renderer.ts` because they interleave with
 * render-loop state that must not leak across a function boundary.
 *
 * The three.runtime object is injected at construction time rather than
 * imported at module scope: the scene pulls three.js in through a dynamic
 * import so a reduced-motion or data-saver visitor never downloads the library.
 */

import type * as THREE from "three";

type Standard = THREE.MeshStandardMaterial;
/** Merged batch of non-indexed geometries, grouped by material. */
type PendingBatch = { geometry: THREE.BufferGeometry }[];
type Object3D = THREE.Object3D;
type InstancedMesh = THREE.InstancedMesh;

export class BatchBuilder {
  constructor(private readonly three: typeof import("three")) {}

  /** Standard material with fixed speculars. */
  standard(color: number, roughness: number, metalness = 0): Standard {
    return new this.three.MeshStandardMaterial({ color, roughness, metalness });
  }

  /** Clearcoat paint — the premium "product film" finish for cab and box. */
  painted(color: number, roughness = 0.38): Standard {
    return new this.three.MeshPhysicalMaterial({
      color,
      roughness,
      metalness: 0.08,
      clearcoat: 0.55,
      clearcoatRoughness: 0.35,
      envMapIntensity: 1.15,
    });
  }

  /** Beveled boxes, no sharp edges. */
  roundedBox(
    w: number,
    h: number,
    d: number,
    r: number,
    smooth = 3,
  ): THREE.BufferGeometry {
    const rad = Math.min(r, w / 2 - 1e-4, h / 2 - 1e-4, d / 2 - 1e-4);
    const shape = new this.three.Shape();
    const iw = w / 2 - rad;
    const ih = h / 2 - rad;
    shape.moveTo(-iw, -ih);
    shape.lineTo(iw, -ih);
    shape.lineTo(iw, ih);
    shape.lineTo(-iw, ih);
    shape.closePath();
    const geo = new this.three.ExtrudeGeometry(shape, {
      depth: d - rad * 2,
      bevelEnabled: true,
      bevelThickness: rad,
      bevelSize: rad,
      bevelSegments: smooth,
      curveSegments: smooth,
    });
    geo.translate(0, 0, -(d - rad * 2) / 2);
    geo.computeVertexNormals();
    return geo;
  }

  newBatches(): Map<Standard, PendingBatch> {
    return new Map();
  }

  shouldCast(geometry: THREE.BufferGeometry, minSize = 0.5) {
    if (!geometry.boundingBox) geometry.computeBoundingBox();
    const box = geometry.boundingBox;
    if (!box) return true;
    return (
      Math.max(box.max.x - box.min.x, box.max.y - box.min.y, box.max.z - box.min.z) >=
      minSize
    );
  }

  queuePart(
    target: Map<Standard, PendingBatch>,
    geometry: THREE.BufferGeometry,
    material: Standard,
    pos: [number, number, number],
    rot: { x?: number; y?: number; z?: number } = {},
  ) {
    const flat = geometry.index ? geometry.toNonIndexed() : geometry;
    const m = new this.three.Matrix4();
    const q = new this.three.Quaternion().setFromEuler(
      new this.three.Euler(rot.x ?? 0, rot.y ?? 0, rot.z ?? 0),
    );
    m.compose(
      new this.three.Vector3(pos[0], pos[1], pos[2]),
      q,
      new this.three.Vector3(1, 1, 1),
    );
    flat.applyMatrix4(m);
    if (!flat.attributes.normal) flat.computeVertexNormals();
    if (!flat.attributes.uv) {
      const n = flat.attributes.position.count;
      flat.setAttribute("uv", new this.three.BufferAttribute(new Float32Array(n * 2), 2));
    }
    const list = target.get(material);
    if (list) list.push({ geometry: flat });
    else target.set(material, [{ geometry: flat }]);
    if (flat !== geometry) geometry.dispose();
  }

  flushBatches(target: Map<Standard, PendingBatch>, parent: Object3D) {
    for (const [material, pending] of target) {
      const positions: number[] = [];
      const normals: number[] = [];
      const uvs: number[] = [];
      let casts = false;
      for (const { geometry } of pending) {
        const pos = geometry.attributes.position;
        const nrm = geometry.attributes.normal;
        const uv = geometry.attributes.uv;
        for (let i = 0; i < pos.count; i += 1) {
          positions.push(pos.getX(i), pos.getY(i), pos.getZ(i));
          normals.push(nrm.getX(i), nrm.getY(i), nrm.getZ(i));
          uvs.push(uv.getX(i), uv.getY(i));
        }
        if (this.shouldCast(geometry)) casts = true;
        geometry.dispose();
      }
      const merged = new this.three.BufferGeometry();
      merged.setAttribute("position", new this.three.Float32BufferAttribute(positions, 3));
      merged.setAttribute("normal", new this.three.Float32BufferAttribute(normals, 3));
      merged.setAttribute("uv", new this.three.Float32BufferAttribute(uvs, 2));
      const mesh = new this.three.Mesh(merged, material);
      mesh.castShadow = casts;
      mesh.receiveShadow = true;
      parent.add(mesh);
    }
    target.clear();
  }

  addInstances(
    geometry: THREE.BufferGeometry,
    material: Standard,
    count: number,
    place: (i: number, dummy: Object3D) => void,
    parent: Object3D,
    casts = false,
  ): InstancedMesh {
    const mesh = new this.three.InstancedMesh(geometry, material, count);
    const d = new this.three.Object3D();
    for (let i = 0; i < count; i += 1) {
      place(i, d);
      d.updateMatrix();
      mesh.setMatrixAt(i, d.matrix);
    }
    mesh.instanceMatrix.needsUpdate = true;
    // three.js culls instanced meshes by their *unit* geometry bounds, not
    // instance positions — without this, instances silently vanish.
    mesh.frustumCulled = false;
    mesh.castShadow = casts;
    mesh.receiveShadow = true;
    parent.add(mesh);
    return mesh;
  }
}