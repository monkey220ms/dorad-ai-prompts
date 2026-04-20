/**
 * Stage-15 Valuation Range schema.
 *
 * Produces a defensible "what should we pay?" opinion by running four
 * independent valuation methods and triangulating them into a single
 * probabilistic range:
 *
 *   1. SDE-multiple method   — SDE × industry-adjusted multiple
 *   2. EBITDA-multiple method — EBITDA × industry-adjusted multiple
 *   3. Discounted cash flow   — 5-year FCF + terminal, WACC-discounted
 *   4. Asset-based (floor)    — tangible net assets + inventory + goodwill_est
 *
 * The triangulated output is a weighted distribution with
 *   p10 / p25 / p50 / p75 / p90 dollar amounts.
 *
 * Weights are method-specific and adjusted for:
 *   - input data confidence (low QofE confidence → lower DCF weight)
 *   - industry norm (asset-heavy businesses → higher asset weight)
 *   - deal stage (pre-LOI = wider range; post-QofE = tighter)
 *
 * The output ends with an asking-price comparison:
 *   "Ask is $X. Our triangulated fair range is $Y–$Z. Ask is N% above/
 *    below midpoint."
 */

export const VALUATION_METHODS = [
  "sde_multiple",
  "ebitda_multiple",
  "dcf",
  "asset_based",
] as const;
export type ValuationMethod = (typeof VALUATION_METHODS)[number];

export const VALUATION_VERDICTS = [
  "significantly_overpriced", // >20% above midpoint
  "overpriced",               // 8-20% above
  "fair",                     // ±8% of midpoint
  "underpriced",              // 8-20% below
  "significantly_underpriced",// >20% below
  "insufficient_data",
] as const;
export type ValuationVerdict = (typeof VALUATION_VERDICTS)[number];

export interface ValuationMethodResult {
  method: ValuationMethod;
  /** Point estimate in USD — null if method was not applicable. */
  point_estimate: number | null;
  /** P10–P90 range for this single method. */
  p10: number | null;
  p90: number | null;
  /** Key inputs + formulas this method used (for audit). */
  inputs: Record<string, number | string | null>;
  /** Weight in the triangulated output (0–1). Sum across all methods = 1. */
  weight: number;
  /** 0–1 data confidence for THIS method. */
  confidence: number;
  rationale: string;        // ≤35 words
  notes: string | null;     // caveats, assumptions, ≤60 words
  not_applicable_reason: string | null;
}

export interface TriangulatedRange {
  p10: number;
  p25: number;
  p50: number;
  p75: number;
  p90: number;
  midpoint: number;
  /** Standard deviation of the weighted point estimates. */
  std_dev: number;
  /** Narrow / medium / wide — reflects confidence in the range. */
  range_tightness: "narrow" | "medium" | "wide";
}

export interface AskVsRange {
  asking_price: number | null;
  midpoint: number;
  pct_above_midpoint: number;  // negative = below
  verdict: ValuationVerdict;
  /** Where ask falls in the range: below_p10, p10_p25, p25_p50, etc. */
  ask_percentile_bucket:
    | "below_p10"
    | "p10_p25"
    | "p25_p50"
    | "p50_p75"
    | "p75_p90"
    | "above_p90"
    | "unknown";
  /** ≤50 words, plain-English explanation + suggested counter-offer anchor. */
  negotiation_guidance: string;
  /** Dollar amount the buyer might reasonably anchor to. */
  suggested_counter_offer: number | null;
}

export interface ValuationRangeOutput {
  method_results: ValuationMethodResult[];
  triangulated_range: TriangulatedRange;
  ask_vs_range: AskVsRange;

  // Reference multiples used (for auditability).
  multiples_used: {
    sde_multiple_low: number;
    sde_multiple_mid: number;
    sde_multiple_high: number;
    ebitda_multiple_low: number;
    ebitda_multiple_mid: number;
    ebitda_multiple_high: number;
    source: string; // e.g. "industry_benchmarks.v1:naics_44-45"
  };

  // DCF assumptions used (for auditability).
  dcf_assumptions: {
    wacc: number;               // 0..1
    terminal_growth_rate: number; // 0..1
    projection_years: number;
    revenue_cagr: number;
    terminal_ebitda_multiple: number;
  };

  /** 3 strongest positive signals, ≤20 words each. */
  value_drivers: string[];
  /** 3 strongest negative signals, ≤20 words each. */
  value_detractors: string[];

  confidence_overall: number; // 0–1
  coverage_notes: string;     // ≤60 words — what we'd need to tighten the range
  prompt_version: string;     // echoed by caller
}

