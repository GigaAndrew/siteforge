import type { KnowledgeEntity } from "@/lib/schemas/knowledge";
import type { CanonicalConcept, MappingMethod } from "@/lib/normalization/schemas";
import { normalizeKey } from "@/lib/knowledge/ids";
import {
  rebuildAliasIndex,
  type AliasIndexEntry,
} from "@/lib/normalization/registry";

export type MappingCandidate = {
  conceptId: string;
  canonicalName: string;
  confidence: number;
  method: MappingMethod;
  matchedAlias?: string;
  notes: string;
};

/** Entity types that are normally out of scope for industry concept mapping. */
export const SKIP_TYPES = new Set([
  "Company",
  "Industry",
  "Website",
  "Page",
  "Audience",
  "Technology",
  "CMS",
  "CandidatePattern",
  "Product", // too granular / SKU-specific for industry concept patterns
  "Integration",
  "ImplementationDependency",
  "Feature",
  "DesignPattern",
  "ContentPattern",
]);

/** Prefer capability concepts over observation_signal when entity is a real tool/resource. */
const TYPE_CONCEPT_BONUS: Partial<Record<string, Record<string, number>>> = {
  Calculator: {
    "canon_engineering-calculator": 0.08,
    "canon_limiting-height-tool": 0.06,
    "canon_calculator-opportunity": -0.15,
  },
  SubmittalWorkflow: {
    "canon_submittal-workflow": 0.1,
  },
  TechnicalResource: {
    "canon_document-center": 0.08,
    "canon_technical-resources": 0.08,
  },
  ProductFamily: {
    "canon_product-family": 0.12,
  },
  Document: {
    "canon_product-family": -0.2,
    "canon_product-detail": -0.1,
    "canon_engineering-table": 0.05,
    "canon_product-data-sheet": 0.05,
    "canon_document-center": 0.03,
  },
  DigitalOpportunity: {
    "canon_calculator-opportunity": 0.08,
    "canon_engineering-calculator": -0.05,
  },
};

/**
 * Structural type → preferred concept IDs (industry-generic, not company-specific).
 * Used only as a signal together with name/alias evidence — never alone below threshold.
 */
const STRUCTURAL_HINTS: Record<string, string[]> = {
  Calculator: ["canon_engineering-calculator", "canon_limiting-height-tool"],
  ProductSelector: ["canon_product-selector"],
  SubmittalWorkflow: ["canon_submittal-workflow"],
  TechnicalResource: ["canon_technical-resources", "canon_document-center"],
  ProductFamily: ["canon_product-family"],
  Product: ["canon_product-detail", "canon_product-catalog"],
  Document: [
    "canon_document-center",
    "canon_product-data-sheet",
    "canon_installation-guide",
    "canon_specification",
    "canon_cad-bim-resource",
    "canon_code-report",
    "canon_engineering-table",
  ],
  DocumentType: [
    "canon_product-data-sheet",
    "canon_specification",
    "canon_cad-bim-resource",
    "canon_engineering-table",
  ],
  NavigationPattern: ["canon_navigation-pattern"],
  Form: ["canon_contact-rep-locator", "canon_download-workflow"],
  EngineeringWorkflow: ["canon_engineering-calculator", "canon_submittal-workflow"],
  ProcessIssue: [
    "canon_submittal-workflow",
    "canon_engineering-calculator",
    "canon_download-workflow",
    "canon_calculator-opportunity",
  ],
  DigitalOpportunity: [
    "canon_calculator-opportunity",
    "canon_product-catalog",
    "canon_search-experience",
    "canon_document-center",
    "canon_submittal-workflow",
  ],
  UxIssue: [
    "canon_mobile-experience-gap",
    "canon_seo-metadata-gap",
    "canon_accessibility-gap",
    "canon_performance-gap",
    "canon_search-experience",
    "canon_navigation-pattern",
  ],
  AccessibilityIssue: ["canon_accessibility-gap"],
  SeoIssue: ["canon_seo-metadata-gap"],
  PerformanceIssue: ["canon_performance-gap"],
};

function tokenSet(key: string): Set<string> {
  return new Set(key.split("-").filter((t) => t.length > 2));
}

function jaccard(a: Set<string>, b: Set<string>): number {
  if (!a.size || !b.size) return 0;
  let inter = 0;
  for (const t of a) if (b.has(t)) inter++;
  return inter / (a.size + b.size - inter);
}

function conceptMap(concepts: CanonicalConcept[]): Map<string, CanonicalConcept> {
  return new Map(concepts.map((c) => [c.id, c]));
}

/**
 * Score candidate canonical mappings for one entity.
 * Does not map from string similarity alone — requires alias, exact, structural+name,
 * or semantic overlap with a registered alias/canonical token set.
 */
