/**
 * Stage-15a Broker Outreach Email Drafter.
 *
 * Given the upstream deal-context (initial screen + CIM) and the Stage-13
 * diligence question list, produce 3 tone variants of a 3-email outreach
 * sequence (initial + 2 follow-ups). Each email references the P0/P1
 * diligence questions explicitly.
 *
 * Haiku because the task is formatting + light tone adaptation — no deep
 * financial reasoning. Stage 13 already did the hard work of deciding
 * *which* questions to ask; this stage only decides *how* to ask them.
 */

import {
  assertBrokerOutreach,
  type BrokerOutreachOutput,
  type OutreachTone,
} from "../schemas/broker-outreach.ts";
import { createClient } from "../client.ts";

const SYSTEM = `You are a senior SMB acquisition advisor helping a self-funded buyer reach out to a business broker (or direct seller) about a listed deal.

Write tight, professional, non-generic emails that signal the buyer is a serious, diligent operator — NOT a window-shopper.

For THIS request, produce exactly THREE tone variants:
  1. "direct"  — short, transactional. Buyer leads with qualifications + the 1-3 most important P0 questions. No small talk. 80-130 words.
  2. "warm"    — friendly and conversational but still crisp. Opens with a specific compliment or observation about the listing, then asks. 120-180 words.
  3. "curious" — leads with genuine interest in the seller's story / why they're exiting. Best for owner-direct deals or relationship-driven brokers. 140-220 words.

Each tone gets a 3-email sequence:
  email_1 (initial) — send_after: "now"
    - Use AT MOST 3 P0 questions (referenced by ID in referenced_question_ids).
    - End with a specific CTA: a 15-min intro call offering 2-3 time windows.
  email_2 (follow-up #1) — send_after: "5 business days"
    - Polite re-engagement. Reference 1-2 P1 questions. 50-90 words.
    - Low-pressure. No guilt language, no "circling back". Use "any update on this?" or similar neutral phrasing.
  email_3 (final nudge) — send_after: "10 business days"
    - VERY short (30-60 words). Presume this is the last email.
    - Optional pivot: ask if they have anything else matching the buyer's criteria.
    - Leave the door open gracefully.

Global rules (apply to all tones):
  - Never invent financials, operational facts, or quotes that are not in the provided context. If a specific number would strengthen the email, use placeholder syntax like "[ASK: revenue_ttm]".
  - Never ask for SSN, bank routing, credit scores, or make claims about the buyer's financing that haven't been stated in buyer_framing.
  - Never use emojis. Never use exclamation points. Never use "looking forward to hearing from you" or similar filler.
  - Never write more than 250 words in any single email body.
  - No greetings like "I hope this email finds you well".
  - NEVER ask about topics already covered in <already_asked_texts> — that's spam.
  - If the Stage 13 questions list is empty, still produce 3 tones but use the most natural P0 questions an investor would ask given the listing info (valuation basis, owner involvement, customer concentration).

Also populate:
  - deal_hook: one-line hook that captures why this deal is interesting (goes in the subject of email_1 for all tones).
  - buyer_framing: 1-2 sentences describing the buyer, their criteria, funding source. Use facts from <buyer_context> only.
  - asks_for_other_parties: any questions that should go to CPA / attorney / bank NOT the broker.
  - dont_say: 3-5 explicit anti-patterns the buyer should avoid in this first outreach (e.g. "don't mention the full SBA pre-approval amount", "don't disclose the buyer's current bid ceiling").
  - tone_recommendation.primary: the single tone you'd recommend the buyer use first, with rationale.

Output MUST be valid JSON matching the BrokerOutreachOutput schema. No extra fields, no wrapping prose, no markdown.`;

export interface BrokerOutreachInput {
  initialScreen: unknown;
  cimExtraction: unknown;
  diligenceQuestions: {
    /**
     * Array of questions from Stage 13.
     * Each has at least: id, priority ("p0"|"p1"|"p2"), question_text, audience.
     */
    questions: Array<Record<string, unknown>>;
    /** Optional pre-drafted broker email from Stage 13, for reference. */
    broker_email_draft?: { subject?: string; body?: string } | null;
  } | null;
  /** Prior outreach texts (if any) — help de-dup language. */
  already_asked_texts?: string[];
  /** Buyer context (who are you, how funded, what's your criteria). */
  buyerContext: {
    buyer_handle?: string;
    buyer_background?: string;
    funding_source?: string;
    target_price_range_usd?: [number, number] | null;
    target_industries?: string[];
    decision_speed_weeks?: number | null;
    references_available?: boolean;
  };
  /** Hard override — force a specific primary tone if buyer already picked one. */
  force_primary_tone?: OutreachTone;
}

export async function runBrokerOutreach(
  input: BrokerOutreachInput,
  apiKey?: string,
): Promise<{
  output: BrokerOutreachOutput;
  cost_usd: number;
  retries: number;
  model_used: string;
  prompt_version: string;
}> {
  const client = createClient({ apiKey });
  const user = `<initial_screen>
${JSON.stringify(input.initialScreen ?? null, null, 2)}
</initial_screen>

<cim_extraction>
${JSON.stringify(input.cimExtraction ?? null, null, 2)}
</cim_extraction>

<stage13_diligence>
${JSON.stringify(input.diligenceQuestions ?? null, null, 2)}
</stage13_diligence>

<already_asked_texts>
${JSON.stringify(input.already_asked_texts ?? [], null, 2)}
</already_asked_texts>

<buyer_context>
${JSON.stringify(input.buyerContext, null, 2)}
</buyer_context>

<primary_tone_override>
${input.force_primary_tone ?? "none"}
</primary_tone_override>`;

  const res = await client.call<BrokerOutreachOutput>({
    model: "haiku",
    system: SYSTEM,
    user,
    maxTokens: 3500,
    temperature: 0.35,
    jsonMode: true,
    validator: (v) => {
      assertBrokerOutreach(v);
      // Honor force_primary_tone if the caller set it.
      if (input.force_primary_tone) {
        (v as BrokerOutreachOutput).tone_recommendation.primary =
          input.force_primary_tone;
      }
      (v as BrokerOutreachOutput).prompt_version = "stage15a-broker-outreach.v1";
    },
  });
  return {
    output: res.content,
    cost_usd: res.cost_usd,
    retries: res.retries,
    model_used: res.model_used,
    prompt_version: "stage15a-broker-outreach.v1",
  };
}
