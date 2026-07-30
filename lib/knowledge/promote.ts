/**
 * Human promotion / rejection of candidate patterns.
 * Automated pipeline never promotes to industry_conclusion.
 */
import { loadStore, persistStore } from "@/lib/knowledge/store";
import { buildIndex } from "@/lib/knowledge/merge";
import { KNOWLEDGE_SCHEMA_VERSION } from "@/lib/schemas/knowledge";
import { entityId, normalizeKey } from "@/lib/knowledge/ids";
import { writeJson, knowledgePath } from "@/lib/knowledge/paths";

export function promoteCandidatePattern(input: {
  patternId: string;
  actor: string;
  reason: string;
}): void {
  const store = loadStore();
  const pattern = store.candidatePatterns.get(input.patternId);
  if (!pattern) throw new Error(`Unknown pattern ${input.patternId}`);
  if (pattern.blockedByConflicts) {
    throw new Error("Cannot promote pattern blocked by conflicts");
  }
  if (pattern.status !== "candidate_unapproved") {
    throw new Error("Pattern is not in candidate_unapproved status");
  }

  const ts = new Date().toISOString();
  const approvedId = entityId(
    "DesignPattern",
    normalizeKey(pattern.normalizedObservationKey),
    { global: true },
  );

  store.entities.set(approvedId, {
    id: approvedId,
    schemaVersion: KNOWLEDGE_SCHEMA_VERSION,
    type: "DesignPattern",
    name: pattern.name.replace(/^Candidate:\s*/i, "Approved pattern: "),
    normalizedKey: pattern.normalizedObservationKey,
    properties: {
      promotedFrom: pattern.id,
      supportingProjects: pattern.supportingProjectSlugs,
      label:
        "Human-approved reusable pattern. Still not automatically an industry standard.",
    },
    epistemicClass: "reusable_pattern",
    visibility: "industry_approved",
    sourceProjects: pattern.supportingProjectSlugs,
    evidenceIds: pattern.evidenceIds,
    reviewStatus: "approved",
    conflictIds: [],
    createdAt: ts,
    updatedAt: ts,
  });

  pattern.reviewStatus = "approved";
  pattern.updatedAt = ts;
  store.candidatePatterns.set(pattern.id, pattern);

  store.audit.push({
    id: `audit_promote_${pattern.id}_${Date.now()}`,
    at: ts,
    action: "promoted",
    actor: input.actor,
    patternId: pattern.id,
    reason: input.reason,
    details: { approvedEntityId: approvedId },
  });

  const index = buildIndex(store);
  persistStore(store, index);
  const approved = [...store.entities.values()].filter(
    (e) => e.epistemicClass === "reusable_pattern",
  );
  writeJson(knowledgePath("patterns", "approved.json"), approved);
}

export function rejectCandidatePattern(input: {
  patternId: string;
  actor: string;
  reason: string;
}): void {
  const store = loadStore();
  const pattern = store.candidatePatterns.get(input.patternId);
  if (!pattern) throw new Error(`Unknown pattern ${input.patternId}`);
  const ts = new Date().toISOString();
  pattern.reviewStatus = "rejected";
  pattern.updatedAt = ts;
  pattern.exceptions = [...pattern.exceptions, `Rejected: ${input.reason}`];
  store.candidatePatterns.set(pattern.id, pattern);
  store.audit.push({
    id: `audit_reject_${pattern.id}_${Date.now()}`,
    at: ts,
    action: "rejected",
    actor: input.actor,
    patternId: pattern.id,
    reason: input.reason,
    details: {},
  });
  persistStore(store, buildIndex(store));
}
