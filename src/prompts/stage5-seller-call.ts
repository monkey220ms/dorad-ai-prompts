/**
 * Stage-5 Seller Call Synthesizer.
 *
 * Takes a diarized transcript from a buyer/seller call and produces:
 *   - answers to existing open questions
 *   - new facts / changed facts / new risks / new follow-up questions
 *   - a read on seller motivation + rapport notes
 *   - a thesis-delta summary
 */

import {
  assertSellerCall,
  type SellerCallOutput,
} from "../schemas/seller-call.ts";
import type { InitialScreenOutput } from "../schemas/initial-screen.ts";
import { createClient } from "../client.ts";

const SYSTEM = `You are processing a seller conversation transcript for an SMB acquisition deal.

Context given:
- Current deal snapshot (latest version)
- Current OPEN questions (with ids) — your job includes answering any that were addressed on the call
- Current OPEN risks
- transcript (diarized if possible: BUYER / SELLER / BROKER)
- transcript_doc_id (opaque string — use for source_document_id in new_facts)

Produce a JSON object with these sections:

{
  "answered_questions": [
    { "question_id": "match id from open_questions",
      "answer_summary": "≤40 words",
      "answer_confidence": 0.0-1.0,
      "seller_quote": "verbatim ≤40 words from SELLER turn" }
  ],

  "new_facts": [
    { "field_path": "dot.notated.path",
      "value": <any>,
      "confidence": 0.0-1.0,
      "source_excerpt": "seller quote ≤25 words",
      "source_document_id": "<transcript_doc_id>" }
  ],

  "changed_facts": [
    { "field_path": "financials.sde.adjusted.FY2024",
      "old_value": 345000,
      "new_value": 310000,
      "direction_of_change": "better" | "worse" | "neutral",
      "explanation": "≤30 words" }
  ],

  "new_risks":     [ /* Stage-1 risk shape */ ],
  "new_questions": [ /* Stage-1 question shape */ ],

  "red_flags_from_call": [
    { "observation": "≤40 words (e.g. seller evaded question about customer concentration)",
      "severity": "blocker"|"high"|"medium"|"low",
      "quote": "verbatim ≤25 words" }
  ],

  "seller_motivation_read": {
    "primary_driver": "retirement"|"health"|"burnout"|"partner_dispute"|"financial_distress"|"opportunistic"|"other",
    "secondary_drivers": [ ... ],
    "timeline_pressure": "low"|"medium"|"high",
    "price_flexibility_signal": "none"|"some"|"strong"
  },

  "rapport_notes": "≤60 words — what to remember for next call (personal details, concerns, priorities)",

  "updated_thesis_delta": {
    "was_more_confident_in": ["≤20 words each"],
    "am_less_confident_in":  ["≤20 words each"],
    "must_verify_next":      ["≤20 words each"]
  }
}

CRITICAL:
- Never put words in the seller's mouth. Every answered_questions.answer_summary must have a verbatim seller_quote.
- If the seller did NOT answer a question, DO NOT mark it answered — create a follow-up question instead.
- Distinguish BUYER asking from SELLER answering — do not misattribute.
- If transcript quality is poor (many "[inaudible]", overlapping speech), lower ALL confidences.
- Do not invent a motivation signal — if the call didn't touch on motivation, set primary_driver="other", timeline_pressure="low", price_flexibility_signal="none", and say so in rapport_notes.

Output JSON only.`;

export interface SellerCallInput {
  snapshot: InitialScreenOutput["snapshot"];
  openQuestions: Array<{ id: string; category: string; question: string; priority: "p0" | "p1" | "p2" }>;
  openRisks: Array<{ id: string; category: string; severity: string; summary: string }>;
  transcriptText: string;
  transcriptDocId: string;
}

export async function synthesizeSellerCall(
  input: SellerCallInput,
  apiKey?: string,
): Promise<{
  output: SellerCallOutput;
  cost_usd: number;
  retries: number;
  model_used: string;
  prompt_version: string;
}> {
  const client = createClient({ apiKey });
  const user = `<snapshot>
${JSON.stringify(input.snapshot, null, 2)}
</snapshot>

<open_questions>
${JSON.stringify(input.openQuestions, null, 2)}
</open_questions>

<open_risks>
${JSON.stringify(input.openRisks, null, 2)}
</open_risks>

<transcript_doc_id>${input.transcriptDocId}</transcript_doc_id>

<transcript>
${input.transcriptText}
</transcript>`;
  const res = await client.call<SellerCallOutput>({
    model: "opus",
    system: SYSTEM,
    user,
    maxTokens: 6000,
    temperature: 0.2,
    jsonMode: true,
    validator: assertSellerCall,
  });
  return {
    output: res.content,
    cost_usd: res.cost_usd,
    retries: res.retries,
    model_used: res.model_used,
    prompt_version: STAGE_5_PROMPT_VERSION,
  };
}

export const STAGE_5_PROMPT_VERSION = "stage5.v1.0";
