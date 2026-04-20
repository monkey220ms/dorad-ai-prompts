/**
 * Industry benchmarks seed dataset.
 *
 * Sources (aggregate/ranges only — this is NOT a comps database):
 *   - BizBuySell Insight reports 2023-2024 (median sale prices)
 *   - Business Valuation Resources (BVR) DealStats median multiples
 *   - IBISWorld industry margin summaries
 *   - Dorad internal observations (adjustments applied conservatively)
 *
 * All numbers are SMB-specific (transaction value $250k–$10M) and
 * reflect asset-sale (not stock-sale) pricing where applicable.
 *
 * Use the `matchBenchmark(query)` helper to resolve an industry label
 * or NAICS 2-digit code to the closest entry.
 */

export interface IndustryBenchmark {
  key: string;                      // stable, e.g. "hvac_plumbing"
  label: string;                    // human-readable
  naics_2d: string | null;          // "23" for construction, etc.
  aliases: string[];                // fuzzy match helpers

  /** SDE multiple ranges (applied to adjusted SDE). */
  sde_multiple: { low: number; mid: number; high: number };
  /** EBITDA multiple ranges — applied only when EBITDA > $1M typically. */
  ebitda_multiple: { low: number; mid: number; high: number };
  /** Revenue multiple for deals where SDE is volatile (used as a cross-check). */
  revenue_multiple: { low: number; mid: number; high: number };

  /** Typical EBITDA margin (EBITDA / revenue) for healthy operators. */
  typical_ebitda_margin: { low: number; mid: number; high: number };
  /** Typical gross margin. */
  typical_gross_margin: { low: number; mid: number; high: number };

  /** Owner compensation add-back as % of revenue (helps validate QofE adjustments). */
  owner_comp_pct_of_rev: { low: number; mid: number; high: number };

  /** Is this industry typically asset-heavy (trucks, equipment, inventory)? */
  asset_intensity: "low" | "medium" | "high";
  /** Typical customer concentration red flag threshold (top 1 customer %). */
  customer_concentration_red_flag_pct: number;
  /** Typical working capital as % of revenue (peg reference). */
  working_capital_pct_of_rev: number;
  /** Typical maintenance capex % of revenue. */
  maintenance_capex_pct_of_rev: number;

  /** Structural notes — short sentences. */
  notes: string[];
}

