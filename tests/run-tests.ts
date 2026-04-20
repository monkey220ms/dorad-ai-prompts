/**
 * Unit tests for @dorad/ai-prompts.
 *
 * These tests don't hit the Anthropic API (expensive, requires key). They
 * only test the pure utility functions: JSON parser, validators, prompt
 * formatting.
 *
 * Run with:  node --experimental-strip-types --disable-warning=ExperimentalWarning tests/run-tests.ts
 */

import { assertInitialScreen } from "../src/schemas/initial-screen.ts";
import { assertDocClassifier, ALLOWED_DOC_TYPES } from "../src/schemas/doc-classifier.ts";
import { assertCimSectionExtract, assertCimReconciled } from "../src/schemas/cim-extraction.ts";
import { assertFinancialParser } from "../src/schemas/financial-parser.ts";
import { assertComps } from "../src/schemas/comps.ts";
import { assertSellerCall } from "../src/schemas/seller-call.ts";
import { assertVdrReview } from "../src/schemas/vdr-review.ts";
import { assertQofe } from "../src/schemas/qofe.ts";
import { assertModelBuilder } from "../src/schemas/model-builder.ts";
import { assertLoi } from "../src/schemas/loi.ts";
import { assertIcMemo } from "../src/schemas/ic-memo.ts";
import { assertSanityCheck } from "../src/schemas/sanity-check.ts";
import { runFinancialMathCheck } from "../src/schemas/financial-parser.ts";

let passed = 0;
let failed = 0;

function test(name: string, fn: () => void) {
  try { fn(); passed++; console.log(`  ✓ ${name}`); }
  catch (e) { failed++; console.log(`  ✗ ${name}\n    ${(e as Error).message}`); }
}
function describe(name: string, fn: () => void) { console.log(`\n${name}`); fn(); }

function expectThrow(fn: () => void, substr: string) {
  try { fn(); throw new Error("expected throw"); }
  catch (e) {
    const msg = (e as Error).message;
    if (msg === "expected throw") throw new Error("did not throw");
    if (!msg.includes(substr)) throw new Error(`threw but message "${msg}" lacks "${substr}"`);
  }
}

/* ================================================================== */
/* Stage 1                                                             */
/* ================================================================== */

describe("assertInitialScreen", () => {
  test("accepts a well-formed output", () => {
    assertInitialScreen(wellFormedInitialScreen());
  });

  test("rejects invalid verdict", () => {
    expectThrow(
      () => assertInitialScreen({ ...(minimalInitial() as any), verdict: "maybe" } as unknown),
      "verdict must be one of",
    );
  });

  test("rejects missing headline_metrics.sde", () => {
    const bad = minimalInitial();
    delete (bad.snapshot.headline_metrics as any).sde;
    expectThrow(() => assertInitialScreen(bad), "headline_metrics.sde required");
  });

  test("rejects confidence out of range", () => {
    const bad = minimalInitial() as any;
    bad.snapshot.headline_metrics.sde.confidence = 1.5;
    expectThrow(() => assertInitialScreen(bad), "must be 0..1");
  });

  test("rejects risk with invalid severity", () => {
    const bad = minimalInitial() as any;
    bad.risks[0].severity = "very bad";
    expectThrow(() => assertInitialScreen(bad), "risk.severity must be");
  });
});

/* ================================================================== */
/* Stage 0                                                             */
/* ================================================================== */

describe("assertDocClassifier", () => {
  test("accepts a valid classifier output", () => {
    assertDocClassifier({
      doc_type: "cim",
      confidence: 0.95,
      time_period: { start: "2024-01-01", end: "2024-12-31", label: "FY2024" },
      currency: "USD",
      pages_estimated: 52,
      contains_pii: false,
      notes: "clean CIM with embedded P&L",
    });
  });

  test("rejects unknown doc_type", () => {
    expectThrow(
      () => assertDocClassifier({
        doc_type: "secret_file",
        confidence: 0.8,
        time_period: { start: null, end: null, label: null },
        currency: "USD",
        pages_estimated: 10,
        contains_pii: false,
        notes: "x",
      }),
      "doc_type must be one of",
    );
  });

  test("ALLOWED_DOC_TYPES is comprehensive", () => {
    if (ALLOWED_DOC_TYPES.length < 15) throw new Error("seems short");
  });
});

