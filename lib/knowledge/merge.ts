import type {
  CandidatePattern,
  ConflictRecord,
  EvidenceRecord,
  KnowledgeEntity,
  KnowledgeIndex,
  KnowledgeRelationship,
  ProjectKnowledgeSlice,
  PromotionAuditEntry,
} from "@/lib/schemas/knowledge";
import { KNOWLEDGE_SCHEMA_VERSION } from "@/lib/schemas/knowledge";
import {
  candidatePatternId,
  conflictId,
  normalizeKey,
} from "@/lib/knowledge/ids";

export type KnowledgeStoreState = {
  entities: Map<string, KnowledgeEntity>;
  relationships: Map<string, KnowledgeRelationship>;
  evidence: Map<string, EvidenceRecord>;
  conflicts: Map<string, ConflictRecord>;
  candidatePatterns: Map<string, CandidatePattern>;
  audit: PromotionAuditEntry[];
};

export function emptyStore(): KnowledgeStoreState {
  return {
    entities: new Map(),
    relationships: new Map(),
    evidence: new Map(),
    conflicts: new Map(),
    candidatePatterns: new Map(),
    audit: [],
  };
}

function mergeStringLists(a: string[], b: string[]): string[] {
  return [...new Set([...a, ...b])];
}

export function mergeSliceIntoStore(
  store: KnowledgeStoreState,
  slice: ProjectKnowledgeSlice,
): { upsertedEntities: number; upsertedRels: number; conflictsCreated: number } {
  let conflictsCreated = 0;
  const ts = new Date().toISOString();

  for (const ev of slice.evidence) {
    const existing = store.evidence.get(ev.id);
    if (!existing) {
      store.evidence.set(ev.id, ev);
    } else {
      store.evidence.set(ev.id, {
        ...existing,
        relatedEntityIds: mergeStringLists(
          existing.relatedEntityIds,
          ev.relatedEntityIds,
        ),
        relatedRelationshipIds: mergeStringLists(
          existing.relatedRelationshipIds,
          ev.relatedRelationshipIds,
        ),
        updatedAt: ts,
        stale: false,
      });
    }
  }

  for (const ent of slice.entities) {
    const existing = store.entities.get(ent.id);
    if (!existing) {
      store.entities.set(ent.id, {
        ...ent,
        visibility:
          ent.visibility === "project_private"
            ? "shared_unreviewed"
            : ent.visibility,
      });
      continue;
    }

    // Same global industry/technology key from another project — merge projects
    if (
      existing.type === ent.type &&
      existing.normalizedKey === ent.normalizedKey &&
      (ent.type === "Industry" ||
        ent.type === "Technology" ||
        ent.type === "DocumentType")
    ) {
      store.entities.set(ent.id, {
        ...existing,
        sourceProjects: mergeStringLists(
          existing.sourceProjects,
          ent.sourceProjects,
        ),
        evidenceIds: mergeStringLists(existing.evidenceIds, ent.evidenceIds),
        updatedAt: ts,
      });
      continue;
    }

    // Property conflict on shared observationKey polarity
    const prevScore = existing.properties.score;
    const nextScore = ent.properties.score;
    if (
      typeof prevScore === "number" &&
      typeof nextScore === "number" &&
      Math.abs(prevScore - nextScore) >= 4 &&
      existing.properties.observationKey === ent.properties.observationKey &&
      existing.sourceProjects.some((p) => ent.sourceProjects.includes(p))
    ) {
      // same project re-ingest with wild swing — mark stale conflict
      const cid = conflictId([
        existing.id,
        "score",
        String(prevScore),
        String(nextScore),
      ]);
      if (!store.conflicts.has(cid)) {
        store.conflicts.set(cid, {
          id: cid,
          schemaVersion: KNOWLEDGE_SCHEMA_VERSION,
          kind: "stale_vs_fresh",
          description: `Score conflict on ${existing.name}: ${prevScore} vs ${nextScore}`,
          entityIds: [existing.id],
          relationshipIds: [],
          evidenceIds: mergeStringLists(existing.evidenceIds, ent.evidenceIds),
          sourceProjects: mergeStringLists(
            existing.sourceProjects,
            ent.sourceProjects,
          ),
          blocksPatternPromotion: true,
          reviewStatus: "needs_review",
          createdAt: ts,
          updatedAt: ts,
        });
        conflictsCreated++;
      }
      existing.conflictIds = mergeStringLists(existing.conflictIds, [cid]);
    }

    store.entities.set(ent.id, {
      ...existing,
      properties: { ...existing.properties, ...ent.properties },
      sourceProjects: mergeStringLists(
        existing.sourceProjects,
        ent.sourceProjects,
      ),
      evidenceIds: mergeStringLists(existing.evidenceIds, ent.evidenceIds),
      conflictIds: mergeStringLists(existing.conflictIds, ent.conflictIds),
      updatedAt: ts,
    });
  }

  for (const rel of slice.relationships) {
    const existing = store.relationships.get(rel.id);
    if (!existing) {
      store.relationships.set(rel.id, {
        ...rel,
        visibility:
          rel.visibility === "project_private"
            ? "shared_unreviewed"
            : rel.visibility,
      });
    } else {
      store.relationships.set(rel.id, {
        ...existing,
        evidenceIds: mergeStringLists(existing.evidenceIds, rel.evidenceIds),
        sourceProjects: mergeStringLists(
          existing.sourceProjects,
          rel.sourceProjects,
        ),
        updatedAt: ts,
      });
    }
  }

  for (const c of slice.conflicts) {
    if (!store.conflicts.has(c.id)) {
      store.conflicts.set(c.id, c);
      conflictsCreated++;
    }
  }

  // Mark evidence from this project that disappeared as stale on rebuild
  // (handled in ingest with rebuild flag)

  return {
    upsertedEntities: slice.entities.length,
    upsertedRels: slice.relationships.length,
    conflictsCreated,
  };
}

