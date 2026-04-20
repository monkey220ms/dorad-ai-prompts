/**
 * Stage-8 Financial Model Builder (first-pass).
 *
 * Populates the v1 assumption set + 5 scenario variants. The deterministic
 * calc engine consumes this and produces numeric outputs (DSCR, IRR, etc.).
 */

import {
  assertModelBuilder,
  type ModelBuilderOutput,
} from "../schemas/model-builder.ts";
import type { QofeOutput } from "../schemas/qofe.ts";
import type { InitialScreenOutput } from "../schemas/initial-screen.ts";
import { createClient } from "../client.ts";

const SYSTEM = `You are initializing a three-layer financial model for an SMB acquisition.

Layer 1 OPERATIONS      — how the business performs (revenue, costs, SDE, growth).
Layer 2 DEAL STRUCTURE  — how the buyer pays for it (cash, SBA debt, seller note, earnout).
Layer 3 BUYER RETURNS   — what the buyer takes home (DSCR, cash-on-cash, IRR, payback).

Given the adjusted QofE output, user buy-box, and user's financing preference, produce the INITIAL assumption set + 5 scenario variants.

Output schema (JSON only):
{
  "schema_version": "1.0",
  "base_assumptions": {
    "model_start_date":         { "value": "YYYY-MM-DD", "provenance": { "source": "user_override"|"default", "confidence": 0.0-1.0 } },
    "projection_horizon_months":{ "value": 60, "provenance": { "source": "default", "confidence": 1.0 } },
    "currency":"USD",
    "operations": {
      "historical": {
        "period_label":   { "value":"TTM Jun 2025", "provenance":{ "source":"qofe","confidence":0.9 } },
        "revenue":        { "value": 0, "provenance": { ... } },
        "cogs_pct":       { "value": 0.40, "provenance": { ... } },
        "gross_profit":   { "value": 0, "provenance": { "source":"derived","confidence":0.9 } },
        "opex_annual":    { "value": 0, "provenance": { ... } },
        "ebitda":         { "value": 0, "provenance": { ... } },
        "sde":            { "value": 0, "provenance": { ... } },
        "sde_adjusted":   { "value": 0, "provenance": { ... } }
      },
      "revenue_model": { "value":"percent_growth", "provenance":{ "source":"default","confidence":0.6 } },
      "revenue_assumptions": {
        "growth_pct_y1":     { "value": 0.03, "provenance": { ... } },
        "growth_pct_y2":     { "value": 0.03, "provenance": { ... } },
        "growth_pct_y3":     { "value": 0.03, "provenance": { ... } },
        "growth_pct_y4_plus":{ "value": 0.03, "provenance": { ... } },
        "pricing_increase": null
      },
      "cogs_assumptions": {
        "cogs_pct_y1":     { "value": 0.40, "provenance": { ... } },
        "cogs_pct_y2_plus":{ "value": 0.40, "provenance": { ... } },
        "inflator_annual_pct":{ "value": 0.03, "provenance": { ... } }
      },
      "opex_assumptions": {
        "categories": [
          { "key":"rent","annual_amount":{ "value": 0,"provenance":{...} },"inflator_annual_pct":{ "value": 0.03,"provenance":{...} },"step_changes":[] }
        ]
      },
      "owner_role": { "value":"owner_operator_ft", "provenance":{ ... } },
      "new_hires": [],
      "maintenance_capex": {
        "annual_amount": { "value": 0, "provenance": { ... } },
        "pct_of_revenue": { "value": 0.02, "provenance": { ... } },
        "first_large_purchase": null
      },
      "working_capital": {
        "ar_days": { "value": 30, "provenance": { ... } },
        "inventory_days": { "value": 0, "provenance": { ... } },
        "ap_days": { "value": 20, "provenance": { ... } },
        "minimum_cash_buffer": { "value": 50000, "provenance": { ... } }
      },
      "tax_rate_effective": { "value": 0.25, "provenance": { ... } },
      "pass_through_entity": { "value": true, "provenance": { ... } }
    },
    "structure": {
      "purchase_structure": { "value":"asset", "provenance": { ... } },
      "purchase_price_components": {
        "business_price":       { "value": 0, "provenance": { ... } },
        "inventory_value":      { "value": 0, "provenance": { ... } },
        "ar_acquired":          { "value": 0, "provenance": { ... } },
        "cash_acquired":        { "value": 0, "provenance": { ... } },
        "real_estate_price":    { "value": 0, "provenance": { ... } },
        "real_estate_included": { "value": false, "provenance": { ... } },
        "total":                { "value": 0, "provenance": { ... } }
      },
      "sources_of_funds": {
        "buyer_equity": { "value": 0, "provenance": { ... } },
        "sba_7a_loan": {
          "amount":              { "value": 0, "provenance": { ... } },
          "rate_pct_apr":        { "value": 0.115, "provenance": { ... } },
          "term_years":          { "value": 10, "provenance": { ... } },
          "guarantee_fee_pct":   { "value": 0.035, "provenance": { ... } },
          "packaging_fee":       { "value": 5000, "provenance": { ... } },
          "prepayment_penalty_years": { "value": 3, "provenance": { ... } }
        },
        "seller_note": null,
        "earnout": null,
        "equity_partners": [],
        "closing_costs":         { "value": 0, "provenance": { ... } },
        "working_capital_at_close":{ "value": 0, "provenance": { ... } }
      },
      "working_capital_peg": {
        "target_amount": { "value": 0, "provenance": { ... } },
        "method":        { "value":"3mo_avg","provenance":{ ... } },
        "true_up_post_close":{ "value": true, "provenance": { ... } }
      },
      "transaction_costs": {
        "legal_fees":{ "value": 15000, "provenance": { ... } },
        "qofe_fees":{ "value": 8000, "provenance": { ... } },
        "environmental_phase1":{ "value": 0, "provenance": { ... } },
        "business_appraisal":{ "value": 0, "provenance": { ... } },
        "real_estate_appraisal":{ "value": 0, "provenance": { ... } },
        "title_insurance":{ "value": 0, "provenance": { ... } },
        "other":{ "value": 5000, "provenance": { ... } }
      }
    },
    "returns": {
      "buyer_owner_comp_annual": { "value": 90000, "provenance": { ... } },
      "buyer_preferred_distribution_policy": { "value":"distribute_all_excess_after_dscr","provenance":{ ... } },
      "target_distribution_pct_of_cf": { "value": 0.75, "provenance": { ... } },
      "hold_period_years": { "value": 5, "provenance": { ... } },
      "exit_assumptions": {
        "exit_year": { "value": 5, "provenance": { ... } },
        "exit_sde_multiple": { "value": 3.0, "provenance": { ... } },
        "transaction_costs_at_exit_pct": { "value": 0.08, "provenance": { ... } },
        "debt_balance_at_exit_method": { "value":"calculated_from_amort","provenance":{ ... } },
        "debt_balance_at_exit_override": { "value": 0, "provenance": { ... } }
      },
      "tax_on_exit": {
        "federal_ltcg_pct":{ "value": 0.20, "provenance": { ... } },
        "state_ltcg_pct":{ "value": 0.05, "provenance": { ... } },
        "depreciation_recapture_handled_separately":{ "value": true, "provenance": { ... } }
      }
    },
    "scenarios": []
  },
  "scenarios": [
    { "scenario_label":"status_quo",          "display_name":"Status Quo",           "narrative":"≤240 chars",                                                "overrides": {},                                       "created_by":"ai" },
    { "scenario_label":"conservative_lender", "display_name":"Conservative (Lender)","narrative":"≤240 chars — SBA stress case",                             "overrides": { /* deltas from base */ },               "created_by":"ai" },
    { "scenario_label":"mgmt_led_growth",     "display_name":"Mgmt-led Growth",      "narrative":"≤240 chars — hire GM, modest growth, margin expansion",    "overrides": { /* deltas */ },                         "created_by":"ai" },
    { "scenario_label":"aggressive_turnaround","display_name":"Aggressive Turnaround","narrative":"≤240 chars — name the specific lever (pricing / capacity)","overrides": { /* deltas */ },                         "created_by":"ai" },
    { "scenario_label":"exit_prep",           "display_name":"Exit Prep",            "narrative":"≤240 chars — 3yr hold, professionalize, exit at higher x","overrides": { /* deltas */ },                         "created_by":"ai" }
  ],
  "narrative_summary": "≤240 words on the overall financial picture and what's most sensitive"
}

Every field under base_assumptions MUST use the Assumption<T> shape: { value, provenance: { source, confidence, last_edited_by?, last_edited_at?, rationale? } }. Use source="derived" for computed fields (gross_profit, total), "default" for industry-standard defaults, "user_override" for user-supplied values, "qofe" for items coming from Stage-7 output.

Scenario presets (tune to the specific deal):
- conservative_lender: growth_pct_y1..y4 = 0 ; cogs_pct +2pp ; opex inflator +1pp ; new_hires []; maintenance_capex +50%. Purpose: SBA worst-case.
- mgmt_led_growth:     +1 GM at month 0 loaded_comp ~$95k ; growth 5/7/8% ; owner_role="semi_absentee" after month 6 ; marketing +20%.
- aggressive_turnaround: identify the specific lever from the snapshot (pricing / capacity / churn). E.g. pricing_increase month=3, +8% with 5% retention loss.
- exit_prep: hold_period_years=3, exit_sde_multiple = status_quo exit_multiple + 0.5, distributions = "retain_all_excess".

Output JSON only.`;

