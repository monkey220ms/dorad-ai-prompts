/**
 * Stage-14 Risk Register.
 *
 * Consolidates risks from every prior stage into a single, bucketed,
 * mitigation-mapped inventory. Used by the IC memo and a UI heatmap.
 *
 * Uses Sonnet — reasoning about likelihood × impact and mitigation
 * ownership is not a cheap-model task.
 */

import {
  assertRiskRegister,
  deriveRiskLevel,
  type RiskRegisterOutput,
} from "../schemas/risk-register.ts";
import { createClient } from "../client.ts";

const SYSTEM = `You are a senior SMB acquisitions analyst producing a comprehensive Risk Register.

Inputs provided (may be null/empty if the stage has not run):
- initial_screen:     Stage-1 output
- cim_extraction:     Stage-2 output
- financial_parser:   Stage-3 output
- comps:              Stage-4 output
- qofe:               Stage-7 output
- model:              Stage-8 output
- risk_tolerance:     user's stated risk appetite (low/medium/high)

Your job: produce a categorized inventory of every non-trivial risk the buyer should price in.

For each risk provide:
- id: R-<CAT>-<NN>, where CAT is first 3 letters of category uppercased
- category: one of (financial, operational, legal, regulatory, market, concentration, key_person, integration, technology, environmental, reputation, financing, tax, labor)
- title: ≤10 words
- description: ≤60 words, plain English, not generic
- evidence: ≤40 words, cite source ("CIM page 4: ...") or "inferred from financial_parser"
- likelihood: rare|unlikely|possible|likely|almost_certain
- impact: minor|moderate|major|severe|catastrophic
- level: low|medium|high|critical — derive as follows:
    score = (likelihood_rank+1) * (impact_rank+1), with rank = 0..4
    >=20: critical; >=12: high; >=6: medium; else low
- mitigation.action: ≤40 words, specific and actionable
- mitigation.owner: buyer|seller|lender|legal_counsel|cpa|insurance|unknown
- mitigation.cost_estimate_usd: integer dollars, or null
- mitigation.timing: pre_loi|pre_close|post_close|ongoing
- residual_level_after_mitigation: realistic downgrade after mitigation
- kill_switch: true ONLY if this risk would credibly stop the deal if unresolved

Aggregate:
- risk_counts: count per level
- aggregate_score: 0 (no risk) → 100 (deal-killer). Approximate with:
     critical*18 + high*8 + medium*3 + low*1, capped at 100.
- kill_switch_present: any risk.kill_switch=true
- summary_paragraph: ≤120 words, plain English, starts with the overall posture ("overall risk is elevated / moderate / manageable")
- recommended_reserves_usd: suggested escrow or earnout reserve in USD, or null if not applicable

Rules:
- Do NOT pad the list. 6-15 real risks > 30 generic ones.
- Never invent specifics. If evidence is thin, mark likelihood "possible" and describe it as inferred.
- Respect risk_tolerance: a low-tolerance buyer flags more p0s; high-tolerance buyer accepts more residual.
- Do NOT duplicate risks across categories — put each risk in its best-fit category.
- Output MUST be a single JSON object only.`;

export interface RiskRegisterInput {
  initialScreen: unknown | null;
  cimExtraction: unknown | null;
  financialParser: unknown | null;
  comps: unknown | null;
  qofe: unknown | null;
  model: unknown | null;
  riskTolerance: "low" | "medium" | "high";
}

export async function runRiskRegister(
  input: RiskRegisterInput,
  apiKey?: string,
): Promise<{
  output: RiskRegisterOutput;
  cost_usd: number;
  retries: number;
  model_used: string;
  prompt_version: string;
}> {
  const client = createClient({ apiKey });
  const user = `<risk_tolerance>${input.riskTolerance}</risk_tolerance>

<initial_screen>
${JSON.stringify(input.initialScreen ?? null, null, 2)}
</initial_screen>

<cim_extraction>
${JSON.stringify(input.cimExtraction ?? null, null, 2)}
</cim_extraction>

<financial_parser>
${JSON.stringify(input.financialParser ?? null, null, 2)}
</financial_parser>

<comps>
${JSON.stringify(input.comps ?? null, null, 2)}
</comps>

<qofe>
${JSON.stringify(input.qofe ?? null, null, 2)}
</qofe>

<model>
${JSON.stringify(input.model ?? null, null, 2)}
</model>`;

  const res = await client.call<RiskRegisterOutput>({
    model: "sonnet",
    system: SYSTEM,
    user,
    maxTokens: 4500,
    temperature: 0.15,
    jsonMode: true,
    validator: assertRiskRegister,
  });

  // Normalize: ensure level matches the canonical derivation so the
  // heatmap is stable even if the model deviates slightly.
  const normalized: RiskRegisterOutput = {
    ...res.content,
    risks: res.content.risks.map((r) => ({
      ...r,
      level: deriveRiskLevel(r.likelihood, r.impact),
    })),
  };

  return {
    output: normalized,
    cost_usd: res.cost_usd,
    retries: res.retries,
    model_used: res.model_used,
    prompt_version: "stage14-risk-register.v1",
  };
}