/* ================================================================== */
/* Stage 2                                                             */
/* ================================================================== */

describe("assertCimSectionExtract", () => {
  test("accepts a valid section extract", () => {
    assertCimSectionExtract({
      section_type: "financial_summary",
      facts: [
        {
          field_path: "financials.revenue.FY2024",
          value: 2_400_000,
          unit: "USD",
          period: "FY2024",
          confidence: 0.9,
          source_excerpt: "Revenue for FY2024 was $2.4M",
          source_page_hint: 12,
          notes: "",
        },
      ],
      flags: [],
    });
  });

  test("rejects unknown flag", () => {
    expectThrow(
      () => assertCimSectionExtract({
        section_type: "financial_summary",
        facts: [],
        flags: ["MADE_UP_FLAG"],
      }),
      "unknown flag",
    );
  });

  test("rejects out-of-range confidence", () => {
    expectThrow(
      () => assertCimSectionExtract({
        section_type: "x",
        facts: [{ field_path: "x.y", value: 1, unit: null, period: null, confidence: 2, source_excerpt: "", source_page_hint: null, notes: "" }],
        flags: [],
      }),
      "confidence must be 0..1",
    );
  });
});

describe("assertCimReconciled", () => {
  test("accepts a valid reconciled output", () => {
    assertCimReconciled({
      snapshot_cim: wellFormedInitialScreen().snapshot,
      reconciliation_issues: [
        { field: "financials.revenue.FY2024", listing_value: 1_200_000, cim_value: 1_050_000, delta_pct: -12.5, severity: "high", suggested_question: "Which revenue is correct?", category: "revenue_mismatch" },
      ],
      broker_claims_vs_reality: [],
      new_risks: [],
      new_questions: [],
    });
  });

  test("rejects bad severity", () => {
    expectThrow(
      () => assertCimReconciled({
        snapshot_cim: wellFormedInitialScreen().snapshot,
        reconciliation_issues: [{ field: "x", listing_value: null, cim_value: null, delta_pct: null, severity: "maybe", suggested_question: "x", category: "x" }],
        broker_claims_vs_reality: [],
        new_risks: [],
        new_questions: [],
      }),
      "severity invalid",
    );
  });
});

/* ================================================================== */
/* Stage 3                                                             */
/* ================================================================== */

describe("assertFinancialParser", () => {
  test("accepts a valid P&L parse", () => {
    assertFinancialParser({
      doc_type: "p_and_l",
      entity_name_on_doc: "Acme Plumbing LLC",
      periods: [
        {
          period_label: "FY2024",
          period_start: "2024-01-01",
          period_end: "2024-12-31",
          line_items: [
            { canonical_name: "revenue", doc_line_name: "Total Revenue", amount: 2_400_000, is_addback_candidate: false, confidence: 0.95, source_excerpt: "Total Revenue 2,400,000" },
            { canonical_name: "cogs", doc_line_name: "Cost of Goods Sold", amount: 960_000, is_addback_candidate: false, confidence: 0.95, source_excerpt: "COGS 960,000" },
          ],
          totals: { revenue_total: 2_400_000, cogs_total: 960_000, gross_profit: 1_440_000, opex_total: 1_040_000, ebitda_reported: 400_000, net_income: 320_000 },
        },
      ],
      math_check: { revenue_minus_cogs_equals_gp: true, opex_sum_matches_total: null, periods_sum_to_annual: null, issues: [] },
    });
  });

  test("rejects invalid doc_type", () => {
    expectThrow(
      () => assertFinancialParser({
        doc_type: "legal_doc",
        entity_name_on_doc: "",
        periods: [{ period_label: "x", period_start: null, period_end: null, line_items: [], totals: {} }],
        math_check: { revenue_minus_cogs_equals_gp: null, opex_sum_matches_total: null, periods_sum_to_annual: null, issues: [] },
      }),
      "doc_type must be one of",
    );
  });
});

