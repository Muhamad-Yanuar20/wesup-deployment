import { describe, expect, it } from "vitest";
import {
  computeTrustScore,
  computeTrustScoreFromScores,
  getTrustScoreLabel,
  formatTrustScore,
  shouldFlagForAdminReview,
  buildTrustScoreBars,
  validateTrustScoreInput,
  TRUST_SCORE_THRESHOLDS,
} from "@/lib/supplier-trust-score";

describe("supplier-trust-score (PRD 2.1.6)", () => {
  describe("computeTrustScoreFromScores", () => {
    it("returns zeroed evaluation for empty ratings", () => {
      const evalResult = computeTrustScoreFromScores([]);
      expect(evalResult.breakdown.trustScore).toBe(0);
      expect(evalResult.breakdown.totalRatings).toBe(0);
      expect(evalResult.breakdown.scoreCounts[1]).toBe(0);
      expect(evalResult.breakdown.scoreCounts[5]).toBe(0);
      expect(evalResult.autoSuspendTriggered).toBe(false);
      expect(evalResult.hasOneStarRatings).toBe(false);
      expect(evalResult.oneStarCount).toBe(0);
    });

    it("computes correct average for mixed ratings", () => {
      // 5, 5, 4, 3, 1 = 18/5 = 3.6
      const evalResult = computeTrustScoreFromScores([5, 5, 4, 3, 1]);
      expect(evalResult.breakdown.trustScore).toBe(3.6);
      expect(evalResult.breakdown.totalRatings).toBe(5);
      expect(evalResult.breakdown.scoreCounts[5]).toBe(2);
      expect(evalResult.breakdown.scoreCounts[4]).toBe(1);
      expect(evalResult.breakdown.scoreCounts[3]).toBe(1);
      expect(evalResult.breakdown.scoreCounts[1]).toBe(1);
    });

    it("handles all 5-star ratings", () => {
      const evalResult = computeTrustScoreFromScores([5, 5, 5, 5]);
      expect(evalResult.breakdown.trustScore).toBe(5.0);
      expect(evalResult.breakdown.totalRatings).toBe(4);
      expect(evalResult.oneStarCount).toBe(0);
    });

    it("handles all 1-star ratings (review bombing scenario)", () => {
      const evalResult = computeTrustScoreFromScores([1, 1, 1, 1, 1]);
      expect(evalResult.breakdown.trustScore).toBe(1.0);
      expect(evalResult.breakdown.totalRatings).toBe(5);
      expect(evalResult.oneStarCount).toBe(5);
      expect(evalResult.hasOneStarRatings).toBe(true);
      // Review bombing protection: auto-suspend NEVER triggered for suppliers
      expect(evalResult.autoSuspendTriggered).toBe(false);
    });

    it("rounds to two decimal places", () => {
      // 4 + 3 + 5 = 12/3 = 4.0
      const evalResult = computeTrustScoreFromScores([4, 3, 5]);
      expect(evalResult.breakdown.trustScore).toBe(4.0);

      // 4 + 4 + 3 = 11/3 = 3.666... -> 3.67
      const evalResult2 = computeTrustScoreFromScores([4, 4, 3]);
      expect(evalResult2.breakdown.trustScore).toBe(3.67);
    });

    it("ignores invalid scores outside 1-5 range", () => {
      // 0 and 6 should be ignored
      const evalResult = computeTrustScoreFromScores([5, 0, 4, 6, 3]);
      expect(evalResult.breakdown.totalRatings).toBe(3); // only 5, 4, 3 counted
      expect(evalResult.breakdown.trustScore).toBe(4.0);
    });
  });

  describe("getTrustScoreLabel", () => {
    it("returns 'Belum Dinilai' for score 0", () => {
      expect(getTrustScoreLabel(0)).toBe("Belum Dinilai");
    });

    it("returns 'Sangat Baik' for score >= 4.5", () => {
      expect(getTrustScoreLabel(4.5)).toBe("Sangat Baik");
      expect(getTrustScoreLabel(5.0)).toBe("Sangat Baik");
    });

    it("returns 'Baik' for score >= 4.0", () => {
      expect(getTrustScoreLabel(4.0)).toBe("Baik");
      expect(getTrustScoreLabel(4.4)).toBe("Baik");
    });

    it("returns 'Cukup' for score >= 3.0", () => {
      expect(getTrustScoreLabel(3.0)).toBe("Cukup");
      expect(getTrustScoreLabel(3.9)).toBe("Cukup");
    });

    it("returns 'Perlu Perhatian' for score < 3.0", () => {
      expect(getTrustScoreLabel(2.9)).toBe("Perlu Perhatian");
      expect(getTrustScoreLabel(1.0)).toBe("Perlu Perhatian");
    });
  });

  describe("formatTrustScore", () => {
    it("returns em dash for score 0", () => {
      expect(formatTrustScore(0)).toBe("—");
    });

    it("formats to one decimal place", () => {
      expect(formatTrustScore(4.0)).toBe("4.0");
      expect(formatTrustScore(3.67)).toBe("3.7");
      expect(formatTrustScore(4.5)).toBe("4.5");
    });
  });

  describe("shouldFlagForAdminReview", () => {
    it("returns false for suppliers with few ratings (< 5)", () => {
      const evalResult = computeTrustScoreFromScores([1, 1]); // 2 ratings, score 1.0
      expect(shouldFlagForAdminReview(evalResult)).toBe(false);
    });

    it("returns false for score above review threshold", () => {
      const evalResult = computeTrustScoreFromScores([3, 3, 3, 3, 3]); // 5 ratings, score 3.0
      expect(shouldFlagForAdminReview(evalResult)).toBe(false);
    });

    it("returns true for 5+ ratings below review threshold (2.5)", () => {
      // 5 ratings of 2 stars = 2.0 (< 2.5 threshold)
      const evalResult = computeTrustScoreFromScores([2, 2, 2, 2, 2]);
      expect(shouldFlagForAdminReview(evalResult)).toBe(true);
    });

    it("returns true for many 1-star ratings (review bombing signal)", () => {
      const evalResult = computeTrustScoreFromScores([1, 1, 1, 1, 1]); // 5 ratings, score 1.0
      expect(shouldFlagForAdminReview(evalResult)).toBe(true);
      // But auto-suspend still NOT triggered
      expect(evalResult.autoSuspendTriggered).toBe(false);
    });
  });

  describe("buildTrustScoreBars", () => {
    it("builds correct distribution bars", () => {
      const breakdown = {
        trustScore: 3.6,
        totalRatings: 5,
        scoreCounts: { 1: 1, 2: 0, 3: 1, 4: 1, 5: 2 },
      };
      const bars = buildTrustScoreBars(breakdown);
      expect(bars).toHaveLength(5);
      expect(bars[0]).toEqual({ score: 1, count: 1, pct: 20 });
      expect(bars[4]).toEqual({ score: 5, count: 2, pct: 40 });
    });

    it("handles zero ratings", () => {
      const breakdown = {
        trustScore: 0,
        totalRatings: 0,
        scoreCounts: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 },
      };
      const bars = buildTrustScoreBars(breakdown);
      expect(bars.every((b) => b.pct === 0)).toBe(true);
    });
  });

  describe("validateTrustScoreInput", () => {
    it("passes for valid scores 1-5", () => {
      expect(() => validateTrustScoreInput(1)).not.toThrow();
      expect(() => validateTrustScoreInput(3)).not.toThrow();
      expect(() => validateTrustScoreInput(5)).not.toThrow();
    });

    it("throws for score 0", () => {
      expect(() => validateTrustScoreInput(0)).toThrow("Invalid trust score input: 0");
    });

    it("throws for score 6", () => {
      expect(() => validateTrustScoreInput(6)).toThrow("Invalid trust score input: 6");
    });

    it("throws for non-integer", () => {
      expect(() => validateTrustScoreInput(3.5)).toThrow("Invalid trust score input: 3.5");
    });

    it("throws for negative", () => {
      expect(() => validateTrustScoreInput(-1)).toThrow("Invalid trust score input: -1");
    });
  });

  describe("computeTrustScore (export wrapper)", () => {
    it("delegates to computeTrustScoreFromScores", () => {
      const evalResult = computeTrustScore([5, 4, 3]);
      expect(evalResult.breakdown.trustScore).toBe(4.0);
    });
  });

  describe("TRUST_SCORE_THRESHOLDS constants", () => {
    it("has expected threshold values", () => {
      expect(TRUST_SCORE_THRESHOLDS.reviewThreshold).toBe(2.5);
      expect(TRUST_SCORE_THRESHOLDS.poorThreshold).toBe(3.0);
      expect(TRUST_SCORE_THRESHOLDS.goodThreshold).toBe(4.0);
      expect(TRUST_SCORE_THRESHOLDS.excellentThreshold).toBe(4.5);
    });
  });
});