/**
 * Stage-3 Financial Statement Parser schema.
 *
 * Paired with a deterministic post-processor (see runFinancialMathCheck
 * exported from stage3-financial-parser.ts).
 */

export const CANONICAL_LINE_ITEMS = [
  "revenue",
  "cogs",
  "gross_profit",
  "rent",
  "payroll",
  "officer_comp",
  "depreciation",
  "amortization",
  "interest",
  "owner_distributions",
  "meals_entertainment",
  "vehicle",
  "travel",
  "professional_fees",
  "insurance_health",
  "insurance_liability",
  "utilities",
  "marketing",
  "software",
  "repairs_maintenance",
  "taxes_non_income",
  "supplies",
  "bank_fees",
  "other_opex",
  "other_income",
  "other_expense",
  "net_income",
  "ebitda_reported",
  "opex_total",
] as const;
export type CanonicalLineItem = (typeof CANONICAL_LINE_ITEMS)[number];

export const ALLOWED_PARSED_DOC_TYPES = [
  "p_and_l",
  "balance_sheet",
  "tax_return",
  "bank_statement",
] as const;
export type ParsedDocType = (typeof ALLOWED_PARSED_DOC_TYPES)[number];

export interface FinancialLineItem {
  canonical_name: CanonicalLineItem | string; // permissive for unmapped rows
  doc_line_name: string;
  amount: number | null;
  is_addback_candidate: boolean;
  confidence: number;
  source_excerpt: string;
}

export interface FinancialPeriod {
  period_label: string;
  period_start: string | null;
  period_end: string | null;
  line_items: FinancialLineItem[];
  totals: {
    revenue_total: number | null;
    cogs_total: number | null;
    gross_profit: number | null;
    opex_total: number | null;
    ebitda_reported: number | null;
    net_income: number | null;
  };
}

export interface FinancialParserOutput {
  doc_type: ParsedDocType;
  entity_name_on_doc: string;
  periods: FinancialPeriod[];
  math_check: {
    revenue_minus_cogs_equals_gp: boolean | null;
    opex_sum_matches_total: boolean | null;
    periods_sum_to_annual: boolean | null;
    issues: string[];
  };
}

export function assertFinancialParser(obj: unknown): asserts obj is FinancialParserOutput {
  const o = obj as Record<string, unknown>;
  if (!o) throw new Error("empty response");
  if (!ALLOWED_PARSED_DOC_TYPES.includes(o.doc_type as ParsedDocType)) {
    throw new Error(`doc_type must be one of ${ALLOWED_PARSED_DOC_TYPES.join(", ")}`);
  }
  if (typeof o.entity_name_on_doc !== "string") {
    throw new Error("entity_name_on_doc must be a string");
  }
  if (!Array.isArray(o.periods) || o.periods.length === 0) {
    throw new Error("periods must be non-empty array");
  }
  for (const [i, p0] of (o.periods as Array<Record<string, unknown>>).entries()) {
    if (typeof p0.period_label !== "string") {
      throw new Error(`periods[${i}].period_label required`);
    }
    if (!Array.isArray(p0.line_items)) {
      throw new Error(`periods[${i}].line_items must be array`);
    }
    for (const [j, li0] of (p0.line_items as Array<Record<string, unknown>>).entries()) {
      if (typeof li0.canonical_name !== "string") {
        throw new Error(`periods[${i}].line_items[${j}].canonical_name required`);
      }
      if (typeof li0.doc_line_name !== "string") {
        throw new Error(`periods[${i}].line_items[${j}].doc_line_name required`);
      }
      if (li0.amount !== null && typeof li0.amount !== "number") {
        throw new Error(`periods[${i}].line_items[${j}].amount must be number|null`);
      }
      if (typeof li0.is_addback_candidate !== "boolean") {
        throw new Error(`periods[${i}].line_items[${j}].is_addback_candidate must be boolean`);
      }
      if (typeof li0.confidence !== "number" || li0.confidence < 0 || li0.confidence > 1) {
        throw new Error(`periods[${i}].line_items[${j}].confidence must be 0..1`);
      }
    }
    if (!p0.totals || typeof p0.totals !== "object") {
      throw new Error(`periods[${i}].totals required`);
    }
  }
  if (!o.math_check || typeof o.math_check !== "object") {
    throw new Error("math_check required");
  }
  const mc = o.math_check as Record<string, unknown>;
  if (!Array.isArray(mc.issues)) throw new Error("math_check.issues must be array");
}

/* ------------------------------------------------------------------ */
/* Deterministic post-processor                                        */
/* ------------------------------------------------------------------ */