export function assertValuationRange(
  obj: unknown,
): asserts obj is ValuationRangeOutput {
  const o = obj as Record<string, unknown>;
  if (!o) throw new Error("empty response");

  if (!Array.isArray(o.method_results)) {
    throw new Error("method_results must be array");
  }
  const seen = new Set<string>();
  let weightSum = 0;
  for (const [i, mr0] of (o.method_results as Array<Record<string, unknown>>).entries()) {
    if (!VALUATION_METHODS.includes(mr0.method as ValuationMethod)) {
      throw new Error(`method_results[${i}].method invalid`);
    }
    if (seen.has(mr0.method as string)) {
      throw new Error(`method_results[${i}].method duplicated`);
    }
    seen.add(mr0.method as string);
    if (typeof mr0.weight !== "number" || mr0.weight < 0 || mr0.weight > 1) {
      throw new Error(`method_results[${i}].weight must be 0..1`);
    }
    weightSum += mr0.weight as number;
    if (typeof mr0.confidence !== "number" || mr0.confidence < 0 || mr0.confidence > 1) {
      throw new Error(`method_results[${i}].confidence must be 0..1`);
    }
    if (typeof mr0.rationale !== "string") {
      throw new Error(`method_results[${i}].rationale required`);
    }
  }
  if (Math.abs(weightSum - 1) > 0.02) {
    throw new Error(
      `method_results weights must sum to ~1 (got ${weightSum.toFixed(3)})`,
    );
  }

  const t = o.triangulated_range as Record<string, unknown> | undefined;
  if (!t) throw new Error("triangulated_range required");
  for (const k of ["p10", "p25", "p50", "p75", "p90", "midpoint", "std_dev"] as const) {
    if (typeof t[k] !== "number") throw new Error(`triangulated_range.${k} number`);
  }
  // Monotonicity check — percentile amounts must be ordered.
  if (
    !((t.p10 as number) <= (t.p25 as number) &&
      (t.p25 as number) <= (t.p50 as number) &&
      (t.p50 as number) <= (t.p75 as number) &&
      (t.p75 as number) <= (t.p90 as number))
  ) {
    throw new Error("triangulated_range percentiles must be monotonically non-decreasing");
  }
  if (!["narrow", "medium", "wide"].includes(t.range_tightness as string)) {
    throw new Error("range_tightness must be narrow|medium|wide");
  }

  const a = o.ask_vs_range as Record<string, unknown> | undefined;
  if (!a) throw new Error("ask_vs_range required");
  if (!VALUATION_VERDICTS.includes(a.verdict as ValuationVerdict)) {
    throw new Error("ask_vs_range.verdict invalid");
  }
  if (typeof a.pct_above_midpoint !== "number") {
    throw new Error("ask_vs_range.pct_above_midpoint number");
  }
  if (typeof a.negotiation_guidance !== "string") {
    throw new Error("ask_vs_range.negotiation_guidance required");
  }

  const m = o.multiples_used as Record<string, unknown> | undefined;
  if (!m) throw new Error("multiples_used required");
  for (const k of [
    "sde_multiple_low",
    "sde_multiple_mid",
    "sde_multiple_high",
    "ebitda_multiple_low",
    "ebitda_multiple_mid",
    "ebitda_multiple_high",
  ] as const) {
    if (typeof m[k] !== "number") throw new Error(`multiples_used.${k} number`);
  }

  const d = o.dcf_assumptions as Record<string, unknown> | undefined;
  if (!d) throw new Error("dcf_assumptions required");
  for (const k of [
    "wacc",
    "terminal_growth_rate",
    "projection_years",
    "revenue_cagr",
    "terminal_ebitda_multiple",
  ] as const) {
    if (typeof d[k] !== "number") throw new Error(`dcf_assumptions.${k} number`);
  }

  if (!Array.isArray(o.value_drivers) || (o.value_drivers as unknown[]).length > 5) {
    throw new Error("value_drivers array ≤5");
  }
  if (!Array.isArray(o.value_detractors) || (o.value_detractors as unknown[]).length > 5) {
    throw new Error("value_detractors array ≤5");
  }
  if (typeof o.confidence_overall !== "number" ||
      (o.confidence_overall as number) < 0 ||
      (o.confidence_overall as number) > 1) {
    throw new Error("confidence_overall 0..1");
  }
  if (typeof o.coverage_notes !== "string") {
    throw new Error("coverage_notes required");
  }
}

/**
 * Pure helper shared with the React component: map (ask, midpoint) → verdict.
 * Kept here so the UI can recompute verdict locally when the user edits ask.
 */
export function computeVerdict(
  askingPrice: number | null,
  midpoint: number,
): { pct: number; verdict: ValuationVerdict } {
  if (askingPrice === null || askingPrice <= 0 || midpoint <= 0) {
    return { pct: 0, verdict: "insufficient_data" };
  }
  const pct = (askingPrice - midpoint) / midpoint;
  if (pct > 0.20) return { pct, verdict: "significantly_overpriced" };
  if (pct > 0.08) return { pct, verdict: "overpriced" };
  if (pct >= -0.08) return { pct, verdict: "fair" };
  if (pct >= -0.20) return { pct, verdict: "underpriced" };
  return { pct, verdict: "significantly_underpriced" };
}

/** Same idea for the percentile bucket. */
export function askPercentileBucket(
  ask: number | null,
  r: Pick<TriangulatedRange, "p10" | "p25" | "p50" | "p75" | "p90">,
): AskVsRange["ask_percentile_bucket"] {
  if (ask === null || ask <= 0) return "unknown";
  if (ask < r.p10) return "below_p10";
  if (ask < r.p25) return "p10_p25";
  if (ask < r.p50) return "p25_p50";
  if (ask < r.p75) return "p50_p75";
  if (ask < r.p90) return "p75_p90";
  return "above_p90";
}
