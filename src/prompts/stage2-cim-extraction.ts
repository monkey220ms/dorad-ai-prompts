/**
 * Stage-2 CIM Extraction.
 *
 *  Pass 1 (Sonnet) — one call per CIM section. Returns {facts[], flags[]}.
 *  Pass 2 (Opus)   — reconciles Pass-1 facts + listing snapshot into a
 *                    cim-stage snapshot with reconciliation_issues.
 */

import {
  assertCimSectionExtract,
  assertCimReconciled,
  type CimSectionExtractOutput,
  type CimReconciledOutput,
} from "../schemas/cim-extraction.ts";
import type { InitialScreenOutput } from "../schemas/initial-screen.ts";
import { createClient } from "../client.ts";

/* ------------------------------------------------------------------ */
/* Pass 1 — per-section extraction                                     */
/* ------------------------------------------------------------------ */

const SYSTEM_PASS1 = `You are extracting structured facts from ONE section of a Confidential Information Memorandum (CIM) for a small business acquisition.

You will be given:
- section_type (hint, e.g. "financial_summary", "business_overview")
- document_id (opaque string; echo back in source_excerpt notes when useful)
- raw text of that section

Return a JSON object of the form:
{
  "section_type": "...",
  "facts": [
    {
      "field_path": "dot.notated.path",
      "value": <string | number | boolean | array | null>,
      "unit": "USD" | "percent" | "count" | "date" | "text" | "years" | null,
      "period": "FY2024" | "TTM Jun 2025" | null,
      "confidence": 0.0-1.0,
      "source_excerpt": "≤25 verbatim words",
      "source_page_hint": integer | null,
      "notes": "≤20 words; e.g. 'range 1.2M-1.4M given, took low'"
    }
  ],
  "flags": [ "narrative_numeric_mismatch" | "adjusted_ebitda_without_backup" | "projections_look_hockey_stick" | "customer_concentration_undisclosed" | "addbacks_not_itemized" | "owner_comp_missing" | "reported_vs_adjusted_delta_large" | "revenue_quality_unclear" | "historical_years_inconsistent" | "legal_or_regulatory_flag" | "other" ]
}

CRITICAL EXTRACTION RULES:
1. Every number must be supported by an explicit source_excerpt. If the value is inferred across sentences, set confidence ≤0.6 and explain in notes.
2. Never extract a "projected" number as if it were historical. Mark projection periods explicitly (e.g. period="FY2026E").
3. When the CIM says "approximately", "roughly", "about" — keep the language in source_excerpt AND drop confidence to ≤0.7.
4. Add-backs must be captured INDIVIDUALLY (field_path="sde.addbacks.owner_salary.FY2024", etc.), not rolled into a single SDE number.
5. If the CIM states reported EBITDA AND adjusted EBITDA, extract BOTH with separate field_paths (financials.ebitda.reported.*, financials.ebitda.adjusted.*).
6. If a number is not present, DO NOT EMIT the fact. Only emit facts supported by the text.
7. Ranges: take the conservative end (lower revenue, higher expenses, lower multiple) and note the range in notes.

ALLOWED field_path prefixes (use these exactly):
- business.*      (name, industry, location, year_founded, employees_ft, employees_pt, entity_structure, website, products_services)
- customers.*     (count_active, top5_concentration_pct, top1_concentration_pct, ltv_months, churn_annual_pct, recurring_rev_pct)
- financials.revenue.<period>
- financials.gross_profit.<period>
- financials.operating_expenses.<period>
- financials.ebitda.reported.<period>
- financials.ebitda.adjusted.<period>
- financials.sde.reported.<period>
- financials.sde.adjusted.<period>
- sde.addbacks.<addback_name>.<period>
- working_capital.<component>     (ar_days, inventory_days, ap_days, cash_on_hand, line_of_credit_balance)
- real_estate.*                   (owned_by_seller, monthly_rent, lease_term_remaining_months, square_footage, renewal_option)
- ffe.*                           (total_value_estimated, covered_in_price, itemized_list_provided)
- team.*                          (owner_hours_per_week, owner_role_description, key_employees_list, owner_stay_post_close_months)
- deal.*                          (asking_price, seller_financing_amount, seller_financing_terms, training_period_months, non_compete_years)
- market.*                        (tam_estimate_usd, growth_rate_pct, top_competitors, regulatory_environment)
- projections.*                   (always flagged and lower-confidence)
- legal.*                         (lawsuits_disclosed, licenses_required, ip_owned)
- transition.*                    (reason_for_sale, urgency, broker_name, broker_phone, broker_email)

Output JSON only.`;

export interface CimSectionExtractInput {
  sectionType: string;
  documentId: string;
  sectionText: string;
  pageHintOffset?: number;
}