export interface FinancialMathCheckResult {
  ok: boolean;
  violations: Array<{
    period_label: string;
    check:
      | "gp_equals_rev_minus_cogs"
      | "opex_sum_matches_total"
      | "monthly_sum_vs_annual"
      | "tax_vs_pnl_mismatch";
    expected: number;
    got: number;
    abs_delta: number;
    pct_delta: number;
    tolerance_pct: number;
  }>;
  new_questions_to_raise: string[];
}

export function runFinancialMathCheck(parsed: FinancialParserOutput): FinancialMathCheckResult {
  const violations: FinancialMathCheckResult["violations"] = [];
  const questions: string[] = [];

  for (const p of parsed.periods) {
    const t = p.totals;

    // 1. gross_profit ≈ revenue - cogs (1% tolerance)
    if (t.revenue_total != null && t.cogs_total != null && t.gross_profit != null) {
      const expected = t.revenue_total - t.cogs_total;
      if (!approx(expected, t.gross_profit, 0.01)) {
        violations.push({
          period_label: p.period_label,
          check: "gp_equals_rev_minus_cogs",
          expected,
          got: t.gross_profit,
          abs_delta: Math.abs(expected - t.gross_profit),
          pct_delta: pctDelta(expected, t.gross_profit),
          tolerance_pct: 0.01,
        });
        questions.push(
          `${p.period_label}: Gross profit does not match revenue minus COGS. Please clarify.`,
        );
      }
    }

    // 2. sum(opex_line_items) ≈ opex_total (1% tolerance)
    if (t.opex_total != null) {
      const opexLineSum = sumOpexLines(p);
      if (opexLineSum !== null && !approx(opexLineSum, t.opex_total, 0.01)) {
        violations.push({
          period_label: p.period_label,
          check: "opex_sum_matches_total",
          expected: opexLineSum,
          got: t.opex_total,
          abs_delta: Math.abs(opexLineSum - t.opex_total),
          pct_delta: pctDelta(opexLineSum, t.opex_total),
          tolerance_pct: 0.01,
        });
        questions.push(
          `${p.period_label}: Opex line items do not sum to total — probable missed line. Please clarify.`,
        );
      }
    }
  }

  // 3. monthly sums vs annual (when multiple periods present and one annual present)
  const annuals = parsed.periods.filter(
    (p) => /^FY\d{4}$|^\d{4}$|annual/i.test(p.period_label),
  );
  const monthlies = parsed.periods.filter(
    (p) => /^(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)/i.test(p.period_label),
  );
  if (annuals.length === 1 && monthlies.length >= 6) {
    const annualRevTotal = annuals[0].totals.revenue_total;
    const monthlyRevSum = monthlies
      .map((p) => p.totals.revenue_total ?? 0)
      .reduce((a, b) => a + b, 0);
    if (
      annualRevTotal != null &&
      monthlyRevSum > 0 &&
      !approx(annualRevTotal, monthlyRevSum, 0.02)
    ) {
      violations.push({
        period_label: annuals[0].period_label,
        check: "monthly_sum_vs_annual",
        expected: annualRevTotal,
        got: monthlyRevSum,
        abs_delta: Math.abs(annualRevTotal - monthlyRevSum),
        pct_delta: pctDelta(annualRevTotal, monthlyRevSum),
        tolerance_pct: 0.02,
      });
      questions.push(
        `${annuals[0].period_label}: Sum of monthly revenue does not match annual total. Please clarify.`,
      );
    }
  }

  return {
    ok: violations.length === 0,
    violations,
    new_questions_to_raise: questions,
  };
}

function sumOpexLines(p: FinancialPeriod): number | null {
  const excluded = new Set([
    "revenue",
    "cogs",
    "gross_profit",
    "net_income",
    "ebitda_reported",
    "opex_total",
    "other_income",
  ]);
  let sum = 0;
  let any = false;
  for (const li of p.line_items) {
    if (li.amount == null) continue;
    if (excluded.has(li.canonical_name as string)) continue;
    sum += li.amount;
    any = true;
  }
  return any ? sum : null;
}

function approx(a: number, b: number, tol: number): boolean {
  if (a === 0 && b === 0) return true;
  const base = Math.max(Math.abs(a), Math.abs(b));
  if (base === 0) return true;
  return Math.abs(a - b) / base <= tol;
}

function pctDelta(expected: number, got: number): number {
  if (expected === 0) return got === 0 ? 0 : 1;
  return (got - expected) / expected;
}
