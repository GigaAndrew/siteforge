import { describe, expect, it } from "vitest";
import {
  candidatePatternId,
  entityId,
  normalizeKey,
  observationKey,
  relationshipId,
} from "@/lib/knowledge/ids";
import {
  buildIndex,
  emptyStore,
  mergeSliceIntoStore,
  refreshCandidatePatterns,
} from "@/lib/knowledge/merge";
import type { ProjectKnowledgeSlice } from "@/lib/schemas/knowledge";
import { KNOWLEDGE_SCHEMA_VERSION } from "@/lib/schemas/knowledge";

describe("knowledge ids", () => {
  it("is stable for same inputs", () => {
    const a = entityId("Company", "eb-metal-us", { projectSlug: "eb-metal" });
    const b = entityId("Company", "eb-metal-us", { projectSlug: "eb-metal" });
    expect(a).toBe(b);
    expect(normalizeKey("Cold-Formed Steel!")).toBe("cold-formed-steel");
  });

  it("scopes project entities separately from global", () => {
    const local = entityId("Product", "stud", { projectSlug: "a" });
    const global = entityId("Industry", "cfs", { global: true });
    expect(local).not.toBe(global);
  });

  it("builds relationship and candidate ids", () => {
    expect(
      relationshipId("COMPANY_HAS_WEBSITE", "a", "b", "eb-metal"),
    ).toMatch(/^rel_/);
    expect(candidatePatternId("nav:x")).toMatch(/^cpat_/);
  });
});