export async function extractCimSection(
  input: CimSectionExtractInput,
  apiKey?: string,
): Promise<{
  output: CimSectionExtractOutput;
  cost_usd: number;
  retries: number;
  model_used: string;
  prompt_version: string;
}> {
  const client = createClient({ apiKey });
  const user = `<section_type>${input.sectionType}</section_type>
<document_id>${input.documentId}</document_id>
<text>
${input.sectionText}
</text>${
    input.pageHintOffset ? `\n<page_offset>${input.pageHintOffset}</page_offset>` : ""
  }`;
  const res = await client.call<CimSectionExtractOutput>({
    model: "sonnet",
    system: SYSTEM_PASS1,
    user,
    maxTokens: 6000,
    temperature: 0.1,
    jsonMode: true,
    validator: assertCimSectionExtract,
  });
  return {
    output: res.content,
    cost_usd: res.cost_usd,
    retries: res.retries,
    model_used: res.model_used,
    prompt_version: STAGE_2_PASS1_PROMPT_VERSION,
  };
}

export const STAGE_2_PASS1_PROMPT_VERSION = "stage2.pass1.v1.0";

/* ------------------------------------------------------------------ */
/* Pass 2 — reconciliation                                             */
/* ------------------------------------------------------------------ */

const SYSTEM_PASS2 = `You reconcile extracted facts from a CIM into a single coherent deal snapshot.

You receive:
- listing_snapshot: the Stage-1 Initial Screen snapshot object
- cim_facts: array of fact objects from Stage-2 Pass 1 (one element per section)

Your job:
1. For each field in the snapshot schema, SELECT the highest-confidence available fact. If two facts conflict (e.g. revenue in Executive Summary ≠ revenue in Financial Summary), output BOTH as alternates and create a reconciliation_issue.
2. RE-COMPUTE derived metrics (sde_multiple, gross_margin, ebitda_margin) using the selected values. Round to 2 decimals. Source_excerpt for derived fields = "DERIVED".
3. COMPARE CIM numbers against listing_snapshot. Any delta >5% on a headline metric becomes a broker_claims_vs_reality entry.
4. Do NOT invent numbers. If a slot has no supporting fact, leave value=null, confidence=0, source_excerpt="NOT_FOUND".
5. Carry the WEAKEST confidence into derived fields. E.g. revenue conf=0.9 AND sde conf=0.4 → sde_multiple conf = 0.4.
6. Add new_risks / new_questions only for issues that are NEW relative to the listing snapshot (don't duplicate existing).

Output schema (JSON only):
{
  "snapshot_cim": {
    "industry_normalized": "...",
    "geography": { "city": "...", "state": "...", "msa_or_region": "..." },
    "headline_metrics": {
      "asking_price":   { "value": 0|null, "confidence": 0.0-1.0, "source_excerpt": "..." },
      "revenue":        { "value": 0|null, "confidence": 0.0-1.0, "source_excerpt": "..." },
      "sde":            { "value": 0|null, "confidence": 0.0-1.0, "source_excerpt": "..." },
      "sde_multiple":   { "value": 0.0|null, "confidence": 0.0-1.0, "source_excerpt": "DERIVED" }
    },
    "employees":          { "value": 0|null, "confidence": 0.0-1.0, "source_excerpt": "..." },
    "years_in_business":  { "value": 0|null, "confidence": 0.0-1.0, "source_excerpt": "..." },
    "real_estate_included": { "value": true|false|null, "confidence": 0.0-1.0, "source_excerpt": "..." },
    "seller_financing":     { "value": true|false|null, "confidence": 0.0-1.0, "source_excerpt": "..." }
  },
  "reconciliation_issues": [
    {
      "field": "financials.revenue.FY2024",
      "listing_value": 1200000,
      "cim_value": 1050000,
      "delta_pct": -12.5,
      "severity": "blocker"|"high"|"medium"|"low",
      "suggested_question": "...",
      "category": "revenue_mismatch"|"sde_mismatch"|"addback_mismatch"|"other"
    }
  ],
  "broker_claims_vs_reality": [
    { "claim": "'recurring revenue 80%' — broker teaser",
      "reality_finding": "CIM financials show 35% recurring when calculated from customer list",
      "severity": "high" }
  ],
  "new_risks":     [ /* same shape as Stage 1 risks */ ],
  "new_questions": [ /* same shape as Stage 1 questions_to_answer_before_loi */ ]
}

Output JSON only, no prose.`;

export interface CimReconcileInput {
  listingSnapshot: InitialScreenOutput;
  cimFacts: CimSectionExtractOutput[];
}

export async function reconcileCim(
  input: CimReconcileInput,
  apiKey?: string,
): Promise<{
  output: CimReconciledOutput;
  cost_usd: number;
  retries: number;
  model_used: string;
  prompt_version: string;
}> {
  const client = createClient({ apiKey });
  const user = `<listing_snapshot>
${JSON.stringify(input.listingSnapshot, null, 2)}
</listing_snapshot>

<cim_facts>
${JSON.stringify(input.cimFacts, null, 2)}
</cim_facts>`;
  const res = await client.call<CimReconciledOutput>({
    model: "opus",
    system: SYSTEM_PASS2,
    user,
    maxTokens: 6000,
    temperature: 0.2,
    jsonMode: true,
    validator: assertCimReconciled,
  });
  return {
    output: res.content,
    cost_usd: res.cost_usd,
    retries: res.retries,
    model_used: res.model_used,
    prompt_version: STAGE_2_PASS2_PROMPT_VERSION,
  };
}

export const STAGE_2_PASS2_PROMPT_VERSION = "stage2.pass2.v1.0";