export const INDUSTRY_BENCHMARKS: IndustryBenchmark[] = [
  {
    key: "hvac_plumbing",
    label: "HVAC / Plumbing",
    naics_2d: "23",
    aliases: ["hvac", "plumbing", "mechanical contractor", "heating cooling"],
    sde_multiple: { low: 2.5, mid: 3.2, high: 4.0 },
    ebitda_multiple: { low: 4.0, mid: 5.2, high: 6.5 },
    revenue_multiple: { low: 0.55, mid: 0.75, high: 0.95 },
    typical_ebitda_margin: { low: 0.10, mid: 0.15, high: 0.22 },
    typical_gross_margin: { low: 0.30, mid: 0.38, high: 0.48 },
    owner_comp_pct_of_rev: { low: 0.05, mid: 0.08, high: 0.12 },
    asset_intensity: "medium",
    customer_concentration_red_flag_pct: 0.15,
    working_capital_pct_of_rev: 0.12,
    maintenance_capex_pct_of_rev: 0.02,
    notes: [
      "Recurring maintenance contracts command premium multiples (+0.5-1.0x SDE).",
      "Licensed technician retention is a key diligence item.",
    ],
  },
  {
    key: "auto_repair",
    label: "Auto Repair / Service",
    naics_2d: "81",
    aliases: ["auto repair", "mechanic", "collision", "transmission shop"],
    sde_multiple: { low: 2.0, mid: 2.7, high: 3.3 },
    ebitda_multiple: { low: 3.5, mid: 4.3, high: 5.2 },
    revenue_multiple: { low: 0.40, mid: 0.55, high: 0.70 },
    typical_ebitda_margin: { low: 0.08, mid: 0.14, high: 0.20 },
    typical_gross_margin: { low: 0.45, mid: 0.55, high: 0.65 },
    owner_comp_pct_of_rev: { low: 0.06, mid: 0.09, high: 0.13 },
    asset_intensity: "high",
    customer_concentration_red_flag_pct: 0.25,
    working_capital_pct_of_rev: 0.08,
    maintenance_capex_pct_of_rev: 0.03,
    notes: [
      "Real estate often owned by seller — negotiate lease before LOI.",
      "Parts margin is a key profitability driver.",
    ],
  },
  {
    key: "restaurants_fsr",
    label: "Restaurants (full-service)",
    naics_2d: "72",
    aliases: ["restaurant", "fine dining", "casual dining", "bar and grill"],
    sde_multiple: { low: 1.5, mid: 2.0, high: 2.6 },
    ebitda_multiple: { low: 3.0, mid: 3.8, high: 4.6 },
    revenue_multiple: { low: 0.30, mid: 0.40, high: 0.55 },
    typical_ebitda_margin: { low: 0.05, mid: 0.10, high: 0.15 },
    typical_gross_margin: { low: 0.60, mid: 0.68, high: 0.75 },
    owner_comp_pct_of_rev: { low: 0.03, mid: 0.06, high: 0.10 },
    asset_intensity: "high",
    customer_concentration_red_flag_pct: 0.10,
    working_capital_pct_of_rev: 0.04,
    maintenance_capex_pct_of_rev: 0.03,
    notes: [
      "Lease terms dominate valuation — verify >5yr runway before LOI.",
      "Liquor license transferability is binary: verify with state ABC.",
    ],
  },
  {
    key: "restaurants_qsr",
    label: "Restaurants (quick-service / franchise)",
    naics_2d: "72",
    aliases: ["qsr", "fast casual", "franchise restaurant", "drive thru"],
    sde_multiple: { low: 2.0, mid: 2.8, high: 3.6 },
    ebitda_multiple: { low: 4.0, mid: 5.0, high: 6.2 },
    revenue_multiple: { low: 0.40, mid: 0.55, high: 0.75 },
    typical_ebitda_margin: { low: 0.08, mid: 0.13, high: 0.18 },
    typical_gross_margin: { low: 0.65, mid: 0.70, high: 0.76 },
    owner_comp_pct_of_rev: { low: 0.02, mid: 0.04, high: 0.07 },
    asset_intensity: "high",
    customer_concentration_red_flag_pct: 0.05,
    working_capital_pct_of_rev: 0.03,
    maintenance_capex_pct_of_rev: 0.025,
    notes: [
      "Franchisor approval is a gating event — build into LOI timeline.",
      "Royalty + marketing fees (typically 5-8%) reduce effective SDE.",
    ],
  },
  {
    key: "saas_b2b",
    label: "SaaS (B2B)",
    naics_2d: "54",
    aliases: ["saas", "software", "subscription software", "b2b software"],
    sde_multiple: { low: 3.5, mid: 5.0, high: 7.0 },
    ebitda_multiple: { low: 5.0, mid: 8.0, high: 12.0 },
    revenue_multiple: { low: 2.5, mid: 4.0, high: 6.5 },
    typical_ebitda_margin: { low: 0.15, mid: 0.25, high: 0.40 },
    typical_gross_margin: { low: 0.65, mid: 0.80, high: 0.90 },
    owner_comp_pct_of_rev: { low: 0.04, mid: 0.08, high: 0.15 },
    asset_intensity: "low",
    customer_concentration_red_flag_pct: 0.20,
    working_capital_pct_of_rev: 0.05,
    maintenance_capex_pct_of_rev: 0.005,
    notes: [
      "Net revenue retention >100% commands a 1.5x+ multiple premium.",
      "Concentration risk usually drives valuation down more than anything else.",
    ],
  },
  {
    key: "digital_agency",
    label: "Digital Agency / Marketing Services",
    naics_2d: "54",
    aliases: ["agency", "marketing agency", "seo agency", "web design"],
    sde_multiple: { low: 1.8, mid: 2.5, high: 3.3 },
    ebitda_multiple: { low: 3.0, mid: 4.2, high: 5.5 },
    revenue_multiple: { low: 0.60, mid: 0.90, high: 1.30 },
    typical_ebitda_margin: { low: 0.10, mid: 0.18, high: 0.28 },
    typical_gross_margin: { low: 0.55, mid: 0.65, high: 0.75 },
    owner_comp_pct_of_rev: { low: 0.05, mid: 0.12, high: 0.20 },
    asset_intensity: "low",
    customer_concentration_red_flag_pct: 0.25,
    working_capital_pct_of_rev: 0.10,
    maintenance_capex_pct_of_rev: 0.005,
    notes: [
      "Founder concentration in client relationships is the #1 valuation haircut.",
      "Recurring retainer % of revenue is the key multiple driver.",
    ],
  },
  {
    key: "ecommerce_d2c",
    label: "E-commerce / D2C Brand",
    naics_2d: "44",
    aliases: ["ecommerce", "amazon fba", "shopify", "d2c", "direct to consumer"],
    sde_multiple: { low: 2.2, mid: 3.2, high: 4.3 },
    ebitda_multiple: { low: 3.5, mid: 5.0, high: 6.8 },
    revenue_multiple: { low: 0.60, mid: 1.10, high: 1.80 },
    typical_ebitda_margin: { low: 0.08, mid: 0.15, high: 0.25 },
    typical_gross_margin: { low: 0.45, mid: 0.55, high: 0.68 },
    owner_comp_pct_of_rev: { low: 0.03, mid: 0.06, high: 0.10 },
    asset_intensity: "medium",
    customer_concentration_red_flag_pct: 0.05,
    working_capital_pct_of_rev: 0.18,
    maintenance_capex_pct_of_rev: 0.015,
    notes: [
      "Inventory quality (age, sellability) is a gating diligence item.",
      "Platform concentration (>70% Amazon) reduces multiples meaningfully.",
    ],
  },
  {
    key: "manufacturing_light",
    label: "Manufacturing (light, SMB)",
    naics_2d: "31",
    aliases: ["manufacturing", "metal fabrication", "cnc machine shop", "light manufacturing"],
    sde_multiple: { low: 2.5, mid: 3.4, high: 4.3 },
    ebitda_multiple: { low: 4.0, mid: 5.3, high: 6.8 },
    revenue_multiple: { low: 0.50, mid: 0.75, high: 1.00 },
    typical_ebitda_margin: { low: 0.08, mid: 0.14, high: 0.22 },
    typical_gross_margin: { low: 0.28, mid: 0.35, high: 0.45 },
    owner_comp_pct_of_rev: { low: 0.04, mid: 0.07, high: 0.11 },
    asset_intensity: "high",
    customer_concentration_red_flag_pct: 0.20,
    working_capital_pct_of_rev: 0.20,
    maintenance_capex_pct_of_rev: 0.035,
    notes: [
      "Equipment condition and remaining useful life drive asset-based valuation floor.",
      "Customer PO visibility (backlog) is a premium driver.",
    ],
  },
  {
    key: "distribution_wholesale",
    label: "Distribution / Wholesale",
    naics_2d: "42",
    aliases: ["distribution", "wholesale", "food distribution"],
    sde_multiple: { low: 2.2, mid: 3.0, high: 3.8 },
    ebitda_multiple: { low: 3.8, mid: 4.8, high: 6.0 },
    revenue_multiple: { low: 0.25, mid: 0.35, high: 0.50 },
    typical_ebitda_margin: { low: 0.04, mid: 0.07, high: 0.12 },
    typical_gross_margin: { low: 0.18, mid: 0.25, high: 0.35 },
    owner_comp_pct_of_rev: { low: 0.02, mid: 0.04, high: 0.07 },
    asset_intensity: "high",
    customer_concentration_red_flag_pct: 0.15,
    working_capital_pct_of_rev: 0.25,
    maintenance_capex_pct_of_rev: 0.02,
    notes: [
      "Working capital at close is a major negotiation point — peg carefully.",
      "Supplier concentration can be as dangerous as customer concentration.",
    ],
  },
  {
    key: "construction_gc",
    label: "General Construction / Contractor",
    naics_2d: "23",
    aliases: ["general contractor", "construction", "remodeling", "home builder"],
    sde_multiple: { low: 2.0, mid: 2.7, high: 3.4 },
    ebitda_multiple: { low: 3.5, mid: 4.5, high: 5.5 },
    revenue_multiple: { low: 0.25, mid: 0.40, high: 0.55 },
    typical_ebitda_margin: { low: 0.05, mid: 0.09, high: 0.14 },
    typical_gross_margin: { low: 0.18, mid: 0.25, high: 0.35 },
    owner_comp_pct_of_rev: { low: 0.03, mid: 0.06, high: 0.10 },
    asset_intensity: "medium",
    customer_concentration_red_flag_pct: 0.25,
    working_capital_pct_of_rev: 0.15,
    maintenance_capex_pct_of_rev: 0.015,
    notes: [
      "Job-cost accounting quality is a critical diligence issue.",
      "Backlog-to-revenue ratio is a leading indicator.",
    ],
  },
  {
    key: "landscaping",
    label: "Landscaping / Lawn Care",
    naics_2d: "56",
    aliases: ["landscaping", "lawn care", "tree service", "snow removal"],
    sde_multiple: { low: 2.0, mid: 2.7, high: 3.5 },
    ebitda_multiple: { low: 3.2, mid: 4.2, high: 5.3 },
    revenue_multiple: { low: 0.45, mid: 0.65, high: 0.90 },
    typical_ebitda_margin: { low: 0.10, mid: 0.15, high: 0.22 },
    typical_gross_margin: { low: 0.40, mid: 0.50, high: 0.60 },
    owner_comp_pct_of_rev: { low: 0.05, mid: 0.09, high: 0.14 },
    asset_intensity: "medium",
    customer_concentration_red_flag_pct: 0.18,
    working_capital_pct_of_rev: 0.08,
    maintenance_capex_pct_of_rev: 0.03,
    notes: [
      "Recurring (contracted) vs. one-time revenue mix drives valuation.",
      "Equipment replacement schedule is a critical capex item.",
    ],
  },
  {
    key: "childcare",
    label: "Childcare / Daycare",
    naics_2d: "62",
    aliases: ["daycare", "childcare", "preschool", "early learning"],
    sde_multiple: { low: 2.2, mid: 3.0, high: 3.8 },
    ebitda_multiple: { low: 3.8, mid: 4.8, high: 6.0 },
    revenue_multiple: { low: 0.55, mid: 0.75, high: 1.00 },
    typical_ebitda_margin: { low: 0.10, mid: 0.15, high: 0.22 },
    typical_gross_margin: { low: 0.45, mid: 0.55, high: 0.65 },
    owner_comp_pct_of_rev: { low: 0.03, mid: 0.06, high: 0.10 },
    asset_intensity: "medium",
    customer_concentration_red_flag_pct: 0.08,
    working_capital_pct_of_rev: 0.05,
    maintenance_capex_pct_of_rev: 0.015,
    notes: [
      "Licensing transfer and capacity limits are gating issues.",
      "Staffing ratios required by state set a floor on operating cost.",
    ],
  },
  {
    key: "med_spa",
    label: "Medical Spa / Aesthetic Clinic",
    naics_2d: "62",
    aliases: ["med spa", "medical spa", "aesthetic clinic", "botox clinic"],
    sde_multiple: { low: 2.5, mid: 3.5, high: 4.8 },
    ebitda_multiple: { low: 4.5, mid: 6.0, high: 8.0 },
    revenue_multiple: { low: 0.80, mid: 1.30, high: 2.00 },
    typical_ebitda_margin: { low: 0.12, mid: 0.22, high: 0.32 },
    typical_gross_margin: { low: 0.65, mid: 0.75, high: 0.85 },
    owner_comp_pct_of_rev: { low: 0.04, mid: 0.08, high: 0.12 },
    asset_intensity: "medium",
    customer_concentration_red_flag_pct: 0.15,
    working_capital_pct_of_rev: 0.05,
    maintenance_capex_pct_of_rev: 0.02,
    notes: [
      "Medical director agreement transferability is a must-verify.",
      "Recurring membership programs drive premium multiples.",
    ],
  },
  {
    key: "veterinary",
    label: "Veterinary Practice",
    naics_2d: "54",
    aliases: ["veterinary", "vet clinic", "animal hospital", "pet hospital"],
    sde_multiple: { low: 3.5, mid: 4.8, high: 6.5 },
    ebitda_multiple: { low: 6.0, mid: 8.0, high: 11.0 },
    revenue_multiple: { low: 1.00, mid: 1.40, high: 2.00 },
    typical_ebitda_margin: { low: 0.12, mid: 0.18, high: 0.26 },
    typical_gross_margin: { low: 0.65, mid: 0.72, high: 0.80 },
    owner_comp_pct_of_rev: { low: 0.10, mid: 0.15, high: 0.22 },
    asset_intensity: "medium",
    customer_concentration_red_flag_pct: 0.05,
    working_capital_pct_of_rev: 0.05,
    maintenance_capex_pct_of_rev: 0.02,
    notes: [
      "Associate veterinarian retention is make-or-break for goodwill transfer.",
      "Consolidator demand keeps multiples elevated vs. most SMBs.",
    ],
  },
  {
    key: "dental_practice",
    label: "Dental Practice",
    naics_2d: "62",
    aliases: ["dental", "dentist", "orthodontics", "dental practice"],
    sde_multiple: { low: 3.0, mid: 4.2, high: 5.5 },
    ebitda_multiple: { low: 5.0, mid: 6.8, high: 9.0 },
    revenue_multiple: { low: 0.70, mid: 1.00, high: 1.40 },
    typical_ebitda_margin: { low: 0.15, mid: 0.22, high: 0.30 },
    typical_gross_margin: { low: 0.55, mid: 0.65, high: 0.75 },
    owner_comp_pct_of_rev: { low: 0.20, mid: 0.28, high: 0.38 },
    asset_intensity: "medium",
    customer_concentration_red_flag_pct: 0.05,
    working_capital_pct_of_rev: 0.04,
    maintenance_capex_pct_of_rev: 0.025,
    notes: [
      "DSO consolidation drives premium multiples; solo practice discounts are real.",
      "Active patient count and hygienist hours are the key operating metrics.",
    ],
  },
  {
    key: "trucking_ltl",
    label: "Trucking / Transportation",
    naics_2d: "48",
    aliases: ["trucking", "logistics", "freight", "delivery route"],
    sde_multiple: { low: 1.8, mid: 2.5, high: 3.2 },
    ebitda_multiple: { low: 3.0, mid: 4.0, high: 5.0 },
    revenue_multiple: { low: 0.30, mid: 0.50, high: 0.75 },
    typical_ebitda_margin: { low: 0.05, mid: 0.10, high: 0.15 },
    typical_gross_margin: { low: 0.20, mid: 0.28, high: 0.38 },
    owner_comp_pct_of_rev: { low: 0.02, mid: 0.05, high: 0.08 },
    asset_intensity: "high",
    customer_concentration_red_flag_pct: 0.20,
    working_capital_pct_of_rev: 0.15,
    maintenance_capex_pct_of_rev: 0.055,
    notes: [
      "Fleet age and residual value dominate asset-based valuation.",
      "Driver retention and DOT compliance are critical diligence items.",
    ],
  },
  {
    key: "accounting_tax",
    label: "Accounting / Tax Practice",
    naics_2d: "54",
    aliases: ["cpa firm", "accounting practice", "tax preparation", "bookkeeping"],
    sde_multiple: { low: 2.5, mid: 3.3, high: 4.2 },
    ebitda_multiple: { low: 4.2, mid: 5.5, high: 7.0 },
    revenue_multiple: { low: 0.90, mid: 1.15, high: 1.50 },
    typical_ebitda_margin: { low: 0.20, mid: 0.28, high: 0.38 },
    typical_gross_margin: { low: 0.55, mid: 0.65, high: 0.75 },
    owner_comp_pct_of_rev: { low: 0.12, mid: 0.18, high: 0.28 },
    asset_intensity: "low",
    customer_concentration_red_flag_pct: 0.15,
    working_capital_pct_of_rev: 0.08,
    maintenance_capex_pct_of_rev: 0.005,
    notes: [
      "Recurring vs. project revenue mix drives multiple. Advisory > compliance.",
      "Client retention during transition is the #1 valuation risk.",
    ],
  },
  {
    key: "franchise_service",
    label: "Franchise (service-based)",
    naics_2d: null,
    aliases: ["franchise", "service franchise", "cleaning franchise"],
    sde_multiple: { low: 2.0, mid: 2.8, high: 3.6 },
    ebitda_multiple: { low: 3.8, mid: 4.8, high: 6.0 },
    revenue_multiple: { low: 0.55, mid: 0.80, high: 1.10 },
    typical_ebitda_margin: { low: 0.10, mid: 0.16, high: 0.24 },
    typical_gross_margin: { low: 0.50, mid: 0.60, high: 0.70 },
    owner_comp_pct_of_rev: { low: 0.04, mid: 0.08, high: 0.12 },
    asset_intensity: "low",
    customer_concentration_red_flag_pct: 0.15,
    working_capital_pct_of_rev: 0.06,
    maintenance_capex_pct_of_rev: 0.01,
    notes: [
      "Franchisor transfer fee and training requirement are closing prerequisites.",
      "Royalty burden reduces effective SDE materially vs. independent operator.",
    ],
  },
  {
    key: "cleaning_janitorial",
    label: "Cleaning / Janitorial Services",
    naics_2d: "56",
    aliases: ["cleaning", "janitorial", "commercial cleaning", "maid service"],
    sde_multiple: { low: 1.8, mid: 2.4, high: 3.1 },
    ebitda_multiple: { low: 3.0, mid: 3.8, high: 4.8 },
    revenue_multiple: { low: 0.40, mid: 0.55, high: 0.75 },
    typical_ebitda_margin: { low: 0.08, mid: 0.14, high: 0.20 },
    typical_gross_margin: { low: 0.30, mid: 0.38, high: 0.48 },
    owner_comp_pct_of_rev: { low: 0.04, mid: 0.08, high: 0.13 },
    asset_intensity: "low",
    customer_concentration_red_flag_pct: 0.20,
    working_capital_pct_of_rev: 0.10,
    maintenance_capex_pct_of_rev: 0.01,
    notes: [
      "Contract length + auto-renewal clauses are the valuation premium driver.",
      "Labor availability + wage inflation are structural margin headwinds.",
    ],
  },
  {
    key: "generic_smb_default",
    label: "Generic SMB (default)",
    naics_2d: null,
    aliases: ["other", "default", "generic"],
    sde_multiple: { low: 2.0, mid: 2.7, high: 3.5 },
    ebitda_multiple: { low: 3.5, mid: 4.5, high: 5.8 },
    revenue_multiple: { low: 0.40, mid: 0.60, high: 0.85 },
    typical_ebitda_margin: { low: 0.08, mid: 0.14, high: 0.22 },
    typical_gross_margin: { low: 0.35, mid: 0.48, high: 0.60 },
    owner_comp_pct_of_rev: { low: 0.04, mid: 0.08, high: 0.13 },
    asset_intensity: "medium",
    customer_concentration_red_flag_pct: 0.20,
    working_capital_pct_of_rev: 0.10,
    maintenance_capex_pct_of_rev: 0.02,
    notes: [
      "Fallback when no industry-specific data matched.",
      "Triangulate against at least one comp sale if possible.",
    ],
  },
];

