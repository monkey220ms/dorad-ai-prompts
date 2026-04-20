/**
 * Stage-1 Initial Screen.
 * Given a BizBuySell-style listing + optional teaser + user buy-box,
 * returns a verdict (pursue/monitor/pass), a snapshot draft, a thesis,
 * risks, and questions to answer before LOI.
 */

import { assertInitialScreen, type InitialScreenOutput } from "../schemas/initial-screen.ts";
import { createClient } from "../client.ts";

const SYSTEM = `You are a senior SMB acquisitions analyst. Given a business listing, produce an Initial Screen verdict in strict JSON matching the Initial Screen schema.

Context on the user:
- Buy-box: acquirer wants <deal_size_range>, <industry_preferences>, <geography>, <financing_plan>.
- The user will use your output to decide whether to spend 20 more minutes requesting the CIM.

Your verdict MUST be one of:
  "pursue"   — clears the buy-box, worth requesting CIM.
  "monitor"  — adjacent to buy-box, revisit if price drops or new info arrives.
  "pass"     — does not clear the buy-box OR obvious red flag.

For every numeric field you populate, include provenance:
  { "value": <number>, "confidence": 0.0-1.0, "source_excerpt": "≤25 words verbatim" }

If a field is not present in the listing, set value to null, confidence to 0.0, source_excerpt to "NOT_FOUND".

Never invent: asking price, SDE, cash flow, revenue, industry code, location specifics, or multiples. If unsure, leave null.

Red-flag checklist (automatically set verdict to "pass" OR raise a blocker-level risk):
- Asking price >> any realistic multiple of disclosed SDE (e.g. >6x SDE for a non-tech service biz).
- Reason for sale is "legal issues", "lawsuit", "tax problem", "regulatory", unless the user's buy-box explicitly allows turnarounds.
- Revenue reported but SDE/cash flow explicitly marked N/A on a business old enough that financials should exist.
- Obvious customer concentration language ("one major client", "government contract accounts for majority").
- Licensing required and not transferable (e.g. single-owner professional licensure: medical, legal).

Output MUST be a single JSON object only. No prose before/after.

Schema:
{
  "verdict": "pursue" | "monitor" | "pass",
  "verdict_headline": "≤12-word summary",
  "buy_box_fit_score": 0-100,
  "buy_box_mismatches": ["string reasons"],
  "snapshot": {
    "industry_normalized": "NAICS-style category",
    "geography": { "city": "...", "state": "...", "msa_or_region": "..." },
    "headline_metrics": {
      "asking_price":   { "value": 0|null, "confidence": 0.0-1.0, "source_excerpt": "..." },
      "revenue":        { "value": 0|null, "confidence": 0.0-1.0, "source_excerpt": "..." },
      "sde":            { "value": 0|null, "confidence": 0.0-1.0, "source_excerpt": "..." },
      "sde_multiple":   { "value": 0|null, "confidence": 0.0-1.0, "source_excerpt": "DERIVED from asking/SDE" }
    },
    "employees":          { "value": 0|null, "confidence": 0.0-1.0, "source_excerpt": "..." },
    "years_in_business":  { "value": 0|null, "confidence": 0.0-1.0, "source_excerpt": "..." },
    "real_estate_included": { "value": true|false|null, "confidence": 0.0, "source_excerpt": "..." },
    "seller_financing":     { "value": true|false|null, "confidence": 0.0, "source_excerpt": "..." }
  },
  "thesis_draft": {
    "one_liner": "≤25-word plain-English description",
    "why_interesting": ["bullet ≤20 words", ...],
    "why_skeptical": ["bullet ≤20 words", ...],
    "key_unknowns": ["bullet ≤20 words", ...]
  },
  "risks": [
    {
      "category": "financial" | "operational" | "legal" | "market" | "concentration" | "key_person" | "regulatory" | "environmental",
      "severity": "blocker" | "high" | "medium" | "low",
      "summary": "≤30 words",
      "evidence": "verbatim ≤25-word quote from listing or NOT_FOUND"
    }
  ],
  "questions_to_answer_before_loi": [
    {
      "category": "financials" | "operations" | "customer_base" | "team" | "legal" | "transition" | "seller_motivation",
      "priority": "p0" | "p1" | "p2",
      "question": "specific question ≤30 words",
      "rationale": "≤20 words"
    }
  ],
  "suggested_next_step": "request_cim" | "request_teaser" | "ask_broker_specific_q" | "pass_and_log_reason",
  "estimated_time_to_loi_days": 0,
  "analyst_confidence_overall": 0.0-1.0
}`;

