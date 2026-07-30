import { loadStore } from "@/lib/knowledge/store";
import { loadConcepts, getConceptById } from "@/lib/normalization/registry";
import { loadProjectMappings } from "@/lib/normalization/engine";
import type { AliasMapping } from "@/lib/normalization/schemas";
import type { KnowledgeEntity } from "@/lib/schemas/knowledge";

export type CompanyConceptPresence = {
  projectSlug: string;
  companyName: string;
  mapping: AliasMapping;
  entity: KnowledgeEntity | null;
  originalLabel: string;
  evidenceIds: string[];
};

export type ConceptComparison = {
  canonicalConceptId: string;
  canonicalName: string;
  conceptType: string;
  companies: CompanyConceptPresence[];
  companyCount: number;
  shared: boolean;
  evidenceComplete: boolean;
  conflictNotes: string[];
};

export type CrossCompanyComparisonReport = {
  generatedAt: string;
  projects: string[];
  sharedConcepts: ConceptComparison[];
  uniqueByProject: Record<string, ConceptComparison[]>;
  unmappedCounts: Record<string, number>;
  candidatePatternReady: ConceptComparison[];
};

/**
 * Compare normalized concept coverage across projects without merging project records.
 */
export function compareProjects(slugs: string[]): CrossCompanyComparisonReport {
  const store = loadStore();
  const concepts = loadConcepts();
  const byConcept = new Map<string, ConceptComparison>();
  const unmappedCounts: Record<string, number> = {};

  for (const slug of slugs) {
    const mappings = loadProjectMappings(slug);
    unmappedCounts[slug] = mappings.filter(
      (m) => !m.canonicalConceptId || m.belowThreshold,
    ).length;

    for (const m of mappings) {
      if (!m.canonicalConceptId || m.belowThreshold) continue;
      if (m.reviewStatus === "rejected" || m.reviewStatus === "ambiguous") {
        continue;
      }
      const concept = getConceptById(m.canonicalConceptId, concepts);
      if (!concept) continue;

      let row = byConcept.get(m.canonicalConceptId);
      if (!row) {
        row = {
          canonicalConceptId: m.canonicalConceptId,
          canonicalName: concept.canonical_name,
          conceptType: concept.concept_type,
          companies: [],
          companyCount: 0,
          shared: false,
          evidenceComplete: false,
          conflictNotes: [],
        };
        byConcept.set(m.canonicalConceptId, row);
      }

      const entity = m.sourceEntityId
        ? (store.entities.get(m.sourceEntityId) ?? null)
        : null;

      // Avoid double-counting same project
      if (row.companies.some((c) => c.projectSlug === slug)) continue;

      row.companies.push({
        projectSlug: slug,
        companyName: m.sourceCompany,
        mapping: m,
        entity,
        originalLabel: m.originalLabel,
        evidenceIds: m.evidenceIds,
      });
    }
  }

  const all = [...byConcept.values()].map((row) => {
    row.companyCount = row.companies.length;
    row.shared = row.companyCount >= 2;
    row.evidenceComplete = row.companies.every((c) => c.evidenceIds.length > 0);
    if (!row.evidenceComplete) {
      row.conflictNotes.push("Missing evidence on at least one company mapping");
    }
    return row;
  });

  const sharedConcepts = all.filter((r) => r.shared);
  const uniqueByProject: Record<string, ConceptComparison[]> = {};
  for (const slug of slugs) uniqueByProject[slug] = [];
  for (const row of all) {
    if (row.companyCount !== 1) continue;
    const slug = row.companies[0]?.projectSlug;
    if (slug) uniqueByProject[slug]!.push(row);
  }

  const candidatePatternReady = sharedConcepts.filter(
    (r) => r.evidenceComplete && r.conflictNotes.length === 0,
  );

  return {
    generatedAt: new Date().toISOString(),
    projects: slugs,
    sharedConcepts,
    uniqueByProject,
    unmappedCounts,
    candidatePatternReady,
  };
}
