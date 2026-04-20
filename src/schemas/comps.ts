/**
 * Stage-4 Comparable Deals Finder schema.
 */

export interface CompCandidate {
  candidate_listing_id: string;
  score: number; // 0-100
  rationale: string;
  caveats: string;
  implied_multiple: number | null;
  is_sold: boolean;
}

export interface CompsAggregate {
  n_comps_used: number;
  implied_sde_multiple_median: number | null;
  implied_sde_multiple_p25: number | null;
  implied_sde_multiple_p75: number | null;
  subject_multiple: number | null;
  percentile_vs_peers: number | null;
  takeaway: string;
}

export interface CompsOutput {
  ranked_comps: CompCandidate[];
  aggregate: CompsAggregate;
}

export function assertComps(obj: unknown): asserts obj is CompsOutput {
  const o = obj as Record<string, unknown>;
  if (!o) throw new Error("empty response");
  if (!Array.isArray(o.ranked_comps)) throw new Error("ranked_comps must be array");
  for (const [i, c0] of (o.ranked_comps as Array<Record<string, unknown>>).entries()) {
    if (typeof c0.candidate_listing_id !== "string") {
      throw new Error(`ranked_comps[${i}].candidate_listing_id required`);
    }
    if (typeof c0.score !== "number" || c0.score < 0 || c0.score > 100) {
      throw new Error(`ranked_comps[${i}].score must be 0-100`);
    }
    if (typeof c0.rationale !== "string") {
      throw new Error(`ranked_comps[${i}].rationale required`);
    }
    if (typeof c0.caveats !== "string") {
      throw new Error(`ranked_comps[${i}].caveats required`);
    }
    if (c0.implied_multiple !== null && typeof c0.implied_multiple !== "number") {
      throw new Error(`ranked_comps[${i}].implied_multiple must be number|null`);
    }
    if (typeof c0.is_sold !== "boolean") {
      throw new Error(`ranked_comps[${i}].is_sold must be boolean`);
    }
  }
  const agg = o.aggregate as Record<string, unknown>;
  if (!agg) throw new Error("aggregate required");
  if (typeof agg.n_comps_used !== "number") throw new Error("aggregate.n_comps_used required");
  if (typeof agg.takeaway !== "string") throw new Error("aggregate.takeaway required");
  if (
    agg.percentile_vs_peers !== null &&
    typeof agg.percentile_vs_peers === "number" &&
    (agg.percentile_vs_peers < 0 || agg.percentile_vs_peers > 100)
  ) {
    throw new Error("aggregate.percentile_vs_peers must be 0-100 when set");
  }
}
