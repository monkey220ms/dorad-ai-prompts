/**
 * Stage-2 CIM Extraction schemas.
 *
 *  Pass 1 — per-section extraction (returns a CimSectionExtract)
 *  Pass 2 — reconciliation into a cim-stage snapshot + issues list
 */

export interface CimFact {
  field_path: string;
  value: string | number | boolean | null | Array<unknown>;
  unit: "USD" | "percent" | "count" | "date" | "text" | "years" | null;
  period: string | null;
  confidence: number;
  source_excerpt: string;
  source_page_hint: number | null;
  notes: string;
}

export const ALLOWED_CIM_FLAGS = [
  "narrative_numeric_mismatch",
  "adjusted_ebitda_without_backup",
  "projections_look_hockey_stick",
  "customer_concentration_undisclosed",
  "addbacks_not_itemized",
  "owner_comp_missing",
  "reported_vs_adjusted_delta_large",
  "revenue_quality_unclear",
  "historical_years_inconsistent",
  "legal_or_regulatory_flag",
  "other",
] as const;
export type CimFlag = (typeof ALLOWED_CIM_FLAGS)[number];

export interface CimSectionExtractOutput {
  section_type: string;
  facts: CimFact[];
  flags: CimFlag[];
}

/** Allowed field_path prefixes (for soft validation — warn, don't throw). */
export const CIM_FIELD_PATH_PREFIXES = [
  "business.",
  "customers.",
  "financials.revenue.",
  "financials.gross_profit.",
  "financials.operating_expenses.",
  "financials.ebitda.reported.",
  "financials.ebitda.adjusted.",
  "financials.sde.reported.",
  "financials.sde.adjusted.",
  "sde.addbacks.",
  "working_capital.",
  "real_estate.",
  "ffe.",
  "team.",
  "deal.",
  "market.",
  "projections.",
  "legal.",
  "transition.",
];

export function assertCimSectionExtract(obj: unknown): asserts obj is CimSectionExtractOutput {
  const o = obj as Record<string, unknown>;
  if (!o) throw new Error("empty response");
  if (typeof o.section_type !== "string" || o.section_type.length === 0) {
    throw new Error("section_type required");
  }
  if (!Array.isArray(o.facts)) throw new Error("facts must be array");
  for (const [i, f0] of (o.facts as Array<Record<string, unknown>>).entries()) {
    const f = f0;
    if (typeof f.field_path !== "string" || f.field_path.length === 0) {
      throw new Error(`facts[${i}].field_path required`);
    }
    if (!("value" in f)) throw new Error(`facts[${i}].value required (null allowed)`);
    if (typeof f.confidence !== "number" || f.confidence < 0 || f.confidence > 1) {
      throw new Error(`facts[${i}].confidence must be 0..1`);
    }
    if (typeof f.source_excerpt !== "string") {
      throw new Error(`facts[${i}].source_excerpt required`);
    }
    if (f.unit !== null && !["USD", "percent", "count", "date", "text", "years"].includes(f.unit as string)) {
      throw new Error(`facts[${i}].unit invalid`);
    }
  }
  if (!Array.isArray(o.flags)) throw new Error("flags must be array");
  for (const fl of o.flags as string[]) {
    if (!ALLOWED_CIM_FLAGS.includes(fl as CimFlag)) {
      throw new Error(`unknown flag: ${fl}`);
    }
  }
}

/* ------------------------------------------------------------------ */
/* Pass 2 — reconciliation                                             */
/* ------------------------------------------------------------------ */

import type { InitialScreenOutput } from "./initial-screen.ts";

export interface ReconciliationIssue {
  field: string;
  listing_value: number | string | null;
  cim_value: number | string | null;
  delta_pct: number | null;
  severity: "blocker" | "high" | "medium" | "low";
  suggested_question: string;
  category: string;
}

export interface BrokerClaimVsReality {
  claim: string;
  reality_finding: string;
  severity: "blocker" | "high" | "medium" | "low";
}

export interface CimReconciledOutput {
  snapshot_cim: InitialScreenOutput["snapshot"];
  reconciliation_issues: ReconciliationIssue[];
  broker_claims_vs_reality: BrokerClaimVsReality[];
  new_risks: InitialScreenOutput["risks"];
  new_questions: InitialScreenOutput["questions_to_answer_before_loi"];
}

const SEV: Array<"blocker" | "high" | "medium" | "low"> = ["blocker", "high", "medium", "low"];

export function assertCimReconciled(obj: unknown): asserts obj is CimReconciledOutput {
  const o = obj as Record<string, unknown>;
  if (!o) throw new Error("empty response");
  if (!o.snapshot_cim || typeof o.snapshot_cim !== "object") {
    throw new Error("snapshot_cim required");
  }
  if (!Array.isArray(o.reconciliation_issues)) {
    throw new Error("reconciliation_issues must be array");
  }
  for (const [i, r0] of (o.reconciliation_issues as Array<Record<string, unknown>>).entries()) {
    if (typeof r0.field !== "string") throw new Error(`reconciliation_issues[${i}].field required`);
    if (!SEV.includes(r0.severity as "blocker")) {
      throw new Error(`reconciliation_issues[${i}].severity invalid`);
    }
    if (typeof r0.suggested_question !== "string") {
      throw new Error(`reconciliation_issues[${i}].suggested_question required`);
    }
  }
  if (!Array.isArray(o.broker_claims_vs_reality)) {
    throw new Error("broker_claims_vs_reality must be array");
  }
  if (!Array.isArray(o.new_risks)) throw new Error("new_risks must be array");
  if (!Array.isArray(o.new_questions)) throw new Error("new_questions must be array");
}