describe("runFinancialMathCheck", () => {
  test("flags gross_profit mismatch", () => {
    const result = runFinancialMathCheck({
      doc_type: "p_and_l",
      entity_name_on_doc: "x",
      periods: [
        {
          period_label: "FY2024",
          period_start: "2024-01-01",
          period_end: "2024-12-31",
          line_items: [],
          totals: { revenue_total: 1_000_000, cogs_total: 400_000, gross_profit: 700_000, opex_total: null, ebitda_reported: null, net_income: null },
        },
      ],
      math_check: { revenue_minus_cogs_equals_gp: null, opex_sum_matches_total: null, periods_sum_to_annual: null, issues: [] },
    });
    if (result.ok) throw new Error("expected math_check to fail");
    if (!result.violations.some((v) => v.check === "gp_equals_rev_minus_cogs")) {
      throw new Error("expected gp violation");
    }
  });

  test("passes clean numbers", () => {
    const result = runFinancialMathCheck({
      doc_type: "p_and_l",
      entity_name_on_doc: "x",
      periods: [
        {
          period_label: "FY2024",
          period_start: "2024-01-01",
          period_end: "2024-12-31",
          line_items: [],
          totals: { revenue_total: 1_000_000, cogs_total: 400_000, gross_profit: 600_000, opex_total: null, ebitda_reported: null, net_income: null },
        },
      ],
      math_check: { revenue_minus_cogs_equals_gp: null, opex_sum_matches_total: null, periods_sum_to_annual: null, issues: [] },
    });
    if (!result.ok) throw new Error(`expected ok but got ${JSON.stringify(result.violations)}`);
  });
});

/* ================================================================== */
/* Stage 4                                                             */
/* ================================================================== */

describe("assertComps", () => {
  test("accepts a valid comps output", () => {
    assertComps({
      ranked_comps: [
        { candidate_listing_id: "bbs_123", score: 85, rationale: "same industry, same state, sold 4 months ago", caveats: "smaller SDE", implied_multiple: 2.9, is_sold: true },
      ],
      aggregate: {
        n_comps_used: 1,
        implied_sde_multiple_median: 2.9,
        implied_sde_multiple_p25: 2.9,
        implied_sde_multiple_p75: 2.9,
        subject_multiple: 3.3,
        percentile_vs_peers: 75,
        takeaway: "Subject priced ~14% above its sole clean comp.",
      },
    });
  });

  test("rejects score out of range", () => {
    expectThrow(
      () => assertComps({
        ranked_comps: [{ candidate_listing_id: "x", score: 120, rationale: "x", caveats: "x", implied_multiple: 1, is_sold: false }],
        aggregate: { n_comps_used: 1, implied_sde_multiple_median: 1, implied_sde_multiple_p25: 1, implied_sde_multiple_p75: 1, subject_multiple: 1, percentile_vs_peers: 50, takeaway: "x" },
      }),
      "score must be 0-100",
    );
  });
});

/* ================================================================== */
/* Stage 5                                                             */
/* ================================================================== */

describe("assertSellerCall", () => {
  test("accepts a valid seller call synth", () => {
    assertSellerCall({
      answered_questions: [
        { question_id: "q1", answer_summary: "Top customer is 18% of revenue", answer_confidence: 0.8, seller_quote: "Our biggest account is about 18%." },
      ],
      new_facts: [],
      changed_facts: [],
      new_risks: [],
      new_questions: [],
      red_flags_from_call: [],
      seller_motivation_read: {
        primary_driver: "retirement",
        secondary_drivers: ["health"],
        timeline_pressure: "medium",
        price_flexibility_signal: "some",
      },
      rapport_notes: "Seller values continuity of employees above all.",
      updated_thesis_delta: {
        was_more_confident_in: ["customer mix"],
        am_less_confident_in: [],
        must_verify_next: ["lease assignability"],
      },
    });
  });

  test("rejects invalid motivation driver", () => {
    expectThrow(
      () => assertSellerCall({
        answered_questions: [],
        new_facts: [],
        changed_facts: [],
        new_risks: [],
        new_questions: [],
        red_flags_from_call: [],
        seller_motivation_read: { primary_driver: "bored", secondary_drivers: [], timeline_pressure: "low", price_flexibility_signal: "none" },
        rapport_notes: "x",
        updated_thesis_delta: { was_more_confident_in: [], am_less_confident_in: [], must_verify_next: [] },
      }),
      "primary_driver invalid",
    );
  });
});

/* ================================================================== */
/* Stage 6                                                             */
/* ================================================================== */

describe("assertVdrReview", () => {
  test("accepts valid VDR review", () => {
    assertVdrReview({
      readiness_score: 60,
      coverage_by_category: {
        financial:            { score: 80, present: ["d1"], missing: [] },
        customer:             { score: 40, present: [], missing: [{ item: "Top-20 customer list", criticality: "high", rationale: "needed to verify concentration" }] },
        operations:           { score: 50, present: [], missing: [] },
        legal:                { score: 50, present: [], missing: [] },
        hr_payroll:           { score: 50, present: [], missing: [] },
        real_estate_lease:    { score: 50, present: [], missing: [] },
        insurance:            { score: 50, present: [], missing: [] },
        it_systems:           { score: 50, present: [], missing: [] },
        regulatory_licensing: { score: 50, present: [], missing: [] },
      },
      red_flags_from_vdr_patterns: [],
      suggested_next_requests: [{ item: "Signed lease agreement", rationale: "peg lease cost", urgency: "this_week" }],
      quality_findings_in_present_docs: [],
    });
  });

  test("rejects missing category", () => {
    expectThrow(
      () => assertVdrReview({
        readiness_score: 50,
        coverage_by_category: {
          financial: { score: 50, present: [], missing: [] },
        },
        red_flags_from_vdr_patterns: [],
        suggested_next_requests: [],
        quality_findings_in_present_docs: [],
      }),
      "coverage_by_category.",
    );
  });
});

/* ================================================================== */
/* Stage 7                                                             */
/* ================================================================== */

describe("assertQofe", () => {
  test("accepts valid QofE output", () => {
    assertQofe({
      periods: [
        {
          period: "FY2024",
          reported_net_income: 200_000,
          reported_ebitda: 260_000,
          reported_sde: 360_000,
          adjustments: [
            { line_item: "depreciation", amount_add_back: 25_000, category: "non_cash", rationale: "standard D&A add-back", confidence: 0.95, source_line_ref: "P&L Line 22", user_decision_required: false, our_recommendation: "accept", recommended_partial_amount: null, reasoning_for_recommendation: "conventional" },
          ],
          adjusted_sde: 385_000,
          adjusted_ebitda: 285_000,
          adjusted_sde_margin_pct: 0.16,
          year_over_year_trend: "growing",
          composite_ttm_adjusted_sde: 385_000,
          quality_score: 85,
          quality_score_rationale: "docs support D&A; owner comp verified against tax return",
        },
      ],
      composite_ttm_adjusted_sde: 385_000,
      overall_quality_score: 82,
      overall_notes: "One add-back needs user decision",
    });
  });

  test("rejects bad category", () => {
    expectThrow(
      () => assertQofe({
        periods: [{
          period: "x",
          reported_net_income: 0, reported_ebitda: 0, reported_sde: 0,
          adjustments: [{ line_item: "x", amount_add_back: 1, category: "bogus_category", rationale: "x", confidence: 0.5, source_line_ref: "x", user_decision_required: false, our_recommendation: "accept", recommended_partial_amount: null, reasoning_for_recommendation: "x" }],
          adjusted_sde: 0, adjusted_ebitda: 0, adjusted_sde_margin_pct: 0,
          year_over_year_trend: "flat", composite_ttm_adjusted_sde: 0,
          quality_score: 50, quality_score_rationale: "x",
        }],
        composite_ttm_adjusted_sde: 0, overall_quality_score: 50, overall_notes: "x",
      }),
      "category invalid",
    );
  });
});

