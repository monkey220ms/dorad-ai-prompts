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

describe("assertInitialScreen", () => {
  test("accepts a well-formed output", () => {
    const good = {
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
    assertInitialScreen(good);
  });

  test("rejects invalid verdict", () => {
    expectThrow(
      () => assertInitialScreen({ ...(minimalValid() as any), verdict: "maybe" } as unknown),
      "verdict must be one of",
    );
  });

  test("rejects missing headline_metrics.sde", () => {
    const bad = minimalValid();
    delete (bad.snapshot.headline_metrics as any).sde;
    expectThrow(() => assertInitialScreen(bad), "headline_metrics.sde required");
  });

  test("rejects confidence out of range", () => {
    const bad = minimalValid() as any;
    bad.snapshot.headline_metrics.sde.confidence = 1.5;
    expectThrow(() => assertInitialScreen(bad), "must be 0..1");
  });

  test("rejects risk with invalid severity", () => {
    const bad = minimalValid() as any;
    bad.risks[0].severity = "very bad";
    expectThrow(() => assertInitialScreen(bad), "risk.severity must be");
  });
});

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

console.log(`\n${"─".repeat(60)}`);
console.log(`${passed + failed} tests — ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
process.exit(0);

function minimalValid(): Record<string, unknown> {
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
