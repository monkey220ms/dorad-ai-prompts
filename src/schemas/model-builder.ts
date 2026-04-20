/**
 * Stage-8 Financial Model Builder schema.
 *
 * The LLM's job is to populate the INITIAL assumption set + 5 scenarios.
 * The deterministic calc engine (`@dorad/calc-engine`) consumes this and
 * returns the numeric outputs. This module does not describe those outputs.
 */

export const SCENARIO_LABELS = [
  "conservative_lender",
  "status_quo",
  "mgmt_led_growth",
  "aggressive_turnaround",
  "exit_prep",
] as const;
export type ScenarioLabel = (typeof SCENARIO_LABELS)[number];

/**
 * The "model_assumptions" object is too large to re-validate field-by-field
 * here — it's the contract with @dorad/calc-engine. We require the top-level
 * shape plus each scenario's presence.
 */
export interface ScenarioOverride {
  scenario_label: ScenarioLabel;
  display_name: string;
  narrative: string;
  overrides: Record<string, unknown>;
  created_by: "ai" | "user";
}

export interface ModelBuilderOutput {
  schema_version: "1.0";
  base_assumptions: Record<string, unknown>; // status_quo base
  scenarios: ScenarioOverride[]; // 5 entries including status_quo (overrides={})
  narrative_summary: string;
}

export function assertModelBuilder(obj: unknown): asserts obj is ModelBuilderOutput {
  const o = obj as Record<string, unknown>;
  if (!o) throw new Error("empty response");
  if (o.schema_version !== "1.0") throw new Error("schema_version must be '1.0'");
  if (!o.base_assumptions || typeof o.base_assumptions !== "object") {
    throw new Error("base_assumptions required");
  }
  const base = o.base_assumptions as Record<string, unknown>;
  for (const k of ["operations", "structure", "returns"]) {
    if (!base[k] || typeof base[k] !== "object") {
      throw new Error(`base_assumptions.${k} required`);
    }
  }
  if (!Array.isArray(o.scenarios) || o.scenarios.length !== 5) {
    throw new Error("scenarios must be array of 5");
  }
  const seen = new Set<string>();
  for (const [i, s0] of (o.scenarios as Array<Record<string, unknown>>).entries()) {
    if (!SCENARIO_LABELS.includes(s0.scenario_label as ScenarioLabel)) {
      throw new Error(`scenarios[${i}].scenario_label invalid`);
    }
    if (seen.has(s0.scenario_label as string)) {
      throw new Error(`scenarios: duplicate label ${s0.scenario_label}`);
    }
    seen.add(s0.scenario_label as string);
    if (typeof s0.display_name !== "string") {
      throw new Error(`scenarios[${i}].display_name required`);
    }
    if (typeof s0.narrative !== "string") {
      throw new Error(`scenarios[${i}].narrative required`);
    }
    if (!s0.overrides || typeof s0.overrides !== "object") {
      throw new Error(`scenarios[${i}].overrides required (use {} for status_quo base)`);
    }
    if (!["ai", "user"].includes(s0.created_by as string)) {
      throw new Error(`scenarios[${i}].created_by must be "ai" or "user"`);
    }
  }
  if (typeof o.narrative_summary !== "string") {
    throw new Error("narrative_summary required");
  }
}
