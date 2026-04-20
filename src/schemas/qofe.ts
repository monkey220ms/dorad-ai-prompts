/**
 * Stage-7 Quality of Earnings (QofE) schema.
 */

export const QOFE_CATEGORIES = [
  "owner_compensation",
  "non_cash",
  "interest",
  "one_time",
  "discretionary",
  "normalization",
] as const;
export type QofeCategory = (typeof QOFE_CATEGORIES)[number];

export const QOFE_RECOMMENDATIONS = [
  "accept",
  "accept_partial",
  "reject",
  "need_more_info",
] as const;
export type QofeRecommendation = (typeof QOFE_RECOMMENDATIONS)[number];

export interface QofeAdjustment {
  line_item: string;
  amount_add_back: number;
  category: QofeCategory;
  rationale: string;
  confidence: number;
  source_line_ref: string;
  user_decision_required: boolean;
  our_recommendation: QofeRecommendation;
  recommended_partial_amount: number | null;
  reasoning_for_recommendation: string;
}

export interface QofePeriodOutput {
  period: string;
  reported_net_income: number;
  reported_ebitda: number;
  reported_sde: number;
  adjustments: QofeAdjustment[];
  adjusted_sde: number;
  adjusted_ebitda: number;
  adjusted_sde_margin_pct: number;
  year_over_year_trend: "growing" | "flat" | "declining" | "volatile";
  composite_ttm_adjusted_sde: number;
  quality_score: number; // 0-100
  quality_score_rationale: string;
}

export interface QofeOutput {
  periods: QofePeriodOutput[];
  composite_ttm_adjusted_sde: number;
  overall_quality_score: number;
  overall_notes: string;
}

export function assertQofe(obj: unknown): asserts obj is QofeOutput {
  const o = obj as Record<string, unknown>;
  if (!o) throw new Error("empty response");
  if (!Array.isArray(o.periods) || o.periods.length === 0) {
    throw new Error("periods must be non-empty array");
  }
  for (const [i, p0] of (o.periods as Array<Record<string, unknown>>).entries()) {
    if (typeof p0.period !== "string") throw new Error(`periods[${i}].period required`);
    if (typeof p0.adjusted_sde !== "number") {
      throw new Error(`periods[${i}].adjusted_sde must be number`);
    }
    if (!Array.isArray(p0.adjustments)) {
      throw new Error(`periods[${i}].adjustments must be array`);
    }
    for (const [j, a0] of (p0.adjustments as Array<Record<string, unknown>>).entries()) {
      if (typeof a0.line_item !== "string") {
        throw new Error(`periods[${i}].adjustments[${j}].line_item required`);
      }
      if (typeof a0.amount_add_back !== "number") {
        throw new Error(`periods[${i}].adjustments[${j}].amount_add_back must be number`);
      }
      if (!QOFE_CATEGORIES.includes(a0.category as QofeCategory)) {
        throw new Error(`periods[${i}].adjustments[${j}].category invalid`);
      }
      if (!QOFE_RECOMMENDATIONS.includes(a0.our_recommendation as QofeRecommendation)) {
        throw new Error(`periods[${i}].adjustments[${j}].our_recommendation invalid`);
      }
      if (typeof a0.confidence !== "number" || a0.confidence < 0 || a0.confidence > 1) {
        throw new Error(`periods[${i}].adjustments[${j}].confidence must be 0..1`);
      }
      if (typeof a0.user_decision_required !== "boolean") {
        throw new Error(`periods[${i}].adjustments[${j}].user_decision_required must be boolean`);
      }
    }
    if (
      typeof p0.quality_score !== "number" ||
      p0.quality_score < 0 ||
      p0.quality_score > 100
    ) {
      throw new Error(`periods[${i}].quality_score must be 0-100`);
    }
    if (!["growing", "flat", "declining", "volatile"].includes(p0.year_over_year_trend as string)) {
      throw new Error(`periods[${i}].year_over_year_trend invalid`);
    }
  }
  if (typeof o.composite_ttm_adjusted_sde !== "number") {
    throw new Error("composite_ttm_adjusted_sde must be number");
  }
  if (
    typeof o.overall_quality_score !== "number" ||
    o.overall_quality_score < 0 ||
    o.overall_quality_score > 100
  ) {
    throw new Error("overall_quality_score must be 0-100");
  }
  if (typeof o.overall_notes !== "string") {
    throw new Error("overall_notes required (use \"\" if none)");
  }
}
