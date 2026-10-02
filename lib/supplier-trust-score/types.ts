/** Trust score scale 1.00–5.00 (two decimals) from averaged 1–5 star ratings. */
export type TrustScore = number;

/** Detailed trust breakdown for a supplier. */
export interface SupplierTrustBreakdown {
  /** Average rating (1.00–5.00), 0 if no ratings. */
  trustScore: TrustScore;
  /** Total number of ratings received. */
  totalRatings: number;
  /** Count of ratings per star (1–5). */
  scoreCounts: Record<1 | 2 | 3 | 4 | 5, number>;
}

/** Result of trust score evaluation with review bombing context. */
export interface TrustScoreEvaluation {
  breakdown: SupplierTrustBreakdown;
  /** True if supplier has any 1-star ratings. */
  hasOneStarRatings: boolean;
  /** Count of 1-star ratings. */
  oneStarCount: number;
  /** Review bombing protection: trust score NEVER triggers auto-suspend. */
  autoSuspendTriggered: false;
}

/** Thresholds for trust score interpretation (informational only). */
export const TRUST_SCORE_THRESHOLDS = {
  /** Below this: may warrant manual admin review. */
  reviewThreshold: 2.5,
  /** Below this: poor reputation signal. */
  poorThreshold: 3.0,
  /** Above this: good reputation. */
  goodThreshold: 4.0,
  /** Above this: excellent reputation. */
  excellentThreshold: 4.5,
} as const;

/** Trust score labels for UI display. */
export const TRUST_SCORE_LABELS = {
  excellent: "Sangat Baik",
  good: "Baik",
  average: "Cukup",
  poor: "Perlu Perhatian",
  noRatings: "Belum Dinilai",
} as const;