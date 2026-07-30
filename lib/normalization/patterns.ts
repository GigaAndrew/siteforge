import { candidatePatternId, conflictId, normalizeKey } from "@/lib/knowledge/ids";
import type { KnowledgeStoreState } from "@/lib/knowledge/merge";
import { KNOWLEDGE_SCHEMA_VERSION } from "@/lib/schemas/knowledge";
import { compareProjects } from "@/lib/normalization/compare";
import { listProjectSlugs } from "@/lib/project";
import { loadProjectMappings } from "@/lib/normalization/engine";
import { getConceptById, loadConcepts } from "@/lib/normalization/registry";
import fs from "node:fs";
import { normalizationPath } from "@/lib/normalization/paths";
import { writeJson } from "@/lib/knowledge/paths";

/**
 * Generate candidate patterns from successful cross-company canonical mappings.
 * Patterns remain candidate_unapproved — never auto-promoted.
 *
 * Rules:
 * - ≥2 companies with mapped evidence
 * - normalization succeeded (confirmed or auto-mapped above threshold)
 * - no blocking unresolved conflict on supporting entities
 * - not inferred from naming similarity alone (requires registry mapping)
 */
export function refreshCanonicalCandidatePatterns(
  store: KnowledgeStoreState,
  projectSlugs?: string[],
): { created: number; blocked: number; refreshed: number } {
  const ts = new Date().toISOString();
  const slugs =
    projectSlugs ??
    listProjectSlugs().filter((s) =>
      fs.existsSync(
        `${process.cwd()}/projects/${s}/knowledge/normalization/mappings.json`,
      ),
    );

  if (slugs.length < 2) {
    return { created: 0, blocked: 0, refreshed: 0 };
  }

  const report = compareProjects(slugs);
  const concepts = loadConcepts();
  let created = 0;
  let blocked = 0;
  let refreshed = 0;

  for (const row of report.sharedConcepts) {
    const concept = getConceptById(row.canonicalConceptId, concepts);
    if (!concept) continue;

    const companyIds = new Set<string>();
    const projectSet = new Set<string>();
    const evidenceIds = new Set<string>();
    const conflictIds = new Set<string>();
    const confidences: Array<"high" | "medium" | "low"> = [];

    for (const c of row.companies) {
      projectSet.add(c.projectSlug);
      for (const ev of c.evidenceIds) evidenceIds.add(ev);
      if (c.entity) {
        for (const cid of c.entity.conflictIds) conflictIds.add(cid);
        // Resolve company entity for project
        for (const ent of store.entities.values()) {
          if (ent.type !== "Company") continue;
          if (ent.sourceProjects.includes(c.projectSlug)) {
            companyIds.add(ent.id);
          }
        }
      } else {
        for (const ent of store.entities.values()) {
          if (ent.type !== "Company") continue;
          if (ent.sourceProjects.includes(c.projectSlug)) {
            companyIds.add(ent.id);
          }
        }
      }
      const conf = c.mapping.mappingConfidence;
      confidences.push(conf >= 0.9 ? "high" : conf >= 0.75 ? "medium" : "low");
    }

    if (projectSet.size < 2 || companyIds.size < 2) continue;
    if (!row.evidenceComplete) {
      blocked++;
      continue;
    }

    // Reject if any supporting mapping is merely below-threshold leftover
    const allMappingsOk = row.companies.every((c) => {
      const m = c.mapping;
      return (
        m.canonicalConceptId &&
        !m.belowThreshold &&
        m.reviewStatus !== "rejected" &&
        m.reviewStatus !== "ambiguous"
      );
    });
    if (!allMappingsOk) {
      blocked++;
      continue;
    }

    const obsKey = normalizeKey(`canonical:${row.canonicalConceptId}`);
    const id = candidatePatternId(obsKey);
    const blockingConflicts = [...conflictIds].filter((cid) => {
      const c = store.conflicts.get(cid);
      return c?.blocksPatternPromotion;
    });

    const confidenceSummary = confidences.includes("low")
      ? "low"
      : confidences.includes("medium")
        ? "medium"
        : "high";

    const labels = row.companies.map(
      (c) => `${c.companyName}: "${c.originalLabel}"`,
    );

    if (blockingConflicts.length > 0) {
      blocked++;
      store.candidatePatterns.set(id, {
        id,
        schemaVersion: KNOWLEDGE_SCHEMA_VERSION,
        type: "CandidatePattern",
        name: `Candidate: ${concept.canonical_name}`,
        normalizedObservationKey: obsKey,
        status: "candidate_unapproved",
        label:
          "Candidate pattern — unapproved. Derived from canonical concept mappings. BLOCKED by conflicts — needs human review.",
        supportingCompanyIds: [...companyIds],
        supportingProjectSlugs: [...projectSet],
        evidenceIds: [...evidenceIds],
        confidenceSummary,
        exceptions: [
          `Blocked by conflicts: ${blockingConflicts.join(", ")}`,
          ...labels,
        ],
        normalizationLogic:
          "canonical concept registry mapping across independent companies; requires evidence per company; not auto-promoted",
        conflictIds: blockingConflicts,
        blockedByConflicts: true,
        reviewStatus: "needs_review",
        createdAt: store.candidatePatterns.get(id)?.createdAt ?? ts,
        updatedAt: ts,
      });
      continue;
    }

    const isNew = !store.candidatePatterns.has(id);
    store.candidatePatterns.set(id, {
      id,
      schemaVersion: KNOWLEDGE_SCHEMA_VERSION,
      type: "CandidatePattern",
      name: `Candidate: ${concept.canonical_name}`,
      normalizedObservationKey: obsKey,
      status: "candidate_unapproved",
      label:
        "Candidate pattern — unapproved. Not an industry standard, best practice, or verified conclusion. Sourced from cross-company canonical normalization.",
      supportingCompanyIds: [...companyIds],
      supportingProjectSlugs: [...projectSet],
      evidenceIds: [...evidenceIds],
      confidenceSummary,
      exceptions: labels,
      normalizationLogic:
        "Entities mapped to the same canonical concept via alias/exact/structural/semantic/manual methods with evidence; independence requires distinct projects and Company entities. Human promotion still required.",
      conflictIds: [],
      blockedByConflicts: false,
      reviewStatus: "unreviewed",
      createdAt: store.candidatePatterns.get(id)?.createdAt ?? ts,
      updatedAt: ts,
    });

    refreshed++;
    if (isNew) {
      created++;
      store.audit.push({
        id: `audit_${conflictId([id, "canon", ts])}`,
        at: ts,
        action: "candidate_created",
        actor: "system",
        patternId: id,
        reason: `Canonical concept "${concept.canonical_name}" present in ${projectSet.size} projects / ${companyIds.size} companies`,
        details: {
          canonicalConceptId: row.canonicalConceptId,
          projects: [...projectSet],
          methods: row.companies.map((c) => c.mapping.mappingMethod),
        },
      });
    }
  }

  writeJson(normalizationPath("indexes", "cross-company-comparison.json"), {
    ...report,
    patternStats: { created, blocked, refreshed },
  });

  return { created, blocked, refreshed };
}

/** Convenience: load mappings presence for status CLI. */
export function projectsWithNormalization(): string[] {
  return listProjectSlugs().filter((s) =>
    fs.existsSync(
      `${process.cwd()}/projects/${s}/knowledge/normalization/mappings.json`,
    ),
  );
}

export function mappingCoverageSummary(slug: string): {
  total: number;
  mapped: number;
  methods: Record<string, number>;
} {
  const mappings = loadProjectMappings(slug);
  const methods: Record<string, number> = {};
  let mapped = 0;
  for (const m of mappings) {
    methods[m.mappingMethod] = (methods[m.mappingMethod] ?? 0) + 1;
    if (m.canonicalConceptId && !m.belowThreshold) mapped++;
  }
  return { total: mappings.length, mapped, methods };
}
