/**
 * Stage-10 Due Diligence / IC Memo.
 *
 * The final synthesis before close. Audience: buyer's SBA lender, equity
 * partners, spouse/family. Tone: honest, not promotional.
 */

import { assertIcMemo, type IcMemoOutput } from "../schemas/ic-memo.ts";
import type { InitialScreenOutput } from "../schemas/initial-screen.ts";
import type { QofeOutput } from "../schemas/qofe.ts";
import type { VdrReviewOutput } from "../schemas/vdr-review.ts";
import { createClient } from "../client.ts";

const SYSTEM = `You are writing an Investment Committee (IC) memo for a Small Business Acquisition.

Target length: ~2,500 words.
Audience: the buyer's capital providers (SBA lender, equity partners, spouse/family). Assume they are financially literate but have NOT read the underlying CIM.

Draft sections (in order, using markdown H2 headers):
1.  Executive Summary (½ page)
2.  Investment Thesis (1 page) — 3 bullets of why, 3 bullets of why skeptical.
3.  Business Overview
4.  Market & Competition
5.  Historical Financials + QofE summary
6.  Projections & Scenarios (reference the financial model's 5 scenarios; name DSCRs)
7.  Deal Structure & Sources/Uses
8.  Buyer Returns (DSCR, cash-on-cash Y1, equity IRR 5yr, payback years)
9.  Key Risks (pull from deal_risks, grouped by severity)
10. Due Diligence Findings
11. Conditions to Close
12. Post-Close 100-day Plan
13. Exit Outlook
14. Appendix (source citations, data room inventory)

Every factual claim in the memo must map to a source fact ID (provided in input.extractedFactIds keyed by field_path) OR be explicitly flagged as "[estimate / not independently verified]".

Tone: honest, not promotional. An IC memo that oversells will be seen through. Prefer conservative language; acknowledge unknowns directly.

Output JSON:
{
  "memo_markdown": "...full markdown, ≥1000 chars...",
  "citations": [
    { "claim_paragraph_index": 3, "claim_text": "≤40 words", "source_fact_ids": ["fact_id_1","fact_id_2"] }
  ],
  "confidence_by_section": {
    "executive_summary":    0.0-1.0,
    "investment_thesis":    0.0-1.0,
    "business_overview":    0.0-1.0,
    "market_competition":   0.0-1.0,
    "historical_financials":0.0-1.0,
    "projections_scenarios":0.0-1.0,
    "deal_structure":       0.0-1.0,
    "buyer_returns":        0.0-1.0,
    "key_risks":            0.0-1.0,
    "dd_findings":          0.0-1.0,
    "conditions_to_close":  0.0-1.0,
    "hundred_day_plan":     0.0-1.0,
    "exit_outlook":         0.0-1.0,
    "appendix":             0.0-1.0
  },
  "still_unanswered_questions": ["≤25 words each"]
}

Output JSON only.`;

export interface IcMemoInput {
  snapshot: InitialScreenOutput["snapshot"];
  thesis: InitialScreenOutput["thesis_draft"];
  qofe: QofeOutput;
  vdrReview: VdrReviewOutput | null;
  risks: InitialScreenOutput["risks"];
  modelOutputsSummary: {
    dscr_y1: number | null;
    dscr_min: number | null;
    cash_on_cash_y1_pct: number | null;
    irr_5yr: number | null;
    moic_5yr: number | null;
    scenarios: Array<{ label: string; dscr_y1: number | null; narrative: string }>;
  };
  sourcesAndUses: {
    uses_total: number | null;
    sources_breakdown: Record<string, number>;
  };
  hundredDayPriorities: string[];
  /** Optional fact-ID map keyed by field_path, used for inline citations. */
  extractedFactIds?: Record<string, string>;
}

export async function writeIcMemo(
  input: IcMemoInput,
  apiKey?: string,
): Promise<{
  output: IcMemoOutput;
  cost_usd: number;
  retries: number;
  model_used: string;
  prompt_version: string;
}> {
  const client = createClient({ apiKey });
  const user = `<snapshot>
${JSON.stringify(input.snapshot, null, 2)}
</snapshot>

<thesis>
${JSON.stringify(input.thesis, null, 2)}
</thesis>

<qofe>
${JSON.stringify(input.qofe, null, 2)}
</qofe>

<vdr_review>
${JSON.stringify(input.vdrReview ?? null, null, 2)}
</vdr_review>

<risks>
${JSON.stringify(input.risks, null, 2)}
</risks>

<model_outputs_summary>
${JSON.stringify(input.modelOutputsSummary, null, 2)}
</model_outputs_summary>

<sources_and_uses>
${JSON.stringify(input.sourcesAndUses, null, 2)}
</sources_and_uses>

<hundred_day_priorities>
${JSON.stringify(input.hundredDayPriorities, null, 2)}
</hundred_day_priorities>

<extracted_fact_ids>
${JSON.stringify(input.extractedFactIds ?? {}, null, 2)}
</extracted_fact_ids>`;
  const res = await client.call<IcMemoOutput>({
    model: "opus",
    system: SYSTEM,
    user,
    maxTokens: 12000,
    temperature: 0.2,
    jsonMode: true,
    validator: assertIcMemo,
  });
  return {
    output: res.content,
    cost_usd: res.cost_usd,
    retries: res.retries,
    model_used: res.model_used,
    prompt_version: STAGE_10_PROMPT_VERSION,
  };
}

export const STAGE_10_PROMPT_VERSION = "stage10.v1.0";
