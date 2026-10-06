import type {
  SupplierTrustBreakdown,
  TrustScoreEvaluation,
  TrustScore,
} from "./types";
import { TRUST_SCORE_THRESHOLDS, TRUST_SCORE_LABELS } from "./types";

const SCORE_KEYS = [1, 2, 3, 4, 5] as const;

/**
 * Computes trust score from raw rating scores (1-5).
 * Pure function, no side effects, easy to test.
 * Review bombing protection: returns evaluation with autoSuspendTriggered = false.
 */
export function computeTrustScoreFromScores(
  scores: readonly number[],
): TrustScoreEvaluation {
  const scoreCounts: Record<1 | 2 | 3 | 4 | 5, number> = {
    1: 0,
    2: 0,
    3: 0,
    4: 0,
    5: 0,
  };

  const validScores: number[] = [];
  for (const score of scores) {
    if (Number.isInteger(score) && score >= 1 && score <= 5) {
      scoreCounts[score as 1 | 2 | 3 | 4 | 5] += 1;
      validScores.push(score);
    }
  }

  const totalRatings = validScores.length;
  const sum = validScores.reduce((acc, s) => acc + s, 0);
  const trustScore = totalRatings === 0 ? 0 : Math.round((sum / totalRatings) * 100) / 100;

  const oneStarCount = scoreCounts[1];
  const hasOneStarRatings = oneStarCount > 0;

  // PRD 2.1.6: Review bombing protection - trust score NEVER triggers auto-suspend
  // Auto-suspend (Hit and Run) applies ONLY to UMKM, not Suppliers
  const autoSuspendTriggered = false;

  const breakdown: SupplierTrustBreakdown = {
    trustScore,
    totalRatings,
    scoreCounts,
  };

  return {
    breakdown,
    hasOneStarRatings,
    oneStarCount,
    autoSuspendTriggered,
  };
}

/**
 * Gets human-readable label for trust score.
 * 0 = "Belum Dinilai" (no ratings yet).
 */
export function getTrustScoreLabel(score: TrustScore): string {
  if (score === 0) return TRUST_SCORE_LABELS.noRatings;
  if (score >= TRUST_SCORE_THRESHOLDS.excellentThreshold) return TRUST_SCORE_LABELS.excellent;
  if (score >= TRUST_SCORE_THRESHOLDS.goodThreshold) return TRUST_SCORE_LABELS.good;
  if (score >= TRUST_SCORE_THRESHOLDS.poorThreshold) return TRUST_SCORE_LABELS.average;
  return TRUST_SCORE_LABELS.poor;
}

/**
 * Formats trust score for display (1 decimal place).
 * Returns "—" for no ratings.
 */
export function formatTrustScore(score: TrustScore): string {
  if (score === 0) return "—";
  return score.toFixed(1);
}

/**
 * Checks if supplier should be flagged for manual admin review.
 * Informational only - does NOT trigger any automated action.
 */
export function shouldFlagForAdminReview(evaluation: TrustScoreEvaluation): boolean {
  return (
    evaluation.breakdown.totalRatings >= 5 &&
    evaluation.breakdown.trustScore < TRUST_SCORE_THRESHOLDS.reviewThreshold
  );
}

/**
 * Builds rating bar distribution for UI (percentage per star).
 */
export function buildTrustScoreBars(
  breakdown: SupplierTrustBreakdown,
): Array<{ score: 1 | 2 | 3 | 4 | 5; count: number; pct: number }> {
  return SCORE_KEYS.map((score) => {
    const count = breakdown.scoreCounts[score];
    const pct = breakdown.totalRatings <= 0 ? 0 : (count / breakdown.totalRatings) * 100;
    return { score, count, pct };
  });
}

/**
 * Validates that a score is within 1-5 range.
 * Throws if invalid - used at trust boundary (API input).
 */
export function validateTrustScoreInput(score: number): asserts score is 1 | 2 | 3 | 4 | 5 {
  if (!Number.isInteger(score) || score < 1 || score > 5) {
    throw new Error(`Invalid trust score input: ${score}. Must be integer 1-5.`);
  }
}

/**
 * Ponytail: simple in-memory calculation, no DB.
 * Upgrade path: if volume grows, move aggregation to SQL function
 * (compute_supplier_trust_score) and call via Supabase RPC.
 */
export function computeTrustScore(
  scores: readonly number[],
): TrustScoreEvaluation {
  return computeTrustScoreFromScores(scores);
}