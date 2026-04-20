/**
 * Stage-13 Diligence Question Generator schema.
 *
 * Produces a prioritized, categorized list of questions the buyer
 * should ask the seller/broker — with rationale, blocking status,
 * and a suggested channel (broker email, management meeting,
 * VDR request, CPA review).
 */

export const DILIGENCE_CATEGORIES = [
  "financials",
  "tax",
  "working_capital",
  "revenue_quality",
  "customers",
  "suppliers",
  "employees",
  "owner_involvement",
  "operations",
  "systems_it",
  "real_estate_lease",
  "legal",
  "licensing_regulatory",
  "insurance",
  "environmental",
  "intellectual_property",
  "debt_liabilities",
  "deal_structure",
  "transition",
  "seller_motivation",
] as const;
export type DiligenceCategory = (typeof DILIGENCE_CATEGORIES)[number];

export const DILIGENCE_CHANNELS = [
  "broker_email",
  "management_meeting",
  "vdr_request",
  "cpa_review",
  "legal_counsel",
  "onsite_visit",
  "third_party_report",
] as const;
export type DiligenceChannel = (typeof DILIGENCE_CHANNELS)[number];

export interface DiligenceQuestion {
  id: string;                          // stable sort key, e.g. "Q-FIN-01"
  category: DiligenceCategory;
  priority: "p0" | "p1" | "p2";        // p0 = must answer before LOI
  question: string;                    // ≤40 words
  why_it_matters: string;              // ≤30 words
  channel: DiligenceChannel;
  blocks_loi: boolean;                 // if true, do not issue LOI until resolved
  references_prior_finding: string | null; // field_path or stage reference, else null
  expected_answer_shape: "number" | "yes_no" | "document" | "narrative" | "list";
}

export interface DiligenceQuestionsOutput {
  total_questions: number;
  p0_count: number;
  p1_count: number;
  p2_count: number;
  questions: DiligenceQuestion[];
  // short email the user can literally paste to the broker, summarizing
  // all p0 questions with a courteous tone
  broker_email_draft: {
    subject: string;
    body: string;
  };
  // if ≥3 p0 items are unresolved, we recommend pausing
  recommendation_pause_loi: boolean;
}

export function assertDiligenceQuestions(
  obj: unknown,
): asserts obj is DiligenceQuestionsOutput {
  const o = obj as Record<string, unknown>;
  if (!o) throw new Error("empty response");
  if (typeof o.total_questions !== "number") throw new Error("total_questions number");
  if (typeof o.p0_count !== "number") throw new Error("p0_count number");
  if (typeof o.p1_count !== "number") throw new Error("p1_count number");
  if (typeof o.p2_count !== "number") throw new Error("p2_count number");

  if (!Array.isArray(o.questions)) throw new Error("questions must be array");
  const ids = new Set<string>();
  for (const [i, q0] of (o.questions as Array<Record<string, unknown>>).entries()) {
    if (typeof q0.id !== "string") throw new Error(`questions[${i}].id string`);
    if (ids.has(q0.id as string)) throw new Error(`questions[${i}].id duplicated`);
    ids.add(q0.id as string);
    if (!DILIGENCE_CATEGORIES.includes(q0.category as DiligenceCategory)) {
      throw new Error(`questions[${i}].category invalid`);
    }
    if (!["p0", "p1", "p2"].includes(q0.priority as string)) {
      throw new Error(`questions[${i}].priority invalid`);
    }
    if (typeof q0.question !== "string") throw new Error(`questions[${i}].question string`);
    if (typeof q0.why_it_matters !== "string") throw new Error(`questions[${i}].why_it_matters string`);
    if (!DILIGENCE_CHANNELS.includes(q0.channel as DiligenceChannel)) {
      throw new Error(`questions[${i}].channel invalid`);
    }
    if (typeof q0.blocks_loi !== "boolean") throw new Error(`questions[${i}].blocks_loi bool`);
    if (!["number", "yes_no", "document", "narrative", "list"].includes(q0.expected_answer_shape as string)) {
      throw new Error(`questions[${i}].expected_answer_shape invalid`);
    }
  }

  const b = o.broker_email_draft as Record<string, unknown> | undefined;
  if (!b || typeof b.subject !== "string" || typeof b.body !== "string") {
    throw new Error("broker_email_draft.subject + body required");
  }
  if (typeof o.recommendation_pause_loi !== "boolean") {
    throw new Error("recommendation_pause_loi bool");
  }
  if ((o.questions as unknown[]).length !== o.total_questions) {
    throw new Error("total_questions must match questions.length");
  }
}
