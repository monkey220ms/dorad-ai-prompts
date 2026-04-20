/**
 * Stage-6 VDR / Data Room Reviewer.
 *
 * Given the list of docs in the virtual data room (post-LOI) plus the deal
 * snapshot, score readiness, flag missing items, and propose follow-ups.
 */

import {
  assertVdrReview,
  type VdrReviewOutput,
} from "../schemas/vdr-review.ts";
import type { InitialScreenOutput } from "../schemas/initial-screen.ts";
import { createClient } from "../client.ts";

const SYSTEM = `You are evaluating a virtual data room (VDR) for an SMB acquisition in due diligence.

Input:
- snapshot: the latest deal snapshot (industry, size, complexity)
- documents_in_vdr: [{ doc_id, doc_type, period_label, filename, uploaded_at }]
- dd_checklist: the user's current due-diligence checklist (may be partial/empty)

Return JSON:
{
  "readiness_score": 0-100,
  "coverage_by_category": {
    "financial":             { "score": 0-100, "present": [...doc_ids], "missing": [{"item":"3 years of tax returns","criticality":"blocker|high|medium|low","rationale":"..."}] },
    "customer":              { "score": 0-100, "present": [...], "missing": [...] },
    "operations":            { "score": 0-100, "present": [...], "missing": [...] },
    "legal":                 { "score": 0-100, "present": [...], "missing": [...] },
    "hr_payroll":            { "score": 0-100, "present": [...], "missing": [...] },
    "real_estate_lease":     { "score": 0-100, "present": [...], "missing": [...] },
    "insurance":             { "score": 0-100, "present": [...], "missing": [...] },
    "it_systems":            { "score": 0-100, "present": [...], "missing": [...] },
    "regulatory_licensing":  { "score": 0-100, "present": [...], "missing": [...] }
  },
  "red_flags_from_vdr_patterns": [
    { "observation": "≤40 words", "severity": "blocker"|"high"|"medium"|"low", "basis": "e.g. 'asked 3 weeks ago, still not delivered — seller delay pattern'" }
  ],
  "suggested_next_requests": [
    { "item": "...", "rationale": "...", "urgency": "this_week"|"before_close"|"nice_to_have" }
  ],
  "quality_findings_in_present_docs": [
    { "document_id": "...", "finding": "lease has 14 months remaining; renewal not guaranteed", "severity": "high" }
  ]
}

Industry-aware rules:
- Manufacturing: equipment maintenance logs, environmental/EPA records, key supplier contracts.
- Services:     customer contracts/MSAs, employee non-competes, key-employee retention plans.
- Restaurant/retail: health inspection history, liquor/tobacco licenses, POS system access, foot traffic data.
- E-commerce:   platform health (Shopify/Amazon), SEO baselines, ad account access, returns/chargebacks.

Rules:
- Do not invent documents. If an item's presence is ambiguous, mark it under missing with criticality "medium" and note the ambiguity in rationale.
- Every VDR category MUST appear in coverage_by_category (use score=0 + empty present/missing if truly N/A for this industry — but prefer to list 1-2 expected items).

Output JSON only.`;

export interface VdrReviewInput {
  snapshot: InitialScreenOutput["snapshot"];
  documentsInVdr: Array<{
    doc_id: string;
    doc_type: string;
    period_label: string | null;
    filename: string;
    uploaded_at: string;
  }>;
  ddChecklist?: Array<{ category: string; item: string; status: "open" | "satisfied" }>;
}

export async function reviewVdr(
  input: VdrReviewInput,
  apiKey?: string,
): Promise<{
  output: VdrReviewOutput;
  cost_usd: number;
  retries: number;
  model_used: string;
  prompt_version: string;
}> {
  const client = createClient({ apiKey });
  const user = `<snapshot>
${JSON.stringify(input.snapshot, null, 2)}
</snapshot>

<documents_in_vdr>
${JSON.stringify(input.documentsInVdr, null, 2)}
</documents_in_vdr>

<dd_checklist>
${JSON.stringify(input.ddChecklist ?? [], null, 2)}
</dd_checklist>`;
  const res = await client.call<VdrReviewOutput>({
    model: "sonnet",
    system: SYSTEM,
    user,
    maxTokens: 5000,
    temperature: 0.2,
    jsonMode: true,
    validator: assertVdrReview,
  });
  return {
    output: res.content,
    cost_usd: res.cost_usd,
    retries: res.retries,
    model_used: res.model_used,
    prompt_version: STAGE_6_PROMPT_VERSION,
  };
}

export const STAGE_6_PROMPT_VERSION = "stage6.v1.0";
