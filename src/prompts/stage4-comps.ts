/**
 * Stage-4 Comparable Deals Finder.
 *
 * SQL pulls candidate comps; this prompt ranks/annotates them relative
 * to the subject deal snapshot and produces an aggregate read.
 */

import { assertComps, type CompsOutput } from "../schemas/comps.ts";
import type { InitialScreenOutput } from "../schemas/initial-screen.ts";
import { createClient } from "../client.ts";

const SYSTEM = `You are ranking and annotating comparable business sales for an SMB acquisition analysis.

Input:
- subject_snapshot: the current deal snapshot
- candidates: array of candidate listings from the same industry/size band/geo (already pre-filtered by SQL)

For each candidate, score 0-100 on comparability based on:
- Industry fit     (40 pts) — exact NAICS > parent category > adjacent.
- Size fit         (25 pts) — SDE ratio to subject; 1.0x = full marks, degrade as it moves away.
- Geography fit    (15 pts) — same MSA > same state > same region > other.
- Recency          (10 pts) — <6 mo full marks, degrade linearly to 24 mo.
- Data quality     (10 pts) — more disclosed fields = higher.

Return top 15 (or fewer if pool is small / low quality), each with:
{
  "candidate_listing_id": "...",
  "score": 0-100,
  "rationale":       "≤30 words on why this is a useful comp",
  "caveats":         "≤30 words on why this may NOT be a clean comp",
  "implied_multiple": number | null,          // asking_price / SDE
  "is_sold":          boolean                 // true if the candidate shows a close price / sold status
}

Also return aggregate summary:
{
  "n_comps_used": 15,
  "implied_sde_multiple_median": 3.1,
  "implied_sde_multiple_p25":    2.4,
  "implied_sde_multiple_p75":    3.8,
  "subject_multiple":            3.5,
  "percentile_vs_peers":         60,
  "takeaway": "≤40 words; e.g. 'Subject priced 15% above median for industry/size/geo — justifiable if growth story holds, expensive if not.'"
}

Full output schema:
{
  "ranked_comps": [ ... ],
  "aggregate":    { ... }
}

Rules:
- Do NOT invent listings. Only use candidate_listing_ids present in the input.
- If the candidate pool is empty, return ranked_comps=[] and aggregate with n_comps_used=0, nulls elsewhere, and a takeaway explaining the lack of comps.
- If any candidate lacks asking_price or SDE, implied_multiple=null.

Output JSON only.`;

export interface CompsInput {
  subjectSnapshot: InitialScreenOutput["snapshot"];
  subjectMultiple: number | null;
  candidates: Array<{
    listing_id: string;
    industry: string | null;
    city: string | null;
    state: string | null;
    asking_price: number | null;
    sde: number | null;
    revenue: number | null;
    year_listed: string | null;
    is_sold: boolean;
    months_since_listed: number | null;
  }>;
}

export async function rankComps(
  input: CompsInput,
  apiKey?: string,
): Promise<{
  output: CompsOutput;
  cost_usd: number;
  retries: number;
  model_used: string;
  prompt_version: string;
}> {
  const client = createClient({ apiKey });
  const user = `<subject_snapshot>
${JSON.stringify(input.subjectSnapshot, null, 2)}
</subject_snapshot>

<subject_multiple>${input.subjectMultiple ?? "null"}</subject_multiple>

<candidates>
${JSON.stringify(input.candidates, null, 2)}
</candidates>`;
  const res = await client.call<CompsOutput>({
    model: "sonnet",
    system: SYSTEM,
    user,
    maxTokens: 4000,
    temperature: 0.2,
    jsonMode: true,
    validator: assertComps,
  });
  return {
    output: res.content,
    cost_usd: res.cost_usd,
    retries: res.retries,
    model_used: res.model_used,
    prompt_version: STAGE_4_PROMPT_VERSION,
  };
}

export const STAGE_4_PROMPT_VERSION = "stage4.v1.0";
