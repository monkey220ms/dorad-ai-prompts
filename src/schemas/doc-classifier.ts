/**
 * Stage-0 document classifier schema + validator.
 */

export type DocType =
  | "listing_ad"
  | "teaser"
  | "nda"
  | "cim"
  | "p_and_l"
  | "balance_sheet"
  | "tax_return"
  | "bank_statement"
  | "ar_aging"
  | "ap_aging"
  | "lease"
  | "contract"
  | "loi"
  | "qofe"
  | "ic_memo"
  | "seller_call_transcript"
  | "broker_email"
  | "other";

export interface DocClassifierOutput {
  doc_type: DocType;
  confidence: number;
  time_period: {
    start: string | null;
    end: string | null;
    label: string | null;
  };
  currency: string;
  pages_estimated: number;
  contains_pii: boolean;
  notes: string;
}

export const ALLOWED_DOC_TYPES: DocType[] = [
  "listing_ad", "teaser", "nda", "cim", "p_and_l", "balance_sheet",
  "tax_return", "bank_statement", "ar_aging", "ap_aging", "lease", "contract",
  "loi", "qofe", "ic_memo", "seller_call_transcript", "broker_email", "other",
];

export function assertDocClassifier(obj: unknown): asserts obj is DocClassifierOutput {
  const o = obj as Record<string, unknown>;
  if (!o) throw new Error("empty response");
  if (!ALLOWED_DOC_TYPES.includes(o.doc_type as DocType)) {
    throw new Error(`doc_type must be one of ${ALLOWED_DOC_TYPES.join(", ")} — got ${String(o.doc_type)}`);
  }
  if (typeof o.confidence !== "number" || o.confidence < 0 || o.confidence > 1) {
    throw new Error("confidence must be 0..1");
  }
  if (typeof o.contains_pii !== "boolean") {
    throw new Error("contains_pii must be boolean");
  }
  if (typeof o.notes !== "string") {
    throw new Error("notes must be a string (use \"\" if none)");
  }
  if (typeof o.currency !== "string" || o.currency.length === 0) {
    throw new Error("currency required (e.g. 'USD')");
  }
  if (typeof o.pages_estimated !== "number" || o.pages_estimated < 0) {
    throw new Error("pages_estimated must be a non-negative number");
  }
  const tp = o.time_period as Record<string, unknown> | undefined;
  if (!tp) throw new Error("time_period required");
  for (const k of ["start", "end", "label"]) {
    const v = tp[k];
    if (v !== null && typeof v !== "string") {
      throw new Error(`time_period.${k} must be string|null`);
    }
  }
}
