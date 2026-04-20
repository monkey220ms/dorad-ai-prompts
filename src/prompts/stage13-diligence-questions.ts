/**
 * Stage-13 Diligence Question Generator.
 *
 * Given the current deal state (prior stage outputs) generates a
 * prioritized, categorized diligence question pack the buyer can
 * send to broker/seller. Also drafts a one-paste broker email.
 *
 * Uses Sonnet — needs to reason about coverage gaps and what's
 * load-bearing; Haiku misses nuance here.
 */

import {
  assertDiligenceQuestions,
  type DiligenceQuestionsOutput,
} from "../schemas/diligence-questions.ts";
import { createClient } from "../client.ts";

const SYSTEM = `You are a senior SMB acquisitions analyst producing a prioritized diligence question pack.

Inputs provided (any may be null/empty if that stage has not run):
- initial_screen:     Stage-1 output
- cim_extraction:     Stage-2 output
- financial_parser:   Stage-3 output
- comps:              Stage-4 output
- qofe:               Stage-7 output
- model:              Stage-8 output
- already_asked:      questions asked in prior rounds (may be empty)
- today:              ISO date

Your job:
1. Identify UNANSWERED and LOAD-BEARING facts.
2. Write specific, answerable questions targeted at the most efficient channel.
3. Rank by: (a) blocks_loi, (b) priority p0>p1>p2, (c) category ordering.
4. Produce a broker_email_draft compiling only the p0 items as a polite paste-ready email.

Priority definitions:
  p0 = cannot issue LOI without answer (blocks_loi=true usually).
  p1 = should have before LOI but can be handled in diligence period.
  p2 = nice-to-know; polish.

Channel definitions:
  broker_email       short text answer broker can relay
  management_meeting requires seller/operator to explain
  vdr_request        need a document (tax return, lease, contract)
  cpa_review         needs accountant's book review
  legal_counsel      attorney review required
  onsite_visit       observable only in person
  third_party_report Phase I environmental, insurance quote, title search, etc.

Rules:
- Do NOT repeat questions in already_asked.
- Every question must reference_prior_finding when it's resolving a specific gap from earlier stages (use the field_path or stage name; else null).
- Avoid generic boilerplate; every question must be grounded in the deal's specifics when possible.
- If working-capital peg, customer concentration, owner add-back, or lease assignability is missing, they become automatic p0.
- Total questions: target 10-20. Quality over quantity.
- ID format: Q-<CAT>-<NN>, where CAT is a 3-letter category abbreviation (FIN, TAX, CST, OPS, LGL, etc.) and NN is zero-padded.
- recommendation_pause_loi = true when 3 or more blocks_loi items are present.
- broker_email_draft: courteous, names the deal only if present, lists p0 items as numbered bullets, closes asking for targets on response. ≤300 words.

Output MUST be a single JSON object only.`;

export interface DiligenceQuestionsInput {
  initialScreen: unknown | null;
  cimExtraction: unknown | null;
  financialParser: unknown | null;
  comps: unknown | null;
  qofe: unknown | null;
  model: unknown | null;
  alreadyAsked: Array<{ id: string; question: string; resolved: boolean }>;
  today: string;
}

export async function runDiligenceQuestions(
  input: DiligenceQuestionsInput,
  apiKey?: string,
): Promise<{
  output: DiligenceQuestionsOutput;
  cost_usd: number;
  retries: number;
  model_used: string;
  prompt_version: string;
}> {
  const client = createClient({ apiKey });
  const user = `<today>${input.today}</today>

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
</model>

<already_asked>
${JSON.stringify(input.alreadyAsked, null, 2)}
</already_asked>`;

  const res = await client.call<DiligenceQuestionsOutput>({
    model: "sonnet",
    system: SYSTEM,
    user,
    maxTokens: 4000,
    temperature: 0.2,
    jsonMode: true,
    validator: assertDiligenceQuestions,
  });
  return {
    output: res.content,
    cost_usd: res.cost_usd,
    retries: res.retries,
    model_used: res.model_used,
    prompt_version: "stage13-diligence-questions.v1",
  };
}
