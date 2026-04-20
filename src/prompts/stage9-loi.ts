/**
 * Stage-9 LOI (Letter of Intent) Drafter.
 *
 * Produces a non-binding LOI as BOTH rendered text and structured JSON, with
 * negotiation notes for the buyer. Always flags that counsel must review
 * before any binding document is signed.
 */

import { assertLoi, type LoiOutput } from "../schemas/loi.ts";
import type { InitialScreenOutput } from "../schemas/initial-screen.ts";
import { createClient } from "../client.ts";

const SYSTEM = `You are drafting a non-binding Letter of Intent (LOI) for a small business acquisition.

CRITICAL LEGAL DISCLAIMER TO INCLUDE AT THE TOP of rendered_loi_text AND in the legal_disclaimer field:
"This LOI is non-binding except for the exclusivity and confidentiality sections. Buyer and seller will each consult their own legal counsel before any binding document is signed."

Structure the LOI with these standard sections:
 1. Parties
 2. Proposed Transaction Structure (asset vs stock purchase vs membership interest)
 3. Purchase Price + payment mechanics (cash at close, seller note, earnout, escrow)
 4. Assets Included / Excluded
 5. Working Capital Target (peg method)
 6. Contingencies (financing, DD, landlord consent, licenses, customer consent if material)
 7. Due Diligence Period (days)
 8. Exclusivity / No-Shop (days, typically 30-45)
 9. Confidentiality
10. Proposed Close Date + conditions
11. Broker / Commission language (reference existing listing agreement; do not bind)
12. Expiration of Offer

User inputs you will be given:
- snapshot: current deal snapshot (price anchor, SDE, working capital)
- offer_strategy: "anchor_low_with_room" | "market" | "aggressive_above_asking_conditional"
- financing_plan:  SBA 7(a) + seller note terms OR cash OR other
- risk_items:      risks that should become contingencies
- user_prefs:      { proposed_close_date, exclusivity_days, due_diligence_days, total_cash_available_for_close, buyer_entity_placeholder }

Output JSON with BOTH rendered text and structured representation:
{
  "rendered_loi_text": "...full plain-text LOI...",
  "structured": {
    "parties": {
      "buyer_entity_placeholder": "[BUYER ENTITY TBD]",
      "seller_entity_placeholder":"[SELLER ENTITY TBD]",
      "target_business_name": "..."
    },
    "transaction_structure": "asset_purchase"|"stock_purchase"|"membership_interest_purchase",
    "purchase_price": {
      "total": 0,
      "cash_at_close": 0,
      "seller_note": null | {
        "amount": 0,
        "term_months": 0,
        "rate_pct": 0,
        "first_payment_deferred_months": 0,
        "amortization_type": "standard"|"interest_only_then_balloon"|"balloon"
      },
      "earnout": null | {
        "max_amount": 0,
        "metric": "revenue"|"ebitda"|"sde"|"customer_retention",
        "hurdle": "string",
        "payout_schedule": "string"
      },
      "escrow": 0
    },
    "working_capital_target": "normalized 3-mo avg",
    "assets_included": ["FF&E", "inventory", "customer list", "goodwill"],
    "assets_excluded": ["cash", "AR > 60 days", "owner's personal vehicle"],
    "contingencies": ["SBA financing approval", "lease assignment", "satisfactory DD", "licensing transfer"],
    "due_diligence_days": 45,
    "exclusivity_days": 30,
    "confidentiality_included": true,
    "proposed_close_date": "YYYY-MM-DD",
    "broker_commission_note": "...",
    "offer_expiration_date": "YYYY-MM-DD"
  },
  "negotiation_notes_for_buyer": [
    "what to hold firm on",
    "what's a tradeable concession",
    "traps to avoid"
  ],
  "legal_disclaimer": "..."
}

Rules:
- Do not draft binding legal language that the user's attorney hasn't reviewed. Keep tone professional, concise, not aggressive.
- Use bracketed placeholders where user input is still pending ([SELLER ENTITY NAME], [COUNSEL TO BE NAMED], etc.).
- rendered_loi_text MUST be at least 600 words and include every numbered section above.
- Preface rendered_loi_text with the legal disclaimer.

Output JSON only.`;

export interface LoiInput {
  snapshot: InitialScreenOutput["snapshot"];
  offerStrategy: "anchor_low_with_room" | "market" | "aggressive_above_asking_conditional";
  financingPlan: string; // free text, e.g. "SBA 7(a) 10yr + $200K seller note 12% IO 24mo"
  riskItemsForContingencies: string[];
  userPrefs: {
    proposed_close_date: string; // YYYY-MM-DD
    exclusivity_days: number;
    due_diligence_days: number;
    total_cash_available_for_close: number;
    buyer_entity_placeholder: string;
  };
  assumedPrice: number;
  assumedSde: number | null;
}

export async function draftLoi(
  input: LoiInput,
  apiKey?: string,
): Promise<{
  output: LoiOutput;
  cost_usd: number;
  retries: number;
  model_used: string;
  prompt_version: string;
}> {
  const client = createClient({ apiKey });
  const user = `<snapshot>
${JSON.stringify(input.snapshot, null, 2)}
</snapshot>

<offer_strategy>${input.offerStrategy}</offer_strategy>
<financing_plan>${input.financingPlan}</financing_plan>
<assumed_price>${input.assumedPrice}</assumed_price>
<assumed_sde>${input.assumedSde ?? "null"}</assumed_sde>

<risk_items>
${JSON.stringify(input.riskItemsForContingencies, null, 2)}
</risk_items>

<user_prefs>
${JSON.stringify(input.userPrefs, null, 2)}
</user_prefs>`;
  const res = await client.call<LoiOutput>({
    model: "opus",
    system: SYSTEM,
    user,
    maxTokens: 6000,
    temperature: 0.2,
    jsonMode: true,
    validator: assertLoi,
  });
  return {
    output: res.content,
    cost_usd: res.cost_usd,
    retries: res.retries,
    model_used: res.model_used,
    prompt_version: STAGE_9_PROMPT_VERSION,
  };
}

export const STAGE_9_PROMPT_VERSION = "stage9.v1.0";
