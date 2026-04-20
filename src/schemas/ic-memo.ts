/**
 * Stage-10 Investment Committee (IC) / DD Memo schema.
 */

export const IC_MEMO_SECTIONS = [
  "executive_summary",
  "investment_thesis",
  "business_overview",
  "market_competition",
  "historical_financials",
  "projections_scenarios",
  "deal_structure",
  "buyer_returns",
  "key_risks",
  "dd_findings",
  "conditions_to_close",
  "hundred_day_plan",
  "exit_outlook",
  "appendix",
] as const;
export type IcMemoSection = (typeof IC_MEMO_SECTIONS)[number];

export interface IcMemoCitation {
  claim_paragraph_index: number;
  claim_text: string;
  source_fact_ids: string[];
}

export interface IcMemoOutput {
  memo_markdown: string;
  citations: IcMemoCitation[];
  confidence_by_section: Partial<Record<IcMemoSection, number>>;
  still_unanswered_questions: string[];
}

export function assertIcMemo(obj: unknown): asserts obj is IcMemoOutput {
  const o = obj as Record<string, unknown>;
  if (!o) throw new Error("empty response");
  if (typeof o.memo_markdown !== "string" || o.memo_markdown.length < 1000) {
    throw new Error("memo_markdown required (expect ≥1000 chars)");
  }
  if (!Array.isArray(o.citations)) throw new Error("citations must be array");
  for (const [i, c0] of (o.citations as Array<Record<string, unknown>>).entries()) {
    if (typeof c0.claim_paragraph_index !== "number") {
      throw new Error(`citations[${i}].claim_paragraph_index must be number`);
    }
    if (typeof c0.claim_text !== "string") {
      throw new Error(`citations[${i}].claim_text required`);
    }
    if (!Array.isArray(c0.source_fact_ids)) {
      throw new Error(`citations[${i}].source_fact_ids must be array`);
    }
  }
  const cbs = o.confidence_by_section as Record<string, unknown>;
  if (!cbs || typeof cbs !== "object") {
    throw new Error("confidence_by_section required");
  }
  for (const [k, v] of Object.entries(cbs)) {
    if (typeof v !== "number" || v < 0 || v > 1) {
      throw new Error(`confidence_by_section.${k} must be 0..1`);
    }
  }
  if (!Array.isArray(o.still_unanswered_questions)) {
    throw new Error("still_unanswered_questions must be array");
  }
}
