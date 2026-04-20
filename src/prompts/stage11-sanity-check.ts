/**
 * Stage-11 Per-Deal Nightly Sanity Check.
 *
 * Cheap Haiku pass. Runs daily for all active deals. Catches stale facts,
 * silently-changed assumptions, or new comp signals that should prompt a
 * user review.
 */

import {
  assertSanityCheck,
  type SanityCheckOutput,
} from "../schemas/sanity-check.ts";
import type { InitialScreenOutput } from "../schemas/initial-screen.ts";
import { createClient } from "../client.ts";

const SYSTEM = `You are doing a nightly sanity check on an active SMB acquisition deal.

Input:
- snapshot:          current deal snapshot
- extracted_facts:   [{field_path, value, last_updated_at, confidence}]
- recent_comps:      comparable deals from Dorad's dataset that traded / listed in the last 30 days (may be empty)
- assumption_deltas: assumption-level diffs since the last sanity check (may be empty)
- today:             ISO date for "now"

Output:
{
  "stale_facts": [
    { "field_path": "...", "age_days": 45, "why_stale": "≤25 words — e.g. 'CIM extracted >60 days ago while AR aging shifted'" }
  ],
  "new_comp_signals": [
    { "comp_listing_id": "...", "signal": "≤30 words — e.g. 'traded 20% below asking in same industry/geo'" }
  ],
  "assumption_drift": [
    { "field_path": "...", "old_version_value": 0, "current_value": 0, "change_rationale_provided": true|false }
  ],
  "suggested_actions": [
    { "action":  "refresh_cim_extraction"|"ask_new_question"|"rerun_comps"|"flag_for_user_review"|"rerun_qofe"|"rerun_model"|"no_action_needed",
      "priority":"p0"|"p1"|"p2",
      "rationale":"≤30 words" }
  ]
}

Rules:
- Flag a fact as stale only if its age_days > 30 AND newer evidence exists (newer upload, newer comp, newer assumption). If age > 90 and fact is load-bearing (revenue, SDE, lease, customer concentration), flag regardless.
- Comp signals must cite the comp_listing_id; do not invent.
- If nothing needs attention, return all arrays empty except suggested_actions=[{"action":"no_action_needed","priority":"p2","rationale":"quiet day"}].

Output JSON only.`;

export interface SanityCheckInput {
  snapshot: InitialScreenOutput["snapshot"];
  extractedFacts: Array<{
    field_path: string;
    value: number | string | boolean | null;
    last_updated_at: string; // ISO
    confidence: number;
  }>;
  recentComps: Array<{
    listing_id: string;
    industry: string | null;
    state: string | null;
    asking_price: number | null;
    sde: number | null;
    is_sold: boolean;
    status_changed_at: string;
    delta_pct_vs_asking: number | null;
  }>;
  assumptionDeltas: Array<{
    field_path: string;
    old_value: number | string | boolean | null;
    new_value: number | string | boolean | null;
    change_rationale_provided: boolean;
    changed_at: string;
  }>;
  today: string; // YYYY-MM-DD
}

export async function runNightlySanityCheck(
  input: SanityCheckInput,
  apiKey?: string,
): Promise<{
  output: SanityCheckOutput;
  cost_usd: number;
  retries: number;
  model_used: string;
  prompt_version: string;
}> {
  const client = createClient({ apiKey });
  const user = `<today>${input.today}</today>

<snapshot>
${JSON.stringify(input.snapshot, null, 2)}
</snapshot>

<extracted_facts>
${JSON.stringify(input.extractedFacts, null, 2)}
</extracted_facts>

<recent_comps>
${JSON.stringify(input.recentComps, null, 2)}
</recent_comps>

<assumption_deltas>
${JSON.stringify(input.assumptionDeltas, null, 2)}
</assumption_deltas>`;
  const res = await client.call<SanityCheckOutput>({
    model: "haiku",
    system: SYSTEM,
    user,
    maxTokens: 1500,
    temperature: 0.1,
    jsonMode: true,
    validator: assertSanityCheck,
  });
  return {
    output: res.content,
    cost_usd: res.cost_usd,
    retries: res.retries,
    model_used: res.model_used,
    prompt_version: STAGE_11_PROMPT_VERSION,
  };
}

export const STAGE_11_PROMPT_VERSION = "stage11.v1.0";
