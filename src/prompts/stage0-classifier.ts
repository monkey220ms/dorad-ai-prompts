/**
 * Stage-0 Document Classifier.
 * Runs on every file upload. Returns doc_type + metadata.
 */

import { assertDocClassifier, type DocClassifierOutput } from "../schemas/doc-classifier.ts";
import { createClient } from "../client.ts";

const SYSTEM = `You classify business-acquisition documents for a deal analysis pipeline.

Return ONE JSON object matching this schema:
{
  "doc_type": "listing_ad" | "teaser" | "nda" | "cim" | "p_and_l" | "balance_sheet" | "tax_return" | "bank_statement" | "ar_aging" | "ap_aging" | "lease" | "contract" | "loi" | "qofe" | "ic_memo" | "seller_call_transcript" | "broker_email" | "other",
  "confidence": 0.0-1.0,
  "time_period": { "start": "YYYY-MM-DD" | null, "end": "YYYY-MM-DD" | null, "label": "FY2024" | "TTM Jun 2025" | null },
  "currency": "USD" | "EUR" | ...,
  "pages_estimated": integer,
  "contains_pii": boolean,
  "notes": "short rationale ≤40 words"
}

Rules:
- If the document mixes types (e.g. CIM with embedded P&L), pick the dominant type and call out the embedded section in notes.
- contains_pii = true if doc includes SSNs, bank account numbers, full DOB, or seller home address.
- Do not hallucinate time periods — if unclear, set null.

Output JSON only, no prose.`;

export interface ClassifyDocInput {
  firstChars: string;
  filename: string;
}

export async function classifyDoc(input: ClassifyDocInput, apiKey?: string): Promise<{
  output: DocClassifierOutput;
  cost_usd: number;
  retries: number;
  model_used: string;
}> {
  const client = createClient({ apiKey });
  const user = `<document>${input.firstChars.slice(0, 3000)}</document>\n<filename>${input.filename}</filename>`;
  const res = await client.call<DocClassifierOutput>({
    model: "haiku",
    system: SYSTEM,
    user,
    maxTokens: 500,
    temperature: 0,
    jsonMode: true,
    validator: assertDocClassifier,
  });
  return {
    output: res.content,
    cost_usd: res.cost_usd,
    retries: res.retries,
    model_used: res.model_used,
  };
}

export const STAGE_0_PROMPT_VERSION = "stage0.v1.0";