/** Slug normalizer — lowercase, strip non-alphanumeric. */
function norm(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

/**
 * Match an industry label, NAICS 2-digit code, or arbitrary description
 * to the closest benchmark entry. Always returns a benchmark (falls back
 * to "generic_smb_default"). Matching is fuzzy on aliases.
 */
export function matchBenchmark(query: {
  label?: string | null;
  naics?: string | null;
}): IndustryBenchmark {
  const nQuery = norm(query.label ?? "");
  const naics = (query.naics ?? "").slice(0, 2);

  // 1) Exact NAICS 2-digit match (only if unambiguous).
  if (naics) {
    const byNaics = INDUSTRY_BENCHMARKS.filter((b) => b.naics_2d === naics);
    if (byNaics.length === 1) return byNaics[0];
  }

  // 2) Alias / label contains — pick best match by alias specificity.
  if (nQuery) {
    let best: IndustryBenchmark | null = null;
    let bestScore = 0;
    for (const b of INDUSTRY_BENCHMARKS) {
      const candidates = [b.label, b.key, ...b.aliases].map(norm);
      for (const c of candidates) {
        if (!c) continue;
        if (nQuery === c) return b;
        if (nQuery.includes(c) || c.includes(nQuery)) {
          // longer alias hit = more specific = better
          if (c.length > bestScore) {
            bestScore = c.length;
            best = b;
          }
        }
      }
    }
    if (best) return best;
  }

  // 3) Ambiguous NAICS — prefer the higher asset-intensity one as more conservative default.
  if (naics) {
    const byNaics = INDUSTRY_BENCHMARKS.filter((b) => b.naics_2d === naics);
    if (byNaics.length > 1) {
      return byNaics.sort((a, b) => {
        const rank = { low: 0, medium: 1, high: 2 } as const;
        return rank[a.asset_intensity] - rank[b.asset_intensity];
      })[0];
    }
  }

  return INDUSTRY_BENCHMARKS.find((b) => b.key === "generic_smb_default")!;
}

/** Look up a benchmark by its key. Returns null if not found. */
export function getBenchmarkByKey(key: string): IndustryBenchmark | null {
  return INDUSTRY_BENCHMARKS.find((b) => b.key === key) ?? null;
}

/** Return the version string so persisted outputs can pin to a dataset. */
export const INDUSTRY_BENCHMARKS_VERSION = "industry_benchmarks.v1";