export function scoreEntityMappings(
  entity: KnowledgeEntity,
  projectSlug: string,
  concepts: CanonicalConcept[],
  aliasIndex?: AliasIndexEntry[],
): MappingCandidate[] {
  if (SKIP_TYPES.has(entity.type)) return [];

  const index = aliasIndex ?? rebuildAliasIndex(concepts);
  const byId = conceptMap(concepts);
  const label = entity.name;
  const lexical = normalizeKey(
    [
      entity.name,
      typeof entity.properties.observationKey === "string"
        ? entity.properties.observationKey
        : "",
      entity.normalizedKey,
    ]
      .filter(Boolean)
      .join(" "),
  );
  const labelKey = normalizeKey(label);
  const obsKey =
    typeof entity.properties.observationKey === "string"
      ? normalizeKey(entity.properties.observationKey)
      : "";

  const scored = new Map<string, MappingCandidate>();

  const consider = (c: MappingCandidate) => {
    const prev = scored.get(c.conceptId);
    if (!prev || c.confidence > prev.confidence) scored.set(c.conceptId, c);
  };

  // 1) Exact / alias / company-specific alias
  for (const entry of index) {
    if (
      entry.source === "company_specific" &&
      entry.companySlug &&
      entry.companySlug !== projectSlug
    ) {
      continue;
    }
    const concept = byId.get(entry.conceptId);
    if (!concept || concept.status === "deprecated") continue;

    if (labelKey === entry.lexicalKey || lexical === entry.lexicalKey) {
      consider({
        conceptId: entry.conceptId,
        canonicalName: concept.canonical_name,
        confidence: entry.source === "canonical_name" ? 0.96 : 0.9,
        method: entry.source === "canonical_name" ? "exact" : "alias",
        matchedAlias: entry.alias,
        notes: `Exact lexical match on ${entry.source}`,
      });
      continue;
    }

    // Contained alias (semantic-ish, still registry-backed)
    if (
      entry.lexicalKey.length >= 6 &&
      (lexical.includes(entry.lexicalKey) || labelKey.includes(entry.lexicalKey))
    ) {
      consider({
        conceptId: entry.conceptId,
        canonicalName: concept.canonical_name,
        confidence: 0.82,
        method: "semantic",
        matchedAlias: entry.alias,
        notes: `Label contains registered alias "${entry.alias}"`,
      });
    }

    if (
      obsKey &&
      entry.lexicalKey.length >= 6 &&
      obsKey.includes(entry.lexicalKey)
    ) {
      consider({
        conceptId: entry.conceptId,
        canonicalName: concept.canonical_name,
        confidence: 0.8,
        method: "semantic",
        matchedAlias: entry.alias,
        notes: `Observation key contains registered alias "${entry.alias}"`,
      });
    }
  }

  // 2) Structural hints + token overlap with concept aliases (not structure alone)
  const hints = STRUCTURAL_HINTS[entity.type] ?? [];
  const entityTokens = tokenSet(lexical);
  for (const conceptId of hints) {
    const concept = byId.get(conceptId);
    if (!concept) continue;
    const aliasTokens = new Set<string>();
    for (const a of [concept.canonical_name, ...concept.aliases]) {
      for (const t of tokenSet(normalizeKey(a))) aliasTokens.add(t);
    }
    const overlap = jaccard(entityTokens, aliasTokens);
    if (overlap >= 0.25) {
      consider({
        conceptId,
        canonicalName: concept.canonical_name,
        confidence: Math.min(0.88, 0.7 + overlap * 0.25),
        method: "structural",
        notes: `Entity type ${entity.type} + alias token overlap ${overlap.toFixed(2)}`,
      });
    } else if (hints.length === 1 && entity.type === "ProductSelector") {
      // Single unambiguous tool type with dedicated concept
      consider({
        conceptId,
        canonicalName: concept.canonical_name,
        confidence: 0.78,
        method: "structural",
        notes: `Unambiguous structural type ${entity.type}`,
      });
    }
  }

  // 3) Pure token overlap against alias index (semantic) — requires >= 0.4 jaccard
  for (const concept of concepts) {
    if (concept.status === "deprecated") continue;
    const aliasTokens = new Set<string>();
    for (const a of [concept.canonical_name, ...concept.aliases]) {
      for (const t of tokenSet(normalizeKey(a))) aliasTokens.add(t);
    }
    const overlap = jaccard(entityTokens, aliasTokens);
    if (overlap >= 0.45) {
      consider({
        conceptId: concept.id,
        canonicalName: concept.canonical_name,
        confidence: Math.min(0.86, 0.65 + overlap * 0.3),
        method: "semantic",
        notes: `Semantic token overlap ${overlap.toFixed(2)} with registered aliases`,
      });
    }
  }

  // Apply type-aware confidence adjustments (breaks alias ties cleanly)
  const bonuses = TYPE_CONCEPT_BONUS[entity.type] ?? {};
  for (const [id, c] of scored) {
    const delta = bonuses[id] ?? 0;
    if (delta !== 0) {
      c.confidence = Math.max(0, Math.min(0.99, c.confidence + delta));
      c.notes = `${c.notes}; type_bonus=${delta.toFixed(2)}`;
    }
  }

  return [...scored.values()].sort((a, b) => b.confidence - a.confidence);
}

export function pickBestMapping(
  candidates: MappingCandidate[],
  threshold: number,
): {
  best: MappingCandidate | null;
  ambiguous: boolean;
  ambiguityNotes: string;
  belowThreshold: boolean;
} {
  if (!candidates.length) {
    return {
      best: null,
      ambiguous: false,
      ambiguityNotes: "",
      belowThreshold: false,
    };
  }
  const best = candidates[0]!;
  const second = candidates[1];
  const ambiguous = Boolean(
    second && Math.abs(best.confidence - second.confidence) < 0.06,
  );
  const belowThreshold = best.confidence < threshold;
  return {
    best: belowThreshold || ambiguous ? (ambiguous ? null : best) : best,
    ambiguous,
    ambiguityNotes: ambiguous
      ? `Ambiguous between ${best.canonicalName} (${best.confidence.toFixed(2)}) and ${second!.canonicalName} (${second!.confidence.toFixed(2)})`
      : "",
    belowThreshold,
  };
}
