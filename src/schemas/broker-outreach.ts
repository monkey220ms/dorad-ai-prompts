/**
 * Broker-outreach email sequence schema (Stage 15a).
 *
 * Produces a 3-email drip (initial + 2 follow-ups) in 3 tone variants so
 * the buyer can pick the voice they're most comfortable with:
 *
 *   - direct:  short, transactional, no small talk, signals seriousness
 *   - warm:    friendly and conversational, still crisp — typical brokered SMB
 *   - curious: leads with genuine interest in the business, suited for
 *              smaller / relationship-driven brokers or direct sellers
 *
 * Each email has a subject + body. The body is plain text with \n\n
 * paragraph breaks — never HTML.
 *
 * The sequence is 3 emails per tone variant:
 *   email_1: initial outreach. Answers all P0 diligence questions we
 *            already have (1-3 specific asks). Ends with a concrete CTA
 *            (15-min call, specific time windows).
 *   email_2: follow-up 1 (send ~5 business days later if no reply).
 *            Surfaces 1-2 P1 questions. CTA: "are you still with this deal
 *            or did it close?". No guilt / pressure language.
 *   email_3: follow-up 2 (send ~5 business days after email_2, final touch).
 *            Very short. Presumes this is the last nudge. Optional pivot:
 *            "if this one's gone, do you have anything else like it?"
 *
 * We DO NOT include email addresses or phone numbers — the caller fills
 * those at send time.
 */

export const OUTREACH_TONES = ["direct", "warm", "curious"] as const;
export type OutreachTone = (typeof OUTREACH_TONES)[number];

export interface OutreachEmail {
  /** Subject line, ≤ 70 chars. */
  subject: string;
  /** Plain-text body. Use "\n\n" for paragraph breaks. ≤ 250 words. */
  body: string;
  /** Short rationale for the buyer. Why this phrasing? */
  rationale: string;
  /** Suggested send-after delay, e.g. "now", "5 business days", "10 business days". */
  send_after: string;
  /** Which diligence-question IDs (from Stage 13) this email references. */
  referenced_question_ids: string[];
}

export interface OutreachSequence {
  tone: OutreachTone;
  email_1: OutreachEmail; // initial
  email_2: OutreachEmail; // follow-up #1
  email_3: OutreachEmail; // final nudge
}

export interface BrokerOutreachOutput {
  /** Deal-level subject "hook" line used across all tone variants. */
  deal_hook: string;
  /** Buyer-level framing — who the buyer is, what they're looking for. */
  buyer_framing: string;
  /** 3 tone variants, each a full 3-email sequence. */
  sequences: OutreachSequence[];
  /** Extra asks the buyer should send to an accountant / deal counsel (NOT to the broker directly). */
  asks_for_other_parties: Array<{ party: "cpa" | "attorney" | "bank" | "other"; ask: string }>;
  /** Redlines: things the buyer should NOT say or ask in the initial email. */
  dont_say: string[];
  /** Overall risk calibration: how aggressive the tone should be given the deal context. */
  tone_recommendation: {
    primary: OutreachTone;
    rationale: string;
  };
  /** Prompt version tag. */
  prompt_version?: string;
}

export function assertBrokerOutreach(v: unknown): asserts v is BrokerOutreachOutput {
  if (v == null || typeof v !== "object") {
    throw new Error("BrokerOutreach: root not object");
  }
  const o = v as Record<string, unknown>;
  if (typeof o.deal_hook !== "string" || o.deal_hook.length < 4) {
    throw new Error("BrokerOutreach: deal_hook missing or too short");
  }
  if (typeof o.buyer_framing !== "string" || o.buyer_framing.length < 4) {
    throw new Error("BrokerOutreach: buyer_framing missing");
  }
  if (!Array.isArray(o.sequences) || o.sequences.length !== 3) {
    throw new Error("BrokerOutreach: expected exactly 3 tone sequences");
  }
  const seenTones = new Set<string>();
  for (const rawSeq of o.sequences) {
    if (rawSeq == null || typeof rawSeq !== "object") {
      throw new Error("BrokerOutreach: sequence entry not object");
    }
    const s = rawSeq as Record<string, unknown>;
    if (typeof s.tone !== "string" || !(OUTREACH_TONES as readonly string[]).includes(s.tone)) {
      throw new Error(`BrokerOutreach: unknown tone ${JSON.stringify(s.tone)}`);
    }
    if (seenTones.has(s.tone as string)) {
      throw new Error(`BrokerOutreach: duplicate tone ${s.tone}`);
    }
    seenTones.add(s.tone as string);
    for (const key of ["email_1", "email_2", "email_3"] as const) {
      const e = s[key] as Record<string, unknown> | undefined;
      if (e == null || typeof e !== "object") {
        throw new Error(`BrokerOutreach: ${s.tone}/${key} missing`);
      }
      if (typeof e.subject !== "string" || e.subject.length === 0 || e.subject.length > 100) {
        throw new Error(`BrokerOutreach: ${s.tone}/${key} bad subject`);
      }
      if (typeof e.body !== "string" || e.body.length < 40) {
        throw new Error(`BrokerOutreach: ${s.tone}/${key} body too short`);
      }
      if (typeof e.rationale !== "string" || e.rationale.length === 0) {
        throw new Error(`BrokerOutreach: ${s.tone}/${key} missing rationale`);
      }
      if (typeof e.send_after !== "string") {
        throw new Error(`BrokerOutreach: ${s.tone}/${key} missing send_after`);
      }
      if (!Array.isArray(e.referenced_question_ids)) {
        throw new Error(
          `BrokerOutreach: ${s.tone}/${key} referenced_question_ids must be an array`,
        );
      }
    }
  }
  if (!Array.isArray(o.asks_for_other_parties)) {
    throw new Error("BrokerOutreach: asks_for_other_parties must be array");
  }
  if (!Array.isArray(o.dont_say)) {
    throw new Error("BrokerOutreach: dont_say must be array");
  }
  if (
    o.tone_recommendation == null ||
    typeof o.tone_recommendation !== "object"
  ) {
    throw new Error("BrokerOutreach: tone_recommendation missing");
  }
  const tr = o.tone_recommendation as Record<string, unknown>;
  if (typeof tr.primary !== "string" || !(OUTREACH_TONES as readonly string[]).includes(tr.primary)) {
    throw new Error("BrokerOutreach: tone_recommendation.primary bad");
  }
  if (typeof tr.rationale !== "string") {
    throw new Error("BrokerOutreach: tone_recommendation.rationale missing");
  }
}