export interface InitialScreenInput {
  buyBox: {
    deal_size_min: number;
    deal_size_max: number;
    industries_allowed?: string[];
    industries_disallowed?: string[];
    states_allowed?: string[];
    financing_plan?: string;
    accepts_turnarounds?: boolean;
    notes?: string;
  };
  listing: {
    title?: string;
    description_full_text?: string;
    asking_price?: number | null;
    cash_flow?: number | null;
    revenue?: number | null;
    city?: string | null;
    state?: string | null;
    category?: string | null;
    year_established?: number | null;
    employees?: number | null;
    real_estate_included?: boolean | null;
    reason_for_selling?: string | null;
    seller_financing_available?: boolean | null;
  };
  teaserText?: string;
}

export async function initialScreen(
  input: InitialScreenInput,
  apiKey?: string,
): Promise<{
  output: InitialScreenOutput;
  cost_usd: number;
  retries: number;
  model_used: string;
  prompt_version: string;
}> {
  const client = createClient({ apiKey });
  const user = buildUserMessage(input);
  const res = await client.call<InitialScreenOutput>({
    model: "opus",
    system: SYSTEM,
    user,
    maxTokens: 4000,
    temperature: 0.2,
    jsonMode: true,
    validator: assertInitialScreen,
  });
  return {
    output: res.content,
    cost_usd: res.cost_usd,
    retries: res.retries,
    model_used: res.model_used,
    prompt_version: STAGE_1_PROMPT_VERSION,
  };
}

function buildUserMessage(input: InitialScreenInput): string {
  const bb = input.buyBox;
  const l = input.listing;
  return `<user_buy_box>
Deal size: $${bb.deal_size_min.toLocaleString()} – $${bb.deal_size_max.toLocaleString()}
${bb.industries_allowed ? `Industries (allowed): ${bb.industries_allowed.join(", ")}` : ""}
${bb.industries_disallowed ? `Industries (disallowed): ${bb.industries_disallowed.join(", ")}` : ""}
${bb.states_allowed ? `States: ${bb.states_allowed.join(", ")}` : "States: any"}
Financing: ${bb.financing_plan ?? "SBA 7(a) + buyer equity"}
Accepts turnarounds: ${bb.accepts_turnarounds === true ? "yes" : "no"}
${bb.notes ? `Notes: ${bb.notes}` : ""}
</user_buy_box>

<listing>
${l.title ?? ""}

${l.description_full_text ?? ""}

Asking Price: ${fmtMoney(l.asking_price)}
Cash Flow (SDE): ${fmtMoney(l.cash_flow)}
Revenue: ${fmtMoney(l.revenue)}
Location: ${l.city ?? "?"}, ${l.state ?? "?"}
Industry: ${l.category ?? "?"}
Year Established: ${l.year_established ?? "?"}
Employees: ${l.employees ?? "?"}
Real Estate: ${l.real_estate_included === null ? "?" : l.real_estate_included ? "included" : "not included"}
Reason for Selling: ${l.reason_for_selling ?? "?"}
Seller Financing: ${l.seller_financing_available === null ? "?" : l.seller_financing_available ? "available" : "not available"}
</listing>

${input.teaserText ? `<optional_teaser>\n${input.teaserText}\n</optional_teaser>` : ""}`;
}

function fmtMoney(n: number | null | undefined): string {
  if (n == null) return "?";
  return `$${Math.round(n).toLocaleString()}`;
}

export const STAGE_1_PROMPT_VERSION = "stage1-initial-screen.v1.0";
