/**
 * Stage-11 Per-Deal Nightly Sanity Check schema.
 */

export interface StaleFact {
  field_path: string;
  age_days: number;
  why_stale: string;
}

export interface NewCompSignal {
  comp_listing_id: string;
  signal: string;
}

export interface AssumptionDrift {
  field_path: string;
  old_version_value: number | string | boolean | null;
  current_value: number | string | boolean | null;
  change_rationale_provided: boolean;
}

export const SANITY_SUGGESTED_ACTIONS = [
  "refresh_cim_extraction",
  "ask_new_question",
  "rerun_comps",
  "flag_for_user_review",
  "rerun_qofe",
  "rerun_model",
  "no_action_needed",
] as const;
export type SanitySuggestedAction = (typeof SANITY_SUGGESTED_ACTIONS)[number];

export interface SanitySuggestion {
  action: SanitySuggestedAction;
  priority: "p0" | "p1" | "p2";
  rationale: string;
}

export interface SanityCheckOutput {
  stale_facts: StaleFact[];
  new_comp_signals: NewCompSignal[];
  assumption_drift: AssumptionDrift[];
  suggested_actions: SanitySuggestion[];
}

export function assertSanityCheck(obj: unknown): asserts obj is SanityCheckOutput {
  const o = obj as Record<string, unknown>;
  if (!o) throw new Error("empty response");
  if (!Array.isArray(o.stale_facts)) throw new Error("stale_facts must be array");
  for (const [i, s0] of (o.stale_facts as Array<Record<string, unknown>>).entries()) {
    if (typeof s0.field_path !== "string") {
      throw new Error(`stale_facts[${i}].field_path required`);
    }
    if (typeof s0.age_days !== "number") {
      throw new Error(`stale_facts[${i}].age_days must be number`);
    }
  }
  if (!Array.isArray(o.new_comp_signals)) {
    throw new Error("new_comp_signals must be array");
  }
  if (!Array.isArray(o.assumption_drift)) {
    throw new Error("assumption_drift must be array");
  }
  if (!Array.isArray(o.suggested_actions)) {
    throw new Error("suggested_actions must be array");
  }
  for (const [i, a0] of (o.suggested_actions as Array<Record<string, unknown>>).entries()) {
    if (!SANITY_SUGGESTED_ACTIONS.includes(a0.action as SanitySuggestedAction)) {
      throw new Error(`suggested_actions[${i}].action invalid`);
    }
    if (!["p0", "p1", "p2"].includes(a0.priority as string)) {
      throw new Error(`suggested_actions[${i}].priority invalid`);
    }
  }
}
