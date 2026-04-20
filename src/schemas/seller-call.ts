/**
 * Stage-5 Seller Call Synthesizer schema.
 */

export interface AnsweredQuestion {
  question_id: string;
  answer_summary: string;
  answer_confidence: number; // 0..1
  seller_quote: string;
}

export interface SellerNewFact {
  field_path: string;
  value: string | number | boolean | null | Array<unknown>;
  confidence: number;
  source_excerpt: string;        // seller quote
  source_document_id: string;    // transcript_doc_id
}

export interface SellerChangedFact {
  field_path: string;
  old_value: string | number | boolean | null;
  new_value: string | number | boolean | null;
  direction_of_change: "better" | "worse" | "neutral";
  explanation: string;
}

export interface RedFlagFromCall {
  observation: string;
  severity: "blocker" | "high" | "medium" | "low";
  quote: string;
}

export type SellerPrimaryDriver =
  | "retirement"
  | "health"
  | "burnout"
  | "partner_dispute"
  | "financial_distress"
  | "opportunistic"
  | "other";

export interface SellerMotivationRead {
  primary_driver: SellerPrimaryDriver;
  secondary_drivers: SellerPrimaryDriver[];
  timeline_pressure: "low" | "medium" | "high";
  price_flexibility_signal: "none" | "some" | "strong";
}

export interface SellerCallOutput {
  answered_questions: AnsweredQuestion[];
  new_facts: SellerNewFact[];
  changed_facts: SellerChangedFact[];
  new_risks: Array<{
    category: string;
    severity: "blocker" | "high" | "medium" | "low";
    summary: string;
    evidence: string;
  }>;
  new_questions: Array<{
    category: string;
    priority: "p0" | "p1" | "p2";
    question: string;
    rationale: string;
  }>;
  red_flags_from_call: RedFlagFromCall[];
  seller_motivation_read: SellerMotivationRead;
  rapport_notes: string;
  updated_thesis_delta: {
    was_more_confident_in: string[];
    am_less_confident_in: string[];
    must_verify_next: string[];
  };
}

const SEV = ["blocker", "high", "medium", "low"];
const PRI = ["p0", "p1", "p2"];
const DRIVERS = [
  "retirement",
  "health",
  "burnout",
  "partner_dispute",
  "financial_distress",
  "opportunistic",
  "other",
];

export function assertSellerCall(obj: unknown): asserts obj is SellerCallOutput {
  const o = obj as Record<string, unknown>;
  if (!o) throw new Error("empty response");

  if (!Array.isArray(o.answered_questions)) throw new Error("answered_questions must be array");
  for (const [i, q0] of (o.answered_questions as Array<Record<string, unknown>>).entries()) {
    if (typeof q0.question_id !== "string") {
      throw new Error(`answered_questions[${i}].question_id required`);
    }
    if (typeof q0.answer_summary !== "string") {
      throw new Error(`answered_questions[${i}].answer_summary required`);
    }
    if (typeof q0.answer_confidence !== "number" || q0.answer_confidence < 0 || q0.answer_confidence > 1) {
      throw new Error(`answered_questions[${i}].answer_confidence 0..1`);
    }
    if (typeof q0.seller_quote !== "string") {
      throw new Error(`answered_questions[${i}].seller_quote required`);
    }
  }

  if (!Array.isArray(o.new_facts)) throw new Error("new_facts must be array");
  if (!Array.isArray(o.changed_facts)) throw new Error("changed_facts must be array");
  if (!Array.isArray(o.new_risks)) throw new Error("new_risks must be array");
  for (const [i, r0] of (o.new_risks as Array<Record<string, unknown>>).entries()) {
    if (!SEV.includes(r0.severity as string)) {
      throw new Error(`new_risks[${i}].severity invalid`);
    }
  }
  if (!Array.isArray(o.new_questions)) throw new Error("new_questions must be array");
  for (const [i, q0] of (o.new_questions as Array<Record<string, unknown>>).entries()) {
    if (!PRI.includes(q0.priority as string)) {
      throw new Error(`new_questions[${i}].priority invalid`);
    }
  }
  if (!Array.isArray(o.red_flags_from_call)) {
    throw new Error("red_flags_from_call must be array");
  }
  const mot = o.seller_motivation_read as Record<string, unknown>;
  if (!mot) throw new Error("seller_motivation_read required");
  if (!DRIVERS.includes(mot.primary_driver as string)) {
    throw new Error("seller_motivation_read.primary_driver invalid");
  }
  if (!["low", "medium", "high"].includes(mot.timeline_pressure as string)) {
    throw new Error("seller_motivation_read.timeline_pressure invalid");
  }
  if (!["none", "some", "strong"].includes(mot.price_flexibility_signal as string)) {
    throw new Error("seller_motivation_read.price_flexibility_signal invalid");
  }
  if (typeof o.rapport_notes !== "string") throw new Error("rapport_notes required");
  const td = o.updated_thesis_delta as Record<string, unknown>;
  if (!td) throw new Error("updated_thesis_delta required");
  for (const k of ["was_more_confident_in", "am_less_confident_in", "must_verify_next"]) {
    if (!Array.isArray(td[k])) {
      throw new Error(`updated_thesis_delta.${k} must be array`);
    }
  }
}
