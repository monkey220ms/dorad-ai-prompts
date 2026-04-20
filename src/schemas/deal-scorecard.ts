/**
 * Stage-12 Deal Scorecard schema.
 *
 * Synthesizes prior-stage outputs into a single, user-facing scorecard:
 *   - overall grade A+ / A / B / C / D / F
 *   - overall_score 0-100
 *   - 5 dimension scores (each 0-100 with rationale + top drivers)
 *   - 3 strengths + 3 concerns + 1 decision_call
 *   - confidence gauge + coverage_gaps (stages with thin inputs)
 *
 * Designed to power a dashboard "deal tile" that compresses every
 * heavy upstream stage into one glance.
 */

export const SCORECARD_GRADES = [
  "A+",
  "A",
  "B",
  "C",
  "D",
  "F",
] as const;
export type ScorecardGrade = (typeof SCORECARD_GRADES)[number];

export const SCORECARD_DIMENSIONS = [
  "financial_quality",
  "valuation",
  "market_quality",
  "operational_quality",
  "deal_structure",
] as const;
export type ScorecardDimension = (typeof SCORECARD_DIMENSIONS)[number];

export const DECISION_CALLS = [
  "advance_to_loi",
  "deeper_diligence",
  "renegotiate_price",
  "pass",
  "monitor",
] as const;
export type DecisionCall = (typeof DECISION_CALLS)[number];

export interface DimensionScore {
  dimension: ScorecardDimension;
  score: number;            // 0-100
  grade: ScorecardGrade;
  rationale: string;        // ≤35 words
  top_drivers: string[];    // 1-3 short bullets ≤20 words each
  confidence: number;       // 0-1
}

export interface ScorecardCoverageGap {
  stage: string;            // e.g. "stage3_financial_parser"
  reason: string;           // ≤25 words
  impact_on_confidence: "low" | "medium" | "high";
}

export interface DealScorecardOutput {
  overall_score: number;    // 0-100
  overall_grade: ScorecardGrade;
  headline: string;         // ≤14 words, punchy one-liner
  decision_call: DecisionCall;
  decision_rationale: string; // ≤40 words

  dimension_scores: DimensionScore[];

  top_strengths: string[];  // exactly 3, ≤20 words each
  top_concerns: string[];   // exactly 3, ≤20 words each

  confidence_overall: number; // 0-1
  coverage_gaps: ScorecardCoverageGap[];

  // Useful when building tiles/tables: a stable numeric fingerprint
  // for sort/filter. Higher = better deal.
  sort_key: number;
}

export function assertDealScorecard(
  obj: unknown,
): asserts obj is DealScorecardOutput {
  const o = obj as Record<string, unknown>;
  if (!o) throw new Error("empty response");

  if (typeof o.overall_score !== "number" || o.overall_score < 0 || o.overall_score > 100) {
    throw new Error("overall_score must be 0-100");
  }
  if (!SCORECARD_GRADES.includes(o.overall_grade as ScorecardGrade)) {
    throw new Error(`overall_grade must be one of ${SCORECARD_GRADES.join(", ")}`);
  }
  if (typeof o.headline !== "string" || o.headline.length === 0) {
    throw new Error("headline required");
  }
  if (!DECISION_CALLS.includes(o.decision_call as DecisionCall)) {
    throw new Error(`decision_call must be one of ${DECISION_CALLS.join(", ")}`);
  }
  if (typeof o.decision_rationale !== "string") {
    throw new Error("decision_rationale required");
  }

  if (!Array.isArray(o.dimension_scores)) {
    throw new Error("dimension_scores must be array");
  }
  const seen = new Set<string>();
  for (const [i, d0] of (o.dimension_scores as Array<Record<string, unknown>>).entries()) {
    if (!SCORECARD_DIMENSIONS.includes(d0.dimension as ScorecardDimension)) {
      throw new Error(`dimension_scores[${i}].dimension invalid`);
    }
    if (seen.has(d0.dimension as string)) {
      throw new Error(`dimension_scores[${i}].dimension duplicated`);
    }
    seen.add(d0.dimension as string);
    if (typeof d0.score !== "number" || d0.score < 0 || d0.score > 100) {
      throw new Error(`dimension_scores[${i}].score must be 0-100`);
    }
    if (!SCORECARD_GRADES.includes(d0.grade as ScorecardGrade)) {
      throw new Error(`dimension_scores[${i}].grade invalid`);
    }
    if (typeof d0.rationale !== "string") {
      throw new Error(`dimension_scores[${i}].rationale required`);
    }
    if (!Array.isArray(d0.top_drivers)) {
      throw new Error(`dimension_scores[${i}].top_drivers must be array`);
    }
    if (typeof d0.confidence !== "number" || d0.confidence < 0 || d0.confidence > 1) {
      throw new Error(`dimension_scores[${i}].confidence must be 0..1`);
    }
  }
  if (seen.size !== SCORECARD_DIMENSIONS.length) {
    throw new Error(`dimension_scores must cover all ${SCORECARD_DIMENSIONS.length} dimensions`);
  }

  if (!Array.isArray(o.top_strengths) || (o.top_strengths as unknown[]).length !== 3) {
    throw new Error("top_strengths must be array of exactly 3");
  }
  if (!Array.isArray(o.top_concerns) || (o.top_concerns as unknown[]).length !== 3) {
    throw new Error("top_concerns must be array of exactly 3");
  }

  if (typeof o.confidence_overall !== "number" || o.confidence_overall < 0 || o.confidence_overall > 1) {
    throw new Error("confidence_overall must be 0..1");
  }
  if (!Array.isArray(o.coverage_gaps)) {
    throw new Error("coverage_gaps must be array");
  }
  if (typeof o.sort_key !== "number") {
    throw new Error("sort_key must be number");
  }
}

/**
 * Convert a 0-100 score to a letter grade using the canonical Dorad
 * scale. Kept as a pure function so UI + test code can reuse it.
 */
export function scoreToGrade(score: number): ScorecardGrade {
  if (score >= 95) return "A+";
  if (score >= 87) return "A";
  if (score >= 75) return "B";
  if (score >= 60) return "C";
  if (score >= 45) return "D";
  return "F";
}
