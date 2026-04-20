/**
 * Stage-6 VDR (Virtual Data Room) Review schema.
 */

export const VDR_CATEGORIES = [
  "financial",
  "customer",
  "operations",
  "legal",
  "hr_payroll",
  "real_estate_lease",
  "insurance",
  "it_systems",
  "regulatory_licensing",
] as const;
export type VdrCategory = (typeof VDR_CATEGORIES)[number];

export interface VdrMissingItem {
  item: string;
  criticality: "blocker" | "high" | "medium" | "low";
  rationale: string;
}

export interface VdrCategoryCoverage {
  score: number; // 0-100
  present: string[]; // doc_ids
  missing: VdrMissingItem[];
}

export interface VdrRedFlagPattern {
  observation: string;
  severity: "blocker" | "high" | "medium" | "low";
  basis: string;
}

export interface VdrSuggestedRequest {
  item: string;
  rationale: string;
  urgency: "this_week" | "before_close" | "nice_to_have";
}

export interface VdrQualityFinding {
  document_id: string;
  finding: string;
  severity: "blocker" | "high" | "medium" | "low";
}

export interface VdrReviewOutput {
  readiness_score: number; // 0-100
  coverage_by_category: Record<VdrCategory, VdrCategoryCoverage>;
  red_flags_from_vdr_patterns: VdrRedFlagPattern[];
  suggested_next_requests: VdrSuggestedRequest[];
  quality_findings_in_present_docs: VdrQualityFinding[];
}

const SEV = ["blocker", "high", "medium", "low"];
const URG = ["this_week", "before_close", "nice_to_have"];

export function assertVdrReview(obj: unknown): asserts obj is VdrReviewOutput {
  const o = obj as Record<string, unknown>;
  if (!o) throw new Error("empty response");
  if (typeof o.readiness_score !== "number" || o.readiness_score < 0 || o.readiness_score > 100) {
    throw new Error("readiness_score must be 0-100");
  }
  const c = o.coverage_by_category as Record<string, unknown>;
  if (!c) throw new Error("coverage_by_category required");
  for (const cat of VDR_CATEGORIES) {
    const v = c[cat] as Record<string, unknown> | undefined;
    if (!v) throw new Error(`coverage_by_category.${cat} required`);
    if (typeof v.score !== "number" || v.score < 0 || v.score > 100) {
      throw new Error(`coverage_by_category.${cat}.score must be 0-100`);
    }
    if (!Array.isArray(v.present)) throw new Error(`coverage_by_category.${cat}.present must be array`);
    if (!Array.isArray(v.missing)) throw new Error(`coverage_by_category.${cat}.missing must be array`);
    for (const [i, m0] of (v.missing as Array<Record<string, unknown>>).entries()) {
      if (typeof m0.item !== "string") {
        throw new Error(`coverage_by_category.${cat}.missing[${i}].item required`);
      }
      if (!SEV.includes(m0.criticality as string)) {
        throw new Error(`coverage_by_category.${cat}.missing[${i}].criticality invalid`);
      }
    }
  }
  if (!Array.isArray(o.red_flags_from_vdr_patterns)) {
    throw new Error("red_flags_from_vdr_patterns must be array");
  }
  for (const [i, r0] of (o.red_flags_from_vdr_patterns as Array<Record<string, unknown>>).entries()) {
    if (!SEV.includes(r0.severity as string)) {
      throw new Error(`red_flags_from_vdr_patterns[${i}].severity invalid`);
    }
  }
  if (!Array.isArray(o.suggested_next_requests)) {
    throw new Error("suggested_next_requests must be array");
  }
  for (const [i, s0] of (o.suggested_next_requests as Array<Record<string, unknown>>).entries()) {
    if (!URG.includes(s0.urgency as string)) {
      throw new Error(`suggested_next_requests[${i}].urgency invalid`);
    }
  }
  if (!Array.isArray(o.quality_findings_in_present_docs)) {
    throw new Error("quality_findings_in_present_docs must be array");
  }
}
