// Landing page (marketing) exports
export {
  BEATS,
  SCENE_LENGTH_MOBILE_VH,
  SCENE_LENGTH_VH,
  STAGE_EDGES,
  TARGET_QUOTA_KG,
  TARGET_REGISTERED_KG,
  TIERS,
  formatKg,
  formatRupiah,
  lockedTierForKg,
  nextTier,
  resolveBeat,
  stageForProgress,
} from "./scene-timeline";

/* The barrel is consumed only for the narrative timeline. Scene geometry
 * (crate-lattice), the camera rail, and the shared math are imported by path
 * so a renderer or test pull pulls exactly the module it needs, and so a
 * bundled scene never drags marketing-copy helpers into its dependency graph. */