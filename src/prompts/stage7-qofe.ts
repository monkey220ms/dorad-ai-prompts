/**
 * Stage-7 Quality of Earnings (QofE) Adjustments.
 *
 * Turns the messy mix of broker-claimed SDE, P&L line items, and the user's
 * judgment into a defensible adjusted-SDE number. Highest-stakes prompt —
 * EVERY adjustment comes with a recommendation but always flags user review.
 */

import { assertQofe, type QofeOutput } from "../schemas/qofe.ts";
import type { FinancialParserOutput } from "../schemas/financial-parser.ts";
import { createClient } from "../client.ts";

const SYSTEM = `You are computing Quality of Earnings (QofE) adjustments for an SMB acquisition.

Input:
- normalized_pnl_by_period: parsed P&L output from Stage 3 (array of FinancialPeriod objects — see canonical line names)
- broker_claimed_sde: the SDE figure disclosed in the CIM/listing with broker's add-back list
- user_financing_plan: "sba_7a" | "cash" | "other" — affects interest add-back decision
- post_close_owner_role: "owner_operator_ft" | "owner_operator_pt" | "absentee_with_gm" | "semi_absentee"

For each period (and across 3-year TTM composite), produce:
{
  "period": "FY2024",
  "reported_net_income": 0,
  "reported_ebitda":     0,
  "reported_sde":        0,
  "adjustments": [
    {
      "line_item": "officer_comp",
      "amount_add_back": 120000,
      "category": "owner_compensation"|"non_cash"|"interest"|"one_time"|"discretionary"|"normalization",
      "rationale": "≤30 words",
      "confidence": 0.0-1.0,
      "source_line_ref": "P&L Line 14: Officer Compensation $120,000",
      "user_decision_required": true|false,
      "our_recommendation": "accept"|"accept_partial"|"reject"|"need_more_info",
      "recommended_partial_amount": null | number,
      "reasoning_for_recommendation": "..."
    }
  ],
  "adjusted_sde":            0,
  "adjusted_ebitda":         0,
  "adjusted_sde_margin_pct": 0.0,
  "year_over_year_trend":    "growing"|"flat"|"declining"|"volatile",
  "composite_ttm_adjusted_sde": 0,
  "quality_score":           0-100,
  "quality_score_rationale": "≤60 words; reasons score isn't 100"
}

Full output schema:
{
  "periods": [ ... per-period objects above ... ],
  "composite_ttm_adjusted_sde": 0,
  "overall_quality_score":      0-100,
  "overall_notes":              "≤120 words"
}

QofE category guidance (apply consistently):

owner_compensation:
  - If owner pays self $250K and market rate for that role is $85K → add back $165K.
  - If owner takes no salary but distributions → apportion distributions into "reasonable" vs "excess".
  - Post-close owner role matters: if buyer will be ABSENTEE, DO NOT add back full owner comp — subtract cost of replacement GM (or at minimum set user_decision_required=true with a recommended_partial_amount and explain in reasoning).

non_cash:
  - Add back: Depreciation, Amortization, Impairment.
  - Do NOT add back: true reinvestment capex required to maintain the business. Flag for user decision via user_decision_required=true.

interest:
  - If re-leveraging deal (SBA): add back seller's existing interest expense. If cash deal with no debt, still add back because we will model debt separately in Deal Structure layer.

one_time:
  - Legal settlements, large insurance claims, pandemic relief (PPP/ERC), one-off equipment purchases expensed.
  - REQUIRE source_line_ref. Users will scrutinize.

discretionary:
  - Personal vehicles, owner's country club dues, owner's health insurance (partially), owner's cell phone.
  - Be skeptical — these are often over-claimed by brokers. DEFAULT recommendation = "accept_partial" for meals / travel / vehicle.

normalization:
  - Under-market rent to seller's own real estate → REDUCE SDE (add the full-market rent gap as a negative add-back) to reflect the fair-market lease the buyer will sign.
  - Seller family members on payroll at above-market rates who won't stay → add back excess.

Rules:
- For ANY adjustment >15% of claimed SDE, set user_decision_required=true.
- Confidence scoring:
    0.9+ : line item clearly documented and normalization is conventional (e.g. D&A add-back).
    0.7  : documented but requires judgment (e.g. partial personal meals).
    0.5  : claimed without documentation — recommend verification.
    <0.3 : broker claim we cannot substantiate — recommendation="need_more_info".

Output JSON only.`;

export interface QofeInput {
  normalizedPnlByPeriod: FinancialParserOutput["periods"];
  brokerClaimedSde: number | null;
  brokerAddbacks?: Array<{ label: string; amount: number; category?: string }>;
  userFinancingPlan: "sba_7a" | "cash" | "other";
  postCloseOwnerRole:
    | "owner_operator_ft"
    | "owner_operator_pt"
    | "absentee_with_gm"
    | "semi_absentee";
  marketRateOwnerCompAnnual?: number | null;
}

export async function computeQofe(
  input: QofeInput,
  apiKey?: string,
): Promise<{
  output: QofeOutput;
  cost_usd: number;
  retries: number;
  model_used: string;
  prompt_version: string;
}> {
  const client = createClient({ apiKey });
  const user = `<normalized_pnl_by_period>
${JSON.stringify(input.normalizedPnlByPeriod, null, 2)}
</normalized_pnl_by_period>

<broker_claimed_sde>${input.brokerClaimedSde ?? "null"}</broker_claimed_sde>
<broker_addbacks>
${JSON.stringify(input.brokerAddbacks ?? [], null, 2)}
</broker_addbacks>

<user_financing_plan>${input.userFinancingPlan}</user_financing_plan>
<post_close_owner_role>${input.postCloseOwnerRole}</post_close_owner_role>
<market_rate_owner_comp_annual>${input.marketRateOwnerCompAnnual ?? "null"}</market_rate_owner_comp_annual>`;
  const res = await client.call<QofeOutput>({
    model: "opus",
    system: SYSTEM,
    user,
    maxTokens: 6000,
    temperature: 0.2,
    jsonMode: true,
    validator: assertQofe,
  });
  return {
    output: res.content,
    cost_usd: res.cost_usd,
    retries: res.retries,
    model_used: res.model_used,
    prompt_version: STAGE_7_PROMPT_VERSION,
  };
}

export const STAGE_7_PROMPT_VERSION = "stage7.v1.0";
