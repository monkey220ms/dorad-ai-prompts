/**
 * Initial Screen output schema + validator (no external deps — plain
 * runtime assertions so we keep the module dependency-free).
 */

export type Verdict = "pursue" | "monitor" | "pass";
export type RiskSeverity = "blocker" | "high" | "medium" | "low";
export type QuestionPriority = "p0" | "p1" | "p2";

export interface ProvenancedNumeric {
  value: number | null;
  confidence: number;
  source_excerpt: string;
}

export interface InitialScreenOutput {
  verdict: Verdict;
  verdict_headline: string;
  buy_box_fit_score: number;
  buy_box_mismatches: string[];

  snapshot: {
    industry_normalized: string;
    geography: { city: string; state: string; msa_or_region: string };
    headline_metrics: {
      asking_price: ProvenancedNumeric;
      revenue: ProvenancedNumeric;
      sde: ProvenancedNumeric;
      sde_multiple: ProvenancedNumeric;
    };
    employees: ProvenancedNumeric;
    years_in_business: ProvenancedNumeric;
    real_estate_included: {
      value: boolean | null;
      confidence: number;
      source_excerpt: string;
    };
    seller_financing: {
      value: boolean | null;
      confidence: number;
      source_excerpt: string;
    };
  };

  thesis_draft: {
    one_liner: string;
    why_interesting: string[];
    why_skeptical: string[];
    key_unknowns: string[];
  };

  risks: Array<{
    category: string;
    severity: RiskSeverity;
    summary: string;
    evidence: string;
  }>;

  questions_to_answer_before_loi: Array<{
    category: string;
    priority: QuestionPriority;
    question: string;
    rationale: string;
  }>;

  suggested_next_step: string;
  estimated_time_to_loi_days: number;
  analyst_confidence_overall: number;
}

const ALLOWED_VERDICTS: Verdict[] = ["pursue", "monitor", "pass"];
const ALLOWED_SEVERITIES: RiskSeverity[] = ["blocker", "high", "medium", "low"];
const ALLOWED_PRIORITIES: QuestionPriority[] = ["p0", "p1", "p2"];

export function assertInitialScreen(obj: unknown): asserts obj is InitialScreenOutput {
  const o = obj as Record<string, unknown>;
  if (!o) throw new Error("empty response");
  if (!ALLOWED_VERDICTS.includes(o.verdict as Verdict)) {
    throw new Error(`verdict must be one of ${ALLOWED_VERDICTS.join(", ")} — got ${String(o.verdict)}`);
  }
  if (typeof o.verdict_headline !== "string" || o.verdict_headline.length === 0) {
    throw new Error("verdict_headline required");
  }
  if (typeof o.buy_box_fit_score !== "number" || o.buy_box_fit_score < 0 || o.buy_box_fit_score > 100) {
    throw new Error("buy_box_fit_score must be 0-100");
  }
  const snap = o.snapshot as Record<string, unknown>;
  if (!snap) throw new Error("snapshot required");
  const hm = snap.headline_metrics as Record<string, unknown>;
  if (!hm) throw new Error("snapshot.headline_metrics required");
  for (const k of ["asking_price", "revenue", "sde", "sde_multiple"]) {
    const m = hm[k] as Record<string, unknown> | undefined;
    if (!m) throw new Error(`headline_metrics.${k} required`);
    if (!("value" in m)) throw new Error(`headline_metrics.${k}.value required (use null if unknown)`);
    if (typeof m.confidence !== "number" || m.confidence < 0 || m.confidence > 1) {
      throw new Error(`headline_metrics.${k}.confidence must be 0..1`);
    }
    if (typeof m.source_excerpt !== "string") {
      throw new Error(`headline_metrics.${k}.source_excerpt required (use "NOT_FOUND" if absent)`);
    }
  }
  if (!Array.isArray(o.risks)) throw new Error("risks must be an array");
  for (const r of o.risks as Array<Record<string, unknown>>) {
    if (!ALLOWED_SEVERITIES.includes(r.severity as RiskSeverity)) {
      throw new Error(`risk.severity must be one of ${ALLOWED_SEVERITIES.join(", ")}`);
    }
  }
  if (!Array.isArray(o.questions_to_answer_before_loi)) {
    throw new Error("questions_to_answer_before_loi must be an array");
  }
  for (const q of o.questions_to_answer_before_loi as Array<Record<string, unknown>>) {
    if (!ALLOWED_PRIORITIES.includes(q.priority as QuestionPriority)) {
      throw new Error(`question.priority must be one of ${ALLOWED_PRIORITIES.join(", ")}`);
    }
    if (typeof q.question !== "string" || q.question.length === 0) {
      throw new Error("question.question required");
    }
  }
  if (typeof o.suggested_next_step !== "string" || o.suggested_next_step.length === 0) {
    throw new Error("suggested_next_step required");
  }
  if (typeof o.estimated_time_to_loi_days !== "number" || o.estimated_time_to_loi_days < 0) {
    throw new Error("estimated_time_to_loi_days must be a non-negative number");
  }
  if (
    typeof o.analyst_confidence_overall !== "number" ||
    o.analyst_confidence_overall < 0 ||
    o.analyst_confidence_overall > 1
  ) {
    throw new Error("analyst_confidence_overall must be 0..1");
  }
}