/* ================================================================== */
/* Stage 8                                                             */
/* ================================================================== */

describe("assertModelBuilder", () => {
  test("accepts 5 scenarios", () => {
    assertModelBuilder({
      schema_version: "1.0",
      base_assumptions: { operations: {}, structure: {}, returns: {} },
      scenarios: [
        { scenario_label: "status_quo",           display_name: "Status Quo",            narrative: "baseline", overrides: {}, created_by: "ai" },
        { scenario_label: "conservative_lender",  display_name: "Conservative",          narrative: "SBA stress", overrides: {}, created_by: "ai" },
        { scenario_label: "mgmt_led_growth",      display_name: "Mgmt growth",           narrative: "GM hire", overrides: {}, created_by: "ai" },
        { scenario_label: "aggressive_turnaround",display_name: "Aggressive turnaround", narrative: "repricing", overrides: {}, created_by: "ai" },
        { scenario_label: "exit_prep",            display_name: "Exit Prep",             narrative: "3yr hold", overrides: {}, created_by: "ai" },
      ],
      narrative_summary: "Reasonable spread of scenarios.",
    });
  });

  test("rejects wrong scenario count", () => {
    expectThrow(
      () => assertModelBuilder({
        schema_version: "1.0",
        base_assumptions: { operations: {}, structure: {}, returns: {} },
        scenarios: [
          { scenario_label: "status_quo", display_name: "x", narrative: "x", overrides: {}, created_by: "ai" },
        ],
        narrative_summary: "x",
      }),
      "scenarios must be array of 5",
    );
  });

  test("rejects duplicate scenario labels", () => {
    expectThrow(
      () => assertModelBuilder({
        schema_version: "1.0",
        base_assumptions: { operations: {}, structure: {}, returns: {} },
        scenarios: [
          { scenario_label: "status_quo",           display_name: "a", narrative: "a", overrides: {}, created_by: "ai" },
          { scenario_label: "status_quo",           display_name: "b", narrative: "b", overrides: {}, created_by: "ai" },
          { scenario_label: "mgmt_led_growth",      display_name: "c", narrative: "c", overrides: {}, created_by: "ai" },
          { scenario_label: "aggressive_turnaround",display_name: "d", narrative: "d", overrides: {}, created_by: "ai" },
          { scenario_label: "exit_prep",            display_name: "e", narrative: "e", overrides: {}, created_by: "ai" },
        ],
        narrative_summary: "x",
      }),
      "duplicate label",
    );
  });
});

/* ================================================================== */
/* Stage 9                                                             */
/* ================================================================== */