export interface ModelBuilderInput {
  qofe: QofeOutput;
  snapshot: InitialScreenOutput["snapshot"];
  buyBox: {
    deal_size_min: number;
    deal_size_max: number;
    financing_plan?: string;
  };
  financingPreference:
    | { type: "sba_7a"; buyer_equity_pct: number; seller_note_pct?: number }
    | { type: "cash" }
    | { type: "other"; notes: string };
  postCloseOwnerRole:
    | "owner_operator_ft"
    | "owner_operator_pt"
    | "absentee_with_gm"
    | "semi_absentee";
  modelStartDate: string; // YYYY-MM-DD
}

export async function buildFinancialModel(
  input: ModelBuilderInput,
  apiKey?: string,
): Promise<{
  output: ModelBuilderOutput;
  cost_usd: number;
  retries: number;
  model_used: string;
  prompt_version: string;
}> {
  const client = createClient({ apiKey });
  const user = `<qofe_output>
${JSON.stringify(input.qofe, null, 2)}
</qofe_output>

<snapshot>
${JSON.stringify(input.snapshot, null, 2)}
</snapshot>

<buy_box>
${JSON.stringify(input.buyBox, null, 2)}
</buy_box>

<financing_preference>
${JSON.stringify(input.financingPreference, null, 2)}
</financing_preference>

<post_close_owner_role>${input.postCloseOwnerRole}</post_close_owner_role>
<model_start_date>${input.modelStartDate}</model_start_date>`;
  const res = await client.call<ModelBuilderOutput>({
    model: "sonnet",
    system: SYSTEM,
    user,
    maxTokens: 8000,
    temperature: 0.2,
    jsonMode: true,
    validator: assertModelBuilder,
  });
  return {
    output: res.content,
    cost_usd: res.cost_usd,
    retries: res.retries,
    model_used: res.model_used,
    prompt_version: STAGE_8_PROMPT_VERSION,
  };
}

export const STAGE_8_PROMPT_VERSION = "stage8-model-builder.v1.0";
