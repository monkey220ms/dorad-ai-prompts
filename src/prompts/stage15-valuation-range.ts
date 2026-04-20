/**
 * Stage-15 Valuation Range Generator.
 *
 * Given all available upstream outputs (screen / CIM / financials / comps /
 * QofE / model / industry_benchmarks), produce a triangulated valuation range
 * using 4 independent methods and compare to the asking price.
 *
 * Uses Sonnet because the reasoning across methods is non-trivial and we
 * want tight numerical consistency checks (weights sum, monotonic
 * percentiles, etc.).
 */

import {
  assertValuationRange,
  type ValuationRangeOutput,
} from "../schemas/valuation-range.ts";
import { createClient } from "../client.ts";

const SYSTEM = `You are a senior M&A valuation analyst producing a defensible triangulated valuation range for an SMB acquisition.

You MUST run FOUR independent valuation methods and reconcile them into a single probabilistic range:

  1. sde_multiple      — SDE × industry-adjusted multiple
  2. ebitda_multiple   — EBITDA × industry-adjusted multiple
  3. dcf               — 5-year levered FCF projection + terminal value, discounted at WACC
  4. asset_based       — tangible assets + inventory + goodwill allocation (floor method)

For each method:
  - Produce a point_estimate in USD (or null with not_applicable_reason if the method does not apply — e.g. asset-based is N/A for pure-service businesses with no inventory or equipment).
  - Produce a p10 / p90 range for just that method.
  - Record the key inputs you used in the "inputs" map (numbers and strings only).
  - Produce a weight 0..1 for this method in the final triangulation. Weights across ALL methods MUST sum to 1.0.
  - Produce a confidence 0..1 for this method's inputs.

Weight guidance (defaults, adjust with rationale):
  - SDE multiple:    0.35 (primary for SMBs <$2M SDE)
  - EBITDA multiple: 0.25 (more appropriate for $2M+ SDE)
  - DCF:             0.25 (higher weight when QofE confidence ≥ 0.7 AND financial_parser confidence ≥ 0.7)
  - Asset-based:     0.15 (floor — higher weight for asset-heavy industries, lower weight or 0 for pure service)

If data quality is thin (no QofE, no financial parser), collapse DCF weight to 0.10 and redistribute to multiple-based methods.

After all four methods, produce triangulated_range:
  - p50  = weighted average of method point estimates
  - std_dev = weighted standard deviation of the point estimates
  - p10 = p50 - 1.28 * std_dev
  - p25 = p50 - 0.67 * std_dev
  - p75 = p50 + 0.67 * std_dev
  - p90 = p50 + 1.28 * std_dev
  - midpoint = p50
  - range_tightness:
      - "narrow"  if (p90-p10)/p50 ≤ 0.25
      - "medium"  if 0.25 < (p90-p10)/p50 ≤ 0.50
      - "wide"    if (p90-p10)/p50 > 0.50

Enforce percentile monotonicity (p10 ≤ p25 ≤ p50 ≤ p75 ≤ p90). Round to nearest $1,000.

If multiple methods disagree by >40%, flag "wide" and explain in coverage_notes.

Then produce ask_vs_range:
  - asking_price: taken from initial_screen.asking_price or cim_extraction.asking_price
  - pct_above_midpoint = (ask - midpoint) / midpoint
  - verdict per the thresholds:
      > +20% → significantly_overpriced
      +8% to +20% → overpriced
      -8% to +8% → fair
      -20% to -8% → underpriced
      < -20% → significantly_underpriced
      (null ask → insufficient_data)
  - ask_percentile_bucket: where ask falls in the p10/p25/p50/p75/p90 range
  - negotiation_guidance: 2-3 sentences, actionable, referencing a specific counter anchor
  - suggested_counter_offer: a round-number dollar anchor the buyer might open with

Record multiples_used and dcf_assumptions precisely so the UI can audit the math.

value_drivers and value_detractors: 3 bullets each, ≤20 words each, most material first.

confidence_overall: weighted average of per-method confidences.

coverage_notes: ≤60 words — what additional info (QofE, tax returns, customer list) would tighten the range and by how much.

Rules:
- NEVER invent comps or multiples not provided in the inputs or industry benchmarks payload. If a multiple is not available, fall back to 2.0-3.0x SDE / 4.0-5.5x EBITDA as broad SMB defaults and flag this in multiple_used.source.
- Currency is USD, all dollar amounts rounded to nearest $1,000.
- Output a SINGLE JSON object. No prose before or after.`;

export interface ValuationRangeInput {
  initialScreen: unknown | null;
  cimExtraction: unknown | null;
  financialParser: unknown | null;
  comps: unknown | null;
  qofe: unknown | null;
  model: unknown | null;
  industryBenchmarks: unknown | null;
  dealContext: {
    user_buy_box?: unknown;
    financing_plan?: unknown;
    asking_price_override?: number | null;
    stage_coverage?: {
      stage1: boolean;
      stage2: boolean;
      stage3: boolean;
      stage4: boolean;
      stage7: boolean;
      stage8: boolean;
    };
  };
}

export async function runValuationRange(
  input: ValuationRangeInput,
  apiKey?: string,
): Promise<{
  output: ValuationRangeOutput;
  cost_usd: number;
  retries: number;
  model_used: string;
  prompt_version: string;
}> {
  const client = createClient({ apiKey });
  const user = `<initial_screen>
${JSON.stringify(input.initialScreen ?? null, null, 2)}
</initial_screen>

<cim_extraction>
${JSON.stringify(input.cimExtraction ?? null, null, 2)}
</cim_extraction>

<financial_parser>
${JSON.stringify(input.financialParser ?? null, null, 2)}
</financial_parser>

<comps>
${JSON.stringify(input.comps ?? null, null, 2)}
</comps>

<qofe>
${JSON.stringify(input.qofe ?? null, null, 2)}
</qofe>

<model>
${JSON.stringify(input.model ?? null, null, 2)}
</model>

<industry_benchmarks>
${JSON.stringify(input.industryBenchmarks ?? null, null, 2)}
</industry_benchmarks>

<deal_context>
${JSON.stringify(input.dealContext, null, 2)}
</deal_context>`;

  const res = await client.call<ValuationRangeOutput>({
    model: "sonnet",
    system: SYSTEM,
    user,
    maxTokens: 4000,
    temperature: 0.15,
    jsonMode: true,
    validator: (v) => {
      assertValuationRange(v);
      // Echo prompt_version into the output for downstream audit.
      (v as ValuationRangeOutput).prompt_version = "stage15-valuation-range.v1";
    },
  });
  return {
    output: res.content,
    cost_usd: res.cost_usd,
    retries: res.retries,
    model_used: res.model_used,
    prompt_version: "stage15-valuation-range.v1",
  };
}