describe("assertLoi", () => {
  test("accepts a complete LOI", () => {
    assertLoi({
      rendered_loi_text: "This LOI is non-binding except for the exclusivity and confidentiality sections. Buyer and seller will each consult their own legal counsel before any binding document is signed.\n\n1. Parties\n2. Transaction Structure\n3. Purchase Price\n4. Assets\n5. Working Capital\n6. Contingencies\n7. DD Period\n8. Exclusivity\n9. Confidentiality\n10. Close\n11. Broker\n12. Expiration\n\n" + "Full text goes here. ".repeat(30),
      structured: {
        parties: { buyer_entity_placeholder: "[BUYER]", seller_entity_placeholder: "[SELLER]", target_business_name: "Acme Plumbing" },
        transaction_structure: "asset_purchase",
        purchase_price: {
          total: 1_200_000, cash_at_close: 1_000_000,
          seller_note: { amount: 200_000, term_months: 60, rate_pct: 8.0, first_payment_deferred_months: 24, amortization_type: "interest_only_then_balloon" },
          earnout: null,
          escrow: 50_000,
        },
        working_capital_target: "normalized 3-mo avg",
        assets_included: ["FF&E","goodwill","customer list"],
        assets_excluded: ["cash","AR > 60 days"],
        contingencies: ["SBA approval","satisfactory DD","lease assignment"],
        due_diligence_days: 45,
        exclusivity_days: 30,
        confidentiality_included: true,
        proposed_close_date: "2026-07-01",
        broker_commission_note: "Broker comm per existing listing agreement.",
        offer_expiration_date: "2026-05-01",
      },
      negotiation_notes_for_buyer: ["Hold firm on 30-day exclusivity"],
      legal_disclaimer: "This LOI is non-binding except for exclusivity and confidentiality.",
    });
  });

  test("rejects bad transaction_structure", () => {
    const good = validLoi();
    (good.structured as any).transaction_structure = "handshake";
    expectThrow(() => assertLoi(good), "transaction_structure invalid");
  });
});

/* ================================================================== */
/* Stage 10                                                            */
/* ================================================================== */

describe("assertIcMemo", () => {
  test("accepts a long memo", () => {
    assertIcMemo({
      memo_markdown: "# IC Memo\n\n" + "Lorem ipsum dolor sit amet. ".repeat(100),
      citations: [{ claim_paragraph_index: 1, claim_text: "Revenue grew 12%", source_fact_ids: ["f1"] }],
      confidence_by_section: { executive_summary: 0.9, historical_financials: 0.8 },
      still_unanswered_questions: ["What is the renewal rate on the top lease?"],
    });
  });

  test("rejects too-short memo", () => {
    expectThrow(
      () => assertIcMemo({
        memo_markdown: "short",
        citations: [],
        confidence_by_section: {},
        still_unanswered_questions: [],
      }),
      "memo_markdown required",
    );
  });
});

/* ================================================================== */
/* Stage 11                                                            */
/* ================================================================== */

describe("assertSanityCheck", () => {
  test("accepts a valid sanity check", () => {
    assertSanityCheck({
      stale_facts: [{ field_path: "financials.sde.adjusted.FY2024", age_days: 90, why_stale: "new monthly P&L uploaded since last QofE" }],
      new_comp_signals: [{ comp_listing_id: "bbs_999", signal: "sold at 2.3x SDE, same state" }],
      assumption_drift: [],
      suggested_actions: [{ action: "rerun_qofe", priority: "p1", rationale: "new P&L available" }],
    });
  });

  test("rejects unknown action", () => {
    expectThrow(
      () => assertSanityCheck({
        stale_facts: [],
        new_comp_signals: [],
        assumption_drift: [],
        suggested_actions: [{ action: "drop_a_bomb", priority: "p0", rationale: "x" }],
      }),
      "action invalid",
    );
  });
});

/* ================================================================== */

