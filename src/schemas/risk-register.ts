/**
 * Stage-14 Risk Register schema.
 *
 * Structured inventory of deal risks with probability × impact ×
 * mitigation × owner. Feeds the IC memo, and powers a UI heatmap.
 */

export const RISK_CATEGORIES = [
  "financial",
  "operational",
  "legal",
  "regulatory",
  "market",
  "concentration",
  "key_person",
  "integration",
  "technology",
  "environmental",
  "reputation",
  "financing",
  "tax",
  "labor",
] as const;
export type RiskCategory = (typeof RISK_CATEGORIES)[number];

export const RISK_LIKELIHOOD = ["rare", "unlikely", "possible", "likely", "almost_certain"] as const;
export type RiskLikelihood = (typeof RISK_LIKELIHOOD)[number];

export const RISK_IMPACT = ["minor", "moderate", "major", "severe", "catastrophic"] as const;
export type RiskImpact = (typeof RISK_IMPACT)[number];

// Derived bucket for heatmap rendering
export const RISK_LEVEL = ["low", "medium", "high", "critical"] as const;
export type RiskLevel = (typeof RISK_LEVEL)[number];

export const MITIGATION_OWNER = [
  "buyer",
  "seller",
  "lender",
  "legal_counsel",
  "cpa",
  "insurance",
  "unknown",
] as const;
export type MitigationOwner = (typeof MITIGATION_OWNER)[number];

export interface Risk {
  id: string;                             // R-<CAT>-<NN>
  category: RiskCategory;
  title: string;                          // ≤10 words
  description: string;                    // ≤60 words
  evidence: string;                       // ≤40 words, cite source or "inferred"
  likelihood: RiskLikelihood;
  impact: RiskImpact;
  level: RiskLevel;                       // computed from likelihood × impact
  mitigation: {
    action: string;                       // ≤40 words
    owner: MitigationOwner;
    cost_estimate_usd: number | null;     // null if unknown
    timing: "pre_loi" | "pre_close" | "post_close" | "ongoing";
  };
  residual_level_after_mitigation: RiskLevel;
  kill_switch: boolean;                   // true if would stop deal if not resolved
}

export interface RiskRegisterOutput {
  risks: Risk[];
  risk_counts: Record<RiskLevel, number>;
  aggregate_score: number;                // 0-100 where 0 = no risk, 100 = deal killer
  kill_switch_present: boolean;
  summary_paragraph: string;              // ≤120 words, plain English
  recommended_reserves_usd: number | null; // buffer/escrow recommendation
}

export function assertRiskRegister(obj: unknown): asserts obj is RiskRegisterOutput {
  const o = obj as Record<string, unknown>;
  if (!o) throw new Error("empty response");
  if (!Array.isArray(o.risks)) throw new Error("risks must be array");
  const ids = new Set<string>();
  for (const [i, r0] of (o.risks as Array<Record<string, unknown>>).entries()) {
    if (typeof r0.id !== "string") throw new Error(`risks[${i}].id string`);
    if (ids.has(r0.id as string)) throw new Error(`risks[${i}].id duplicated`);
    ids.add(r0.id as string);
    if (!RISK_CATEGORIES.includes(r0.category as RiskCategory)) {
      throw new Error(`risks[${i}].category invalid`);
    }
    if (!RISK_LIKELIHOOD.includes(r0.likelihood as RiskLikelihood)) {
      throw new Error(`risks[${i}].likelihood invalid`);
    }
    if (!RISK_IMPACT.includes(r0.impact as RiskImpact)) {
      throw new Error(`risks[${i}].impact invalid`);
    }
    if (!RISK_LEVEL.includes(r0.level as RiskLevel)) {
      throw new Error(`risks[${i}].level invalid`);
    }
    if (!RISK_LEVEL.includes(r0.residual_level_after_mitigation as RiskLevel)) {
      throw new Error(`risks[${i}].residual_level_after_mitigation invalid`);
    }
    if (typeof r0.kill_switch !== "boolean") throw new Error(`risks[${i}].kill_switch bool`);
    const m = r0.mitigation as Record<string, unknown> | undefined;
    if (!m) throw new Error(`risks[${i}].mitigation required`);
    if (typeof m.action !== "string") throw new Error(`risks[${i}].mitigation.action string`);
    if (!MITIGATION_OWNER.includes(m.owner as MitigationOwner)) {
      throw new Error(`risks[${i}].mitigation.owner invalid`);
    }
    if (!["pre_loi", "pre_close", "post_close", "ongoing"].includes(m.timing as string)) {
      throw new Error(`risks[${i}].mitigation.timing invalid`);
    }
    if (m.cost_estimate_usd !== null && typeof m.cost_estimate_usd !== "number") {
      throw new Error(`risks[${i}].mitigation.cost_estimate_usd number|null`);
    }
  }
  const rc = o.risk_counts as Record<string, unknown> | undefined;
  if (!rc) throw new Error("risk_counts required");
  for (const lvl of RISK_LEVEL) {
    if (typeof rc[lvl] !== "number") throw new Error(`risk_counts.${lvl} required`);
  }
  if (typeof o.aggregate_score !== "number" || o.aggregate_score < 0 || o.aggregate_score > 100) {
    throw new Error("aggregate_score 0-100");
  }
  if (typeof o.kill_switch_present !== "boolean") throw new Error("kill_switch_present bool");
  if (typeof o.summary_paragraph !== "string") throw new Error("summary_paragraph string");
  if (
    o.recommended_reserves_usd !== null &&
    typeof o.recommended_reserves_usd !== "number"
  ) {
    throw new Error("recommended_reserves_usd number|null");
  }
}

/**
 * Pure helper — convert a likelihood × impact pair to the bucketed
 * RiskLevel used for the heatmap. The prompt should also return
 * this value but the model can occasionally be self-inconsistent,
 * so callers may overwrite level with this function to enforce a
 * canonical mapping.
 */
export function deriveRiskLevel(
  likelihood: RiskLikelihood,
  impact: RiskImpact,
): RiskLevel {
  const l = RISK_LIKELIHOOD.indexOf(likelihood); // 0..4
  const i = RISK_IMPACT.indexOf(impact);         // 0..4
  const score = (l + 1) * (i + 1);               // 1..25
  if (score >= 20) return "critical";
  if (score >= 12) return "high";
  if (score >= 6) return "medium";
  return "low";
}
