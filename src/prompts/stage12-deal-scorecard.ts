/**
 * Stage-12 Deal Scorecard.
 *
 * Given outputs from prior stages (initial screen, CIM extraction,
 * financial parser, comps, QofE, model) produce a compact scorecard
 * for the dashboard tile.
 *
 * Uses Sonnet — cheap enough for every-update recompute, smart
 * enough to reason about cross-stage tradeoffs.
 */

import {
  assertDealScorecard,
  type DealScorecardOutput,
} from "../schemas/deal-scorecard.ts";
import { createClient } from "../client.ts";

const SYSTEM = `You are a senior SMB acquisitions analyst synthesizing upstream analyses into a single deal Scorecard.

Inputs provided (some may be null/empty if that stage has not run):
- initial_screen:     Stage-1 output
- cim_extraction:     Stage-2 output
- financial_parser:   Stage-3 output
- comps:              Stage-4 output (market comps + multiples)
- qofe:               Stage-7 output (quality of earnings)
- model:              Stage-8 output (financial model projections)
- deal_context:       user's buy-box + financing plan + stage_coverage

Your job: compress everything above into a grade-style Scorecard that a busy acquirer can read in 10 seconds.

Scoring scale (every dimension AND the overall):
  95-100 A+   Outstanding — rare
  87-94  A    Strong candidate
  75-86  B    Solid but needs diligence
  60-74  C    Mediocre — heavy concessions required
  45-59  D    Likely pass, salvageable only with deep renegotiation
  0-44   F    Pass / walk away

Dimensions (score each 0-100 and explain):
  1. financial_quality
     Clean books, revenue stability, margin durability, working-capital swings, customer concentration, add-back quality per QofE.
  2. valuation
     Asking price vs comps, implied multiples vs sector median, price-to-SDE, price-to-EBITDA, seller-financing discount.
  3. market_quality
     Industry growth, fragmentation, cyclicality, competitive moat, geographic desirability.
  4. operational_quality
     Process maturity, team depth, key-person risk, system dependence, transition friction.
  5. deal_structure
     Seller-financing %, earnout terms, reps & warranties feasibility, working-capital peg, transition support, training window, non-compete, lease assignability.

Rules:
- NEVER invent numbers. If an input field is null/absent, lower that dimension's confidence accordingly and note the gap in coverage_gaps.
- top_strengths (3) and top_concerns (3) must each be short, independent, and non-overlapping. Phrase as a seller would read them.
- decision_call must align with overall_grade:
    A+/A  → "advance_to_loi" OR "deeper_diligence" if coverage is thin
    B     → "deeper_diligence"
    C     → "renegotiate_price"
    D     → "renegotiate_price" OR "monitor"
    F     → "pass"
- sort_key = overall_score * confidence_overall * 100, rounded to 2 decimals.
- headline is punchy (≤14 words), e.g. "Clean SaaS with key-person risk priced ~15% over market".
- decision_rationale explains the call in ≤40 words, referencing which dimensions most drove it.
- If ≥3 dimensions have confidence < 0.4, force decision_call="deeper_diligence" regardless of score.
- Grades map from scores via the scale above. Do not override.

Output MUST be a single JSON object only. No prose before/after.`;

export interface DealScorecardInput {
  initialScreen: unknown | null;
  cimExtraction: unknown | null;
  financialParser: unknown | null;
  comps: unknown | null;
  qofe: unknown | null;
  model: unknown | null;
  dealContext: {
    user_buy_box?: unknown;
    financing_plan?: unknown;
    stage_coverage: {
      stage1: boolean;
      stage2: boolean;
      stage3: boolean;
      stage4: boolean;
      stage7: boolean;
      stage8: boolean;
    };
  };
}

export async function runDealScorecard(
  input: DealScorecardInput,
  apiKey?: string,
): Promise<{
  output: DealScorecardOutput;
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

<deal_context>
${JSON.stringify(input.dealContext, null, 2)}
</deal_context>`;

  const res = await client.call<DealScorecardOutput>({
    model: "sonnet",
    system: SYSTEM,
    user,
    maxTokens: 3000,
    temperature: 0.15,
    jsonMode: true,
    validator: assertDealScorecard,
  });
  return {
    output: res.content,
    cost_usd: res.cost_usd,
    retries: res.retries,
    model_used: res.model_used,
    prompt_version: "stage12-deal-scorecard.v1",
  };
}