console.log(`\n${"─".repeat(60)}`);
console.log(`${passed + failed} tests — ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
process.exit(0);

/* ================================================================== */
/* Helpers                                                             */
/* ================================================================== */

function minimalInitial(): Record<string, unknown> {
  return {
    verdict: "pass",
    verdict_headline: "Below size threshold.",
    buy_box_fit_score: 20,
    buy_box_mismatches: ["too small"],
    snapshot: {
      industry_normalized: "unknown",
      geography: { city: "", state: "", msa_or_region: "" },
      headline_metrics: {
        asking_price: { value: null, confidence: 0, source_excerpt: "NOT_FOUND" },
        revenue: { value: null, confidence: 0, source_excerpt: "NOT_FOUND" },
        sde: { value: null, confidence: 0, source_excerpt: "NOT_FOUND" },
        sde_multiple: { value: null, confidence: 0, source_excerpt: "NOT_FOUND" },
      },
      employees: { value: null, confidence: 0, source_excerpt: "NOT_FOUND" },
      years_in_business: { value: null, confidence: 0, source_excerpt: "NOT_FOUND" },
      real_estate_included: { value: null, confidence: 0, source_excerpt: "NOT_FOUND" },
      seller_financing: { value: null, confidence: 0, source_excerpt: "NOT_FOUND" },
    },
    thesis_draft: { one_liner: "x", why_interesting: [], why_skeptical: [], key_unknowns: [] },
    risks: [{ category: "financial", severity: "low", summary: "x", evidence: "NOT_FOUND" }],
    questions_to_answer_before_loi: [{ category: "financials", priority: "p2", question: "x", rationale: "x" }],
    suggested_next_step: "pass_and_log_reason",
    estimated_time_to_loi_days: 0,
    analyst_confidence_overall: 0.3,
  };
}

function wellFormedInitialScreen() {
  return {
    verdict: "pursue",
    verdict_headline: "Profitable plumbing services, owner retiring.",
    buy_box_fit_score: 78,
    buy_box_mismatches: [],
    snapshot: {
      industry_normalized: "238220 — Plumbing, Heating, and Air-Conditioning Contractors",
      geography: { city: "Denver", state: "CO", msa_or_region: "Denver-Aurora-Lakewood" },
      headline_metrics: {
        asking_price: { value: 1_200_000, confidence: 0.95, source_excerpt: "Asking Price: $1,200,000" },
        revenue: { value: 2_400_000, confidence: 0.9, source_excerpt: "Revenue: $2,400,000" },
        sde: { value: 400_000, confidence: 0.9, source_excerpt: "Cash Flow: $400,000" },
        sde_multiple: { value: 3.0, confidence: 0.9, source_excerpt: "DERIVED from asking/SDE" },
      },
      employees: { value: 12, confidence: 0.9, source_excerpt: "12 employees" },
      years_in_business: { value: 28, confidence: 0.9, source_excerpt: "established 1998" },
      real_estate_included: { value: false, confidence: 0.9, source_excerpt: "no real estate" },
      seller_financing: { value: true, confidence: 0.8, source_excerpt: "seller open to financing" },
    },
    thesis_draft: {
      one_liner: "Established Denver plumbing company with owner-retirement motive.",
      why_interesting: ["reasonable multiple", "recession-resistant trade"],
      why_skeptical: ["customer concentration unknown"],
      key_unknowns: ["AR aging"],
    },
    risks: [
      { category: "concentration", severity: "medium", summary: "Top client mix unclear", evidence: "NOT_FOUND" },
    ],
    questions_to_answer_before_loi: [
      { category: "financials", priority: "p0", question: "Provide 3-year P&L", rationale: "baseline verification" },
    ],
    suggested_next_step: "request_cim",
    estimated_time_to_loi_days: 45,
    analyst_confidence_overall: 0.7,
  };
}

function validLoi() {
  return {
    rendered_loi_text: "This LOI is non-binding. " + "Full text goes here. ".repeat(30),
    structured: {
      parties: { buyer_entity_placeholder: "[BUYER]", seller_entity_placeholder: "[SELLER]", target_business_name: "Acme" },
      transaction_structure: "asset_purchase" as const,
      purchase_price: {
        total: 1_000_000, cash_at_close: 1_000_000,
        seller_note: null, earnout: null, escrow: 0,
      },
      working_capital_target: "normalized",
      assets_included: [], assets_excluded: [],
      contingencies: [],
      due_diligence_days: 30,
      exclusivity_days: 30,
      confidentiality_included: true,
      proposed_close_date: "2026-09-01",
      broker_commission_note: "x",
      offer_expiration_date: "2026-05-15",
    },
    negotiation_notes_for_buyer: [],
    legal_disclaimer: "This LOI is non-binding except for exclusivity and confidentiality.",
  };
}