describe("candidate pattern promotion rules", () => {
  function obsEntity(
    id: string,
    project: string,
    companyId: string,
    obsKey: string,
  ) {
    return {
      id,
      schemaVersion: KNOWLEDGE_SCHEMA_VERSION,
      type: "UxIssue" as const,
      name: "Weak calculators",
      normalizedKey: obsKey,
      properties: { observationKey: obsKey, score: 2 },
      epistemicClass: "observation" as const,
      visibility: "shared_unreviewed" as const,
      sourceProjects: [project],
      evidenceIds: [`ev-${project}`],
      reviewStatus: "unreviewed" as const,
      conflictIds: [] as string[],
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z",
    };
  }

  it("does not create candidate from a single project", () => {
    const store = emptyStore();
    const obs = observationKey({
      category: "calculators",
      signal: "weak",
      polarity: "weak",
    });
    store.entities.set(
      "c1",
      {
        id: "c1",
        schemaVersion: KNOWLEDGE_SCHEMA_VERSION,
        type: "Company",
        name: "A",
        normalizedKey: "a",
        properties: {},
        epistemicClass: "fact",
        visibility: "shared_unreviewed",
        sourceProjects: ["proj-a"],
        evidenceIds: [],
        reviewStatus: "unreviewed",
        conflictIds: [],
        createdAt: "2026-01-01T00:00:00.000Z",
        updatedAt: "2026-01-01T00:00:00.000Z",
      },
    );
    store.entities.set("o1", obsEntity("o1", "proj-a", "c1", obs));
    store.entities.set("o1b", obsEntity("o1b", "proj-a", "c1", obs));
    const stats = refreshCandidatePatterns(store);
    expect(stats.created).toBe(0);
    expect(store.candidatePatterns.size).toBe(0);
  });

  it("creates unapproved candidate across two companies/projects", () => {
    const store = emptyStore();
    const obs = observationKey({
      category: "calculators",
      signal: "weak",
      polarity: "weak",
    });
    for (const [cid, proj, name] of [
      ["c1", "proj-a", "A"],
      ["c2", "proj-b", "B"],
    ] as const) {
      store.entities.set(cid, {
        id: cid,
        schemaVersion: KNOWLEDGE_SCHEMA_VERSION,
        type: "Company",
        name,
        normalizedKey: name.toLowerCase(),
        properties: {},
        epistemicClass: "fact",
        visibility: "shared_unreviewed",
        sourceProjects: [proj],
        evidenceIds: [],
        reviewStatus: "unreviewed",
        conflictIds: [],
        createdAt: "2026-01-01T00:00:00.000Z",
        updatedAt: "2026-01-01T00:00:00.000Z",
      });
      store.entities.set(
        `o-${proj}`,
        obsEntity(`o-${proj}`, proj, cid, obs),
      );
      store.evidence.set(`ev-${proj}`, {
        id: `ev-${proj}`,
        schemaVersion: KNOWLEDGE_SCHEMA_VERSION,
        provenance: {
          sourceCompany: name,
          sourceProject: proj,
          captureDate: "2026-01-01T00:00:00.000Z",
          confidence: "medium",
          extractionMethod: "audit_map",
          reviewStatus: "unreviewed",
          epistemicClass: "observation",
          visibility: "shared_unreviewed",
        },
        relatedEntityIds: [],
        relatedRelationshipIds: [],
        stale: false,
        createdAt: "2026-01-01T00:00:00.000Z",
        updatedAt: "2026-01-01T00:00:00.000Z",
      });
    }

    const stats = refreshCandidatePatterns(store);
    expect(stats.created).toBe(1);
    const pattern = [...store.candidatePatterns.values()][0]!;
    expect(pattern.status).toBe("candidate_unapproved");
    expect(pattern.label).toMatch(/unapproved/i);
    expect(pattern.label).toMatch(/Not an industry standard/i);
    expect(pattern.supportingProjectSlugs.sort()).toEqual(["proj-a", "proj-b"]);
  });

  it("blocks candidate when conflicts present", () => {
    const store = emptyStore();
    const obs = observationKey({
      category: "seo",
      signal: "weak",
      polarity: "weak",
    });
    store.conflicts.set("conflict_1", {
      id: "conflict_1",
      schemaVersion: KNOWLEDGE_SCHEMA_VERSION,
      kind: "entity_property_mismatch",
      description: "test",
      entityIds: ["o-proj-a"],
      relationshipIds: [],
      evidenceIds: [],
      sourceProjects: ["proj-a", "proj-b"],
      blocksPatternPromotion: true,
      reviewStatus: "needs_review",
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z",
    });
    for (const [cid, proj, name] of [
      ["c1", "proj-a", "A"],
      ["c2", "proj-b", "B"],
    ] as const) {
      store.entities.set(cid, {
        id: cid,
        schemaVersion: KNOWLEDGE_SCHEMA_VERSION,
        type: "Company",
        name,
        normalizedKey: name.toLowerCase(),
        properties: {},
        epistemicClass: "fact",
        visibility: "shared_unreviewed",
        sourceProjects: [proj],
        evidenceIds: [],
        reviewStatus: "unreviewed",
        conflictIds: [],
        createdAt: "2026-01-01T00:00:00.000Z",
        updatedAt: "2026-01-01T00:00:00.000Z",
      });
      const ent = obsEntity(`o-${proj}`, proj, cid, obs);
      ent.conflictIds = ["conflict_1"];
      store.entities.set(ent.id, ent);
      store.evidence.set(`ev-${proj}`, {
        id: `ev-${proj}`,
        schemaVersion: KNOWLEDGE_SCHEMA_VERSION,
        provenance: {
          sourceCompany: name,
          sourceProject: proj,
          captureDate: "2026-01-01T00:00:00.000Z",
          confidence: "medium",
          extractionMethod: "audit_map",
          reviewStatus: "unreviewed",
          epistemicClass: "observation",
          visibility: "shared_unreviewed",
        },
        relatedEntityIds: [],
        relatedRelationshipIds: [],
        stale: false,
        createdAt: "2026-01-01T00:00:00.000Z",
        updatedAt: "2026-01-01T00:00:00.000Z",
      });
    }
    const stats = refreshCandidatePatterns(store);
    expect(stats.created).toBe(0);
    expect(stats.blocked).toBe(1);
    const pattern = [...store.candidatePatterns.values()][0]!;
    expect(pattern.blockedByConflicts).toBe(true);
    expect(pattern.reviewStatus).toBe("needs_review");
  });
});

describe("merge slice", () => {
  it("merges idempotently by id", () => {
    const store = emptyStore();
    const slice: ProjectKnowledgeSlice = {
      schemaVersion: KNOWLEDGE_SCHEMA_VERSION,
      projectSlug: "eb-metal",
      companyName: "EB Metal US",
      industry: "CFS",
      extractedAt: "2026-01-01T00:00:00.000Z",
      sourceArtifactHashes: {},
      entities: [
        {
          id: "ent_1",
          schemaVersion: KNOWLEDGE_SCHEMA_VERSION,
          type: "Company",
          name: "EB Metal US",
          normalizedKey: "eb-metal-us",
          properties: {},
          epistemicClass: "fact",
          visibility: "project_private",
          sourceProjects: ["eb-metal"],
          evidenceIds: ["ev1"],
          reviewStatus: "unreviewed",
          conflictIds: [],
          createdAt: "2026-01-01T00:00:00.000Z",
          updatedAt: "2026-01-01T00:00:00.000Z",
        },
      ],
      relationships: [],
      evidence: [],
      conflicts: [],
    };
    mergeSliceIntoStore(store, slice);
    mergeSliceIntoStore(store, slice);
    expect(store.entities.size).toBe(1);
    const index = buildIndex(store);
    expect(index.byProject["eb-metal"]).toContain("ent_1");
  });
});
