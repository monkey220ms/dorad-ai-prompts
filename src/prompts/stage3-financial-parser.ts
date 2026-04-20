/**
 * Stage-3 Financial Statement Parser.
 *
 * Parses a P&L / tax return / bank statement / balance sheet into
 * period-aligned line items with canonical-name mapping.
 *
 * Always paired with runFinancialMathCheck() (deterministic post-processor).
 */

import {
  assertFinancialParser,
  runFinancialMathCheck,
  type FinancialParserOutput,
  type ParsedDocType,
  type FinancialMathCheckResult,
} from "../schemas/financial-parser.ts";
import { createClient } from "../client.ts";

// re-export for callers that only import this prompt module
export { runFinancialMathCheck } from "../schemas/financial-parser.ts";
export type { FinancialMathCheckResult } from "../schemas/financial-parser.ts";

const SYSTEM = `You are parsing a financial document into a structured period series.

Input doc types you may see (use the provided hint):
- p_and_l        (monthly, quarterly, or annual)
- balance_sheet
- tax_return     (Form 1120, 1120-S, 1065, Schedule C)
- bank_statement (monthly)

Output schema:
{
  "doc_type": "p_and_l" | "balance_sheet" | "tax_return" | "bank_statement",
  "entity_name_on_doc": "string",
  "periods": [
    {
      "period_label": "Jan 2024" | "FY2023" | "Q3 2024",
      "period_start": "YYYY-MM-DD" | null,
      "period_end":   "YYYY-MM-DD" | null,
      "line_items": [
        {
          "canonical_name": "revenue" | "cogs" | "gross_profit" | "rent" | "payroll" | "officer_comp" | "depreciation" | "amortization" | "interest" | "owner_distributions" | "meals_entertainment" | "vehicle" | "travel" | "professional_fees" | "insurance_health" | "insurance_liability" | "utilities" | "marketing" | "software" | "repairs_maintenance" | "taxes_non_income" | "supplies" | "bank_fees" | "other_opex" | "other_income" | "other_expense" | "net_income" | "ebitda_reported" | "opex_total" | "<original_label_if_no_match>",
          "doc_line_name": "exact label from document",
          "amount": number | null,
          "is_addback_candidate": boolean,
          "confidence": 0.0-1.0,
          "source_excerpt": "≤20 words verbatim"
        }
      ],
      "totals": {
        "revenue_total":  number | null,
        "cogs_total":     number | null,
        "gross_profit":   number | null,
        "opex_total":     number | null,
        "ebitda_reported":number | null,
        "net_income":     number | null
      }
    }
  ],
  "math_check": {
    "revenue_minus_cogs_equals_gp": true | false | null,
    "opex_sum_matches_total":       true | false | null,
    "periods_sum_to_annual":        true | false | null,
    "issues": ["string"]
  }
}

Canonical-name mapping rules (map common synonyms to the canonical_name):
- "Sales", "Total Revenue", "Gross Receipts", "Fees Earned" → revenue
- "Cost of Goods Sold", "Cost of Sales", "Direct Costs" → cogs
- "Rent", "Lease Expense", "Occupancy" → rent
- "Salaries", "Wages", "Payroll", "Employee Compensation" → payroll
- "Officer Compensation", "Owner Salary", "Shareholder Compensation" → officer_comp
- "Depreciation", "Depn" → depreciation
- "Amortization" → amortization
- "Interest Expense", "Int. Exp." → interest
- "Distributions", "Owner Draws", "Shareholder Distributions" → owner_distributions
- "Meals & Entertainment", "Meals", "M&E" → meals_entertainment
- "Auto", "Vehicle", "Car Expense" → vehicle
- "Travel" → travel
- "Professional Fees", "Legal & Accounting" → professional_fees
- "Insurance - Health" → insurance_health
- "Insurance - Liability" → insurance_liability
- "Utilities", "Electric", "Gas", "Water" → utilities
- "Marketing", "Advertising" → marketing
- "Software", "SaaS", "Subscriptions" → software
- "Repairs", "Maintenance" → repairs_maintenance
- "Payroll Taxes", "Business Taxes" (NOT income tax) → taxes_non_income

If no canonical match, emit the doc label verbatim as canonical_name (pipeline will treat as other_opex).

Mark is_addback_candidate=true for:
- officer_comp (likely above market)
- owner_distributions
- personal vehicle / meals / travel (when amounts suggest personal use)
- insurance_health (if owner-only)
- one-time legal fees
- depreciation (non-cash)
- amortization (non-cash)
- interest (being re-leveraged by buyer)

Never guess amounts. If a cell is blurred/illegible, set amount=null, confidence=0.

Output JSON only.`;

export interface FinancialParserInput {
  docTypeHint: ParsedDocType;
  documentText: string;
  filename?: string;
}

export async function parseFinancialDoc(
  input: FinancialParserInput,
  apiKey?: string,
): Promise<{
  output: FinancialParserOutput;
  post_check: FinancialMathCheckResult;
  cost_usd: number;
  retries: number;
  model_used: string;
  prompt_version: string;
}> {
  const client = createClient({ apiKey });
  const user = `<doc_type_hint>${input.docTypeHint}</doc_type_hint>
${input.filename ? `<filename>${input.filename}</filename>\n` : ""}<document>
${input.documentText}
</document>`;
  const res = await client.call<FinancialParserOutput>({
    model: "sonnet",
    system: SYSTEM,
    user,
    maxTokens: 6000,
    temperature: 0.1,
    jsonMode: true,
    validator: assertFinancialParser,
  });
  const post_check = runFinancialMathCheck(res.content);
  return {
    output: res.content,
    post_check,
    cost_usd: res.cost_usd,
    retries: res.retries,
    model_used: res.model_used,
    prompt_version: STAGE_3_PROMPT_VERSION,
  };
}

export const STAGE_3_PROMPT_VERSION = "stage3.v1.0";

/* Deterministic post-processor (runFinancialMathCheck) lives in the schema
 * file so it can be imported without pulling in the Anthropic SDK. */
