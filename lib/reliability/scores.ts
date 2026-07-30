export type SourceReliabilityClass =
  | "engineering_calculation"
  | "engineering_table_pdf"
  | "technical_product_sheet"
  | "product_catalog"
  | "cad_bim_resource"
  | "installation_guide"
  | "product_page"
  | "downloads_page"
  | "support_article"
  | "blog"
  | "homepage"
  | "marketing_landing_page"
  | "meta_tags"
  | "unknown";

/** Default reliability weights (0–1). Overridable via project file later. */
export const DEFAULT_RELIABILITY_WEIGHTS: Record<SourceReliabilityClass, number> = {
  engineering_calculation: 1.0,
  engineering_table_pdf: 0.98,
  technical_product_sheet: 0.95,
  product_catalog: 0.92,
  cad_bim_resource: 0.9,
  installation_guide: 0.9,
  product_page: 0.85,
  downloads_page: 0.8,
  support_article: 0.75,
  blog: 0.65,
  homepage: 0.6,
  marketing_landing_page: 0.5,
  meta_tags: 0.25,
  unknown: 0.55,
};

export type ReliabilityAssessment = {
  sourceClass: SourceReliabilityClass;
  reliabilityScore: number;
  rationale: string;
  overridesApplied: boolean;
};

export function classifySourceReliability(input: {
  url?: string;
  title?: string;
  fileType?: string;
  pathHints?: string;
}): ReliabilityAssessment {
  const blob = [
    input.url ?? "",
    input.title ?? "",
    input.fileType ?? "",
    input.pathHints ?? "",
  ]
    .join(" ")
    .toLowerCase();

  const path = (() => {
    try {
      return input.url ? new URL(input.url).pathname.toLowerCase() : "";
    } catch {
      return "";
    }
  })();

  let sourceClass: SourceReliabilityClass = "unknown";
  let rationale = "Default unknown source class";

  if (
    /limiting.?height|span.?table|load.?table|section.?propert/.test(blob) &&
    (input.fileType === "pdf" || /\.pdf/.test(blob))
  ) {
    sourceClass = "engineering_table_pdf";
    rationale = "Engineering table PDF signals";
  } else if (
    /calculat|engineering.?tool|design.?aid/.test(blob) &&
    !/blog|news/.test(blob)
  ) {
    sourceClass = "engineering_calculation";
    rationale = "Engineering calculation / tool signals";
  } else if (/\.(dwg|dxf|rvt|ifc)\b|bim|cad library/.test(blob)) {
    sourceClass = "cad_bim_resource";
    rationale = "CAD/BIM resource signals";
  } else if (/install|erection|handling/.test(blob)) {
    sourceClass = "installation_guide";
    rationale = "Installation guide signals";
  } else if (/product.?data|data.?sheet|tech.?sheet|submittal.?sheet/.test(blob)) {
    sourceClass = "technical_product_sheet";
    rationale = "Technical product sheet signals";
  } else if (/catalog|brochure/.test(blob)) {
    sourceClass = "product_catalog";
    rationale = "Product catalog signals";
  } else if (/\/blog\/|news|insight/.test(path) || /blog/.test(blob)) {
    sourceClass = "blog";
    rationale = "Blog/news signals";
  } else if (/support|faq|help.?center/.test(blob)) {
    sourceClass = "support_article";
    rationale = "Support article signals";
  } else if (/download/.test(path) || /downloads/.test(blob)) {
    sourceClass = "downloads_page";
    rationale = "Downloads page signals";
  } else if (path === "/" || path === "") {
    sourceClass = "homepage";
    rationale = "Site homepage";
  } else if (/landing|campaign|promo/.test(blob)) {
    sourceClass = "marketing_landing_page";
    rationale = "Marketing landing signals";
  } else if (/product|stud|track|joist|nitro|framing/.test(blob)) {
    sourceClass = "product_page";
    rationale = "Product page signals";
  } else if (/meta description|og:|json-ld only/.test(blob)) {
    sourceClass = "meta_tags";
    rationale = "Meta-tag-only evidence";
  }

  return {
    sourceClass,
    reliabilityScore: DEFAULT_RELIABILITY_WEIGHTS[sourceClass],
    rationale,
    overridesApplied: false,
  };
}

export function applyReliabilityOverrides(
  base: ReliabilityAssessment,
  overrides?: Partial<Record<SourceReliabilityClass, number>>,
): ReliabilityAssessment {
  if (!overrides || overrides[base.sourceClass] === undefined) return base;
  return {
    ...base,
    reliabilityScore: overrides[base.sourceClass]!,
    overridesApplied: true,
  };
}

const CONF_WEIGHT = { high: 1, medium: 0.7, low: 0.4 } as const;

/**
 * Weighted confidence for a recommendation from supporting evidence.
 * Combines categorical confidence with source reliability scores.
 */
export function weightedRecommendationConfidence(
  supports: Array<{
    confidence: "high" | "medium" | "low";
    reliabilityScore: number;
  }>,
): {
  score: number;
  label: "high" | "medium" | "low";
  method: string;
} {
  if (!supports.length) {
    return { score: 0, label: "low", method: "no_supporting_evidence" };
  }
  let num = 0;
  let den = 0;
  for (const s of supports) {
    const w = CONF_WEIGHT[s.confidence] * s.reliabilityScore;
    num += w;
    den += 1;
  }
  const score = num / den;
  const label = score >= 0.8 ? "high" : score >= 0.55 ? "medium" : "low";
  return {
    score: Math.round(score * 1000) / 1000,
    label,
    method: "avg(confidenceWeight * reliabilityScore)",
  };
}
