/**
 * Stage-9 LOI Drafter schema.
 */

export const LOI_TRANSACTION_STRUCTURES = [
  "asset_purchase",
  "stock_purchase",
  "membership_interest_purchase",
] as const;

export interface LoiSellerNote {
  amount: number;
  term_months: number;
  rate_pct: number;
  first_payment_deferred_months: number;
  amortization_type: "standard" | "interest_only_then_balloon" | "balloon";
}

export interface LoiEarnout {
  max_amount: number;
  metric: "revenue" | "ebitda" | "sde" | "customer_retention";
  hurdle: string;
  payout_schedule: string;
}

export interface LoiStructured {
  parties: {
    buyer_entity_placeholder: string;
    seller_entity_placeholder: string;
    target_business_name: string;
  };
  transaction_structure:
    | "asset_purchase"
    | "stock_purchase"
    | "membership_interest_purchase";
  purchase_price: {
    total: number;
    cash_at_close: number;
    seller_note: LoiSellerNote | null;
    earnout: LoiEarnout | null;
    escrow: number;
  };
  working_capital_target: string;
  assets_included: string[];
  assets_excluded: string[];
  contingencies: string[];
  due_diligence_days: number;
  exclusivity_days: number;
  confidentiality_included: boolean;
  proposed_close_date: string;
  broker_commission_note: string;
  offer_expiration_date: string;
}

export interface LoiOutput {
  rendered_loi_text: string;
  structured: LoiStructured;
  negotiation_notes_for_buyer: string[];
  legal_disclaimer: string;
}

export function assertLoi(obj: unknown): asserts obj is LoiOutput {
  const o = obj as Record<string, unknown>;
  if (!o) throw new Error("empty response");
  if (typeof o.rendered_loi_text !== "string" || o.rendered_loi_text.length < 200) {
    throw new Error("rendered_loi_text required (≥200 chars)");
  }
  if (typeof o.legal_disclaimer !== "string" || o.legal_disclaimer.length < 20) {
    throw new Error("legal_disclaimer required");
  }
  const s = o.structured as Record<string, unknown>;
  if (!s) throw new Error("structured required");
  if (!LOI_TRANSACTION_STRUCTURES.includes(s.transaction_structure as "asset_purchase")) {
    throw new Error("structured.transaction_structure invalid");
  }
  const pp = s.purchase_price as Record<string, unknown>;
  if (!pp) throw new Error("structured.purchase_price required");
  if (typeof pp.total !== "number") throw new Error("purchase_price.total must be number");
  if (typeof pp.cash_at_close !== "number") {
    throw new Error("purchase_price.cash_at_close must be number");
  }
  if (typeof pp.escrow !== "number") throw new Error("purchase_price.escrow must be number");
  if (pp.seller_note !== null) {
    const sn = pp.seller_note as Record<string, unknown>;
    if (typeof sn.amount !== "number") throw new Error("seller_note.amount required");
    if (typeof sn.term_months !== "number") throw new Error("seller_note.term_months required");
    if (typeof sn.rate_pct !== "number") throw new Error("seller_note.rate_pct required");
    if (!["standard", "interest_only_then_balloon", "balloon"].includes(
      sn.amortization_type as string,
    )) {
      throw new Error("seller_note.amortization_type invalid");
    }
  }
  if (!Array.isArray(s.contingencies)) throw new Error("structured.contingencies must be array");
  if (typeof s.due_diligence_days !== "number") {
    throw new Error("structured.due_diligence_days must be number");
  }
  if (typeof s.exclusivity_days !== "number") {
    throw new Error("structured.exclusivity_days must be number");
  }
  if (!Array.isArray(o.negotiation_notes_for_buyer)) {
    throw new Error("negotiation_notes_for_buyer must be array");
  }
  if (typeof s.working_capital_target !== "string") {
    throw new Error("structured.working_capital_target required");
  }
  if (!Array.isArray(s.assets_included)) {
    throw new Error("structured.assets_included must be array");
  }
  if (!Array.isArray(s.assets_excluded)) {
    throw new Error("structured.assets_excluded must be array");
  }
  if (typeof s.confidentiality_included !== "boolean") {
    throw new Error("structured.confidentiality_included must be boolean");
  }
  const parties = s.parties as Record<string, unknown> | undefined;
  if (!parties) throw new Error("structured.parties required");
  for (const k of [
    "buyer_entity_placeholder",
    "seller_entity_placeholder",
    "target_business_name",
  ]) {
    if (typeof parties[k] !== "string") {
      throw new Error(`structured.parties.${k} required`);
    }
  }
}