/**
 * Auto-create candidate patterns when the same normalized observation
 * appears in >= 2 independent projects, with no blocking conflicts.
 */
export function refreshCandidatePatterns(store: KnowledgeStoreState): {
  created: number;
  blocked: number;
} {
  const ts = new Date().toISOString();
  let created = 0;
  let blocked = 0;

  type Bucket = {
    observationKey: string;
    companyIds: Set<string>;
    projectSlugs: Set<string>;
    evidenceIds: Set<string>;
    conflictIds: Set<string>;
    confidences: Array<"high" | "medium" | "low">;
    names: string[];
  };

  const buckets = new Map<string, Bucket>();

  for (const ent of store.entities.values()) {
    if (ent.epistemicClass !== "observation") continue;
    const obs =
      typeof ent.properties.observationKey === "string"
        ? ent.properties.observationKey
        : null;
    if (!obs) continue;

    // Independent projects only — entity is project-scoped so count sourceProjects
    let bucket = buckets.get(obs);
    if (!bucket) {
      bucket = {
        observationKey: obs,
        companyIds: new Set(),
        projectSlugs: new Set(),
        evidenceIds: new Set(),
        conflictIds: new Set(),
        confidences: [],
        names: [],
      };
      buckets.set(obs, bucket);
    }
    for (const p of ent.sourceProjects) bucket.projectSlugs.add(p);
    for (const e of ent.evidenceIds) bucket.evidenceIds.add(e);
    for (const c of ent.conflictIds) bucket.conflictIds.add(c);
    bucket.names.push(ent.name);

    // Find company entities in same projects
    for (const other of store.entities.values()) {
      if (other.type !== "Company") continue;
      if (other.sourceProjects.some((p) => ent.sourceProjects.includes(p))) {
        bucket.companyIds.add(other.id);
      }
    }

    // confidence from first evidence
    const ev = store.evidence.get(ent.evidenceIds[0] ?? "");
    if (ev) bucket.confidences.push(ev.provenance.confidence);
  }

  for (const bucket of buckets.values()) {
    // One company with duplicate pages must not inflate — use distinct projects AND companies
    const independentProjects = bucket.projectSlugs.size;
    const independentCompanies = bucket.companyIds.size;
    if (independentProjects < 2 || independentCompanies < 2) continue;

    const blockingConflicts = [...bucket.conflictIds].filter((id) => {
      const c = store.conflicts.get(id);
      return c?.blocksPatternPromotion;
    });

    // Also block if opposing polarity observations under same category across projects
    const id = candidatePatternId(bucket.observationKey);
    const confidenceSummary =
      bucket.confidences.includes("low")
        ? "low"
        : bucket.confidences.includes("medium")
          ? "medium"
          : "high";

    if (blockingConflicts.length > 0) {
      blocked++;
      store.audit.push({
        id: `audit_${conflictId([id, "blocked", ts])}`,
        at: ts,
        action: "candidate_blocked",
        actor: "system",
        patternId: id,
        reason:
          "Conflicting evidence blocks automatic candidate pattern creation",
        details: {
          conflictIds: blockingConflicts,
          observationKey: bucket.observationKey,
        },
      });
      // Still record a blocked candidate marker for review surfacing
      store.candidatePatterns.set(id, {
        id,
        schemaVersion: KNOWLEDGE_SCHEMA_VERSION,
        type: "CandidatePattern",
        name: `Candidate: ${bucket.observationKey}`,
        normalizedObservationKey: bucket.observationKey,
        status: "candidate_unapproved",
        label:
          "Candidate pattern — unapproved. Not an industry standard, best practice, or verified conclusion. BLOCKED by conflicts — needs human review.",
        supportingCompanyIds: [...bucket.companyIds],
        supportingProjectSlugs: [...bucket.projectSlugs],
        evidenceIds: [...bucket.evidenceIds],
        confidenceSummary,
        exceptions: [`Blocked by conflicts: ${blockingConflicts.join(", ")}`],
        normalizationLogic:
          "observationKey normalized from category+signal+polarity; independence requires distinct sourceProject AND distinct Company entities",
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
      name: `Candidate: ${bucket.names[0] ?? bucket.observationKey}`,
      normalizedObservationKey: bucket.observationKey,
      status: "candidate_unapproved",
      label:
        "Candidate pattern — unapproved. Not an industry standard, best practice, or verified conclusion.",
      supportingCompanyIds: [...bucket.companyIds],
      supportingProjectSlugs: [...bucket.projectSlugs],
      evidenceIds: [...bucket.evidenceIds],
      confidenceSummary,
      exceptions: [],
      normalizationLogic:
        "observationKey = normalize(category:signal:polarity). Counts distinct projects and companies only. Duplicate pages within one project do not increase independence.",
      conflictIds: [],
      blockedByConflicts: false,
      reviewStatus: "unreviewed",
      createdAt: store.candidatePatterns.get(id)?.createdAt ?? ts,
      updatedAt: ts,
    });

    if (isNew) {
      created++;
      store.audit.push({
        id: `audit_${normalizeKey(id + ts).slice(0, 32)}`,
        at: ts,
        action: "candidate_created",
        actor: "system",
        patternId: id,
        reason: `Same normalized observation in ${independentProjects} projects / ${independentCompanies} companies`,
        details: {
          observationKey: bucket.observationKey,
          projects: [...bucket.projectSlugs],
        },
      });
    }
  }

  return { created, blocked };
}

export function buildIndex(store: KnowledgeStoreState): KnowledgeIndex {
  const byCompany: Record<string, string[]> = {};
  const byIndustry: Record<string, string[]> = {};
  const byProject: Record<string, string[]> = {};
  const byEntityType: Record<string, string[]> = {};
  const byRelationshipType: Record<string, string[]> = {};
  const byEvidenceStatus: Record<string, string[]> = {};

  for (const ent of store.entities.values()) {
    (byEntityType[ent.type] ??= []).push(ent.id);
    for (const p of ent.sourceProjects) {
      (byProject[p] ??= []).push(ent.id);
    }
    if (ent.type === "Company") {
      byCompany[ent.normalizedKey] = [ent.id];
    }
    if (ent.type === "Industry") {
      (byIndustry[ent.normalizedKey] ??= []).push(ent.id);
    }
  }

  // Map company slug-ish keys from project
  for (const [project, ids] of Object.entries(byProject)) {
    byCompany[project] = [
      ...new Set([
        ...(byCompany[project] ?? []),
        ...ids.filter((id) => store.entities.get(id)?.type === "Company"),
      ]),
    ];
  }

  for (const rel of store.relationships.values()) {
    (byRelationshipType[rel.type] ??= []).push(rel.id);
  }

  for (const ev of store.evidence.values()) {
    const status = ev.stale ? "stale" : ev.provenance.reviewStatus;
    (byEvidenceStatus[status] ??= []).push(ev.id);
  }

  return {
    schemaVersion: KNOWLEDGE_SCHEMA_VERSION,
    updatedAt: new Date().toISOString(),
    byCompany,
    byIndustry,
    byProject,
    byEntityType,
    byRelationshipType,
    byEvidenceStatus,
    candidatePatternIds: [...store.candidatePatterns.keys()],
  };
}

export function markProjectEvidenceStale(
  store: KnowledgeStoreState,
  projectSlug: string,
  activeEvidenceIds: Set<string>,
): number {
  let n = 0;
  const ts = new Date().toISOString();
  for (const ev of store.evidence.values()) {
    if (ev.provenance.sourceProject !== projectSlug) continue;
    if (activeEvidenceIds.has(ev.id)) continue;
    if (!ev.stale) {
      ev.stale = true;
      ev.provenance.reviewStatus = "stale";
      ev.updatedAt = ts;
      n++;
    }
  }
  return n;
}
