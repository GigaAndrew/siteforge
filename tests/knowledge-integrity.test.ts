import { describe, expect, it } from "vitest";
import {
  emptyStore,
  mergeSliceIntoStore,
  refreshCandidatePatterns,
  buildIndex,
} from "@/lib/knowledge/merge";
import { inspectKnowledge } from "@/lib/knowledge/inspect";
import { loadStore } from "@/lib/knowledge/store";
import { observationKey } from "@/lib/knowledge/ids";
import {
  KNOWLEDGE_SCHEMA_VERSION,
  type KnowledgeEntity,
  type ProjectKnowledgeSlice,
} from "@/lib/schemas/knowledge";
import { extractProjectKnowledge } from "@/lib/knowledge/extract";
import fs from "node:fs";
import { knowledgePath } from "@/lib/knowledge/paths";

function company(
  id: string,
  project: string,
  name: string,
): KnowledgeEntity {
  return {
    id,
    schemaVersion: KNOWLEDGE_SCHEMA_VERSION,
    type: "Company",
    name,
    normalizedKey: name.toLowerCase(),
    properties: {},
    epistemicClass: "fact",
    visibility: "shared_unreviewed",
    sourceProjects: [project],
    evidenceIds: [`ev-${project}`],
    reviewStatus: "unreviewed",
    conflictIds: [],
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
  };
}

describe("knowledge integrity — live store (eb-metal)", () => {
  it("every relationship endpoint exists", () => {
    const store = loadStore();
    for (const rel of store.relationships.values()) {
      expect(store.entities.has(rel.fromId)).toBe(true);
      expect(store.entities.has(rel.toId)).toBe(true);
    }
  });

  it("every factual entity has evidence unless exempted", () => {
    const store = loadStore();
    const exempt = new Set(["Industry"]);
    for (const ent of store.entities.values()) {
      if (ent.epistemicClass !== "fact") continue;
      if (exempt.has(ent.type)) continue;
      expect(ent.evidenceIds.length).toBeGreaterThan(0);
    }
  });

  it("every evidence record points to an existing source project", () => {
    const store = loadStore();
    for (const ev of store.evidence.values()) {
      expect(ev.provenance.sourceProject.length).toBeGreaterThan(0);
      expect(
        fs.existsSync(
          `${process.cwd()}/projects/${ev.provenance.sourceProject}/config.json`,
        ),
      ).toBe(true);
    }
  });

  it("every source URL is validly formatted when present", () => {
    const store = loadStore();
    for (const ev of store.evidence.values()) {
      const url = ev.provenance.sourceUrl;
      if (!url) continue;
      expect(() => new URL(url)).not.toThrow();
      expect(url.startsWith("http://") || url.startsWith("https://")).toBe(
        true,
      );
    }
  });

  it("recommendations are not classified as observed facts", () => {
    const store = loadStore();
    for (const ent of store.entities.values()) {
      if (ent.epistemicClass === "recommendation") {
        expect(ent.epistemicClass).not.toBe("fact");
      }
      if (
        ent.type === "Calculator" &&
        ent.properties.classification === "conceptual"
      ) {
        expect(ent.epistemicClass).toBe("recommendation");
      }
      if (ent.type === "DigitalOpportunity") {
        expect(ent.epistemicClass).toBe("recommendation");
      }
    }
  });

  it("inferences are not approved reusable patterns without review", () => {
    const store = loadStore();
    for (const ent of store.entities.values()) {
      if (ent.epistemicClass === "inference") {
        expect(ent.reviewStatus).not.toBe("approved");
        expect(ent.visibility).not.toBe("industry_approved");
      }
    }
  });

  it("visibility classifications are present", () => {
    const store = loadStore();
    for (const ent of store.entities.values()) {
      expect(ent.visibility).toBeTruthy();
    }
  });

  it("schema version is written to latest export", () => {
    const latestPath = knowledgePath("exports", "latest.json");
    expect(fs.existsSync(latestPath)).toBe(true);
    const latest = JSON.parse(fs.readFileSync(latestPath, "utf8")) as {
      schemaVersion: string;
    };
    expect(latest.schemaVersion).toBe(KNOWLEDGE_SCHEMA_VERSION);
  });

  it("inspect reports schema version and zero missing endpoints for eb-metal", () => {
    const insp = inspectKnowledge({ slug: "eb-metal" });
    expect(insp.schemaVersion).toBe(KNOWLEDGE_SCHEMA_VERSION);
    expect(
      insp.issues.filter((i) => i.category === "missing_endpoints"),
    ).toHaveLength(0);
    expect(
      insp.issues.filter((i) => i.category === "unsupported_facts"),
    ).toHaveLength(0);
  });

  it("extract is deterministic for entity/relationship counts", () => {
    const a = extractProjectKnowledge("eb-metal");
    const b = extractProjectKnowledge("eb-metal");
    expect(a.entities.length).toBe(b.entities.length);
    expect(a.relationships.length).toBe(b.relationships.length);
    expect(a.evidence.length).toBe(b.evidence.length);
    const idsA = a.entities.map((e) => e.id).sort();
    const idsB = b.entities.map((e) => e.id).sort();
    expect(idsA).toEqual(idsB);
  });
});

describe("knowledge integrity — synthetic rules", () => {
  it("candidate patterns cannot be created from one company", () => {
    const store = emptyStore();
    const obs = observationKey({
      category: "calculators",
      signal: "weak",
      polarity: "weak",
    });
    store.entities.set("c1", company("c1", "proj-a", "Acme"));
    // Two projects but SAME company identity reused — still one company id
    store.entities.set("o1", {
      id: "o1",
      schemaVersion: KNOWLEDGE_SCHEMA_VERSION,
      type: "UxIssue",
      name: "Weak calculators",
      normalizedKey: obs,
      properties: { observationKey: obs },
      epistemicClass: "observation",
      visibility: "shared_unreviewed",
      sourceProjects: ["proj-a"],
      evidenceIds: ["ev-proj-a"],
      reviewStatus: "unreviewed",
      conflictIds: [],
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z",
    });
    store.entities.set("o2", {
      id: "o2",
      schemaVersion: KNOWLEDGE_SCHEMA_VERSION,
      type: "UxIssue",
      name: "Weak calculators",
      normalizedKey: obs,
      properties: { observationKey: obs },
      epistemicClass: "observation",
      visibility: "shared_unreviewed",
      sourceProjects: ["proj-a-v2"],
      evidenceIds: ["ev-proj-a-v2"],
      reviewStatus: "unreviewed",
      conflictIds: [],
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z",
    });
    // Link both projects to same company entity
    store.entities.get("c1")!.sourceProjects = ["proj-a", "proj-a-v2"];
    store.evidence.set("ev-proj-a", {
      id: "ev-proj-a",
      schemaVersion: KNOWLEDGE_SCHEMA_VERSION,
      provenance: {
        sourceCompany: "Acme",
        sourceProject: "proj-a",
        captureDate: "2026-01-01T00:00:00.000Z",
        confidence: "medium",
        extractionMethod: "audit_map",
        reviewStatus: "unreviewed",
        epistemicClass: "observation",
        visibility: "shared_unreviewed",
      },
      relatedEntityIds: ["o1"],
      relatedRelationshipIds: [],
      stale: false,
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z",
    });
    store.evidence.set("ev-proj-a-v2", {
      id: "ev-proj-a-v2",
      schemaVersion: KNOWLEDGE_SCHEMA_VERSION,
      provenance: {
        sourceCompany: "Acme",
        sourceProject: "proj-a-v2",
        captureDate: "2026-01-01T00:00:00.000Z",
        confidence: "medium",
        extractionMethod: "audit_map",
        reviewStatus: "unreviewed",
        epistemicClass: "observation",
        visibility: "shared_unreviewed",
      },
      relatedEntityIds: ["o2"],
      relatedRelationshipIds: [],
      stale: false,
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z",
    });

    const stats = refreshCandidatePatterns(store);
    expect(stats.created).toBe(0);
  });

  it("conflicting evidence blocks pattern promotion", () => {
    const store = emptyStore();
    const obs = observationKey({
      category: "seo",
      signal: "weak",
      polarity: "weak",
    });
    store.conflicts.set("conflict_x", {
      id: "conflict_x",
      schemaVersion: KNOWLEDGE_SCHEMA_VERSION,
      kind: "entity_property_mismatch",
      description: "conflict",
      entityIds: ["o-a"],
      relationshipIds: [],
      evidenceIds: [],
      sourceProjects: ["p1", "p2"],
      blocksPatternPromotion: true,
      reviewStatus: "needs_review",
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z",
    });
    for (const [cid, proj, name] of [
      ["c1", "p1", "One"],
      ["c2", "p2", "Two"],
    ] as const) {
      store.entities.set(cid, company(cid, proj, name));
      store.entities.set(`o-${proj}`, {
        id: `o-${proj}`,
        schemaVersion: KNOWLEDGE_SCHEMA_VERSION,
        type: "SeoIssue",
        name: "SEO weak",
        normalizedKey: obs,
        properties: { observationKey: obs },
        epistemicClass: "observation",
        visibility: "shared_unreviewed",
        sourceProjects: [proj],
        evidenceIds: [`ev-${proj}`],
        reviewStatus: "unreviewed",
        conflictIds: ["conflict_x"],
        createdAt: "2026-01-01T00:00:00.000Z",
        updatedAt: "2026-01-01T00:00:00.000Z",
      });
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
    expect(stats.blocked).toBe(1);
    expect(stats.created).toBe(0);
  });

  it("duplicate merge remains idempotent and force-style replace leaves no orphan rel endpoints", () => {
    const store = emptyStore();
    const slice: ProjectKnowledgeSlice = {
      schemaVersion: KNOWLEDGE_SCHEMA_VERSION,
      projectSlug: "demo",
      companyName: "Demo",
      industry: "CFS",
      extractedAt: "2026-01-01T00:00:00.000Z",
      sourceArtifactHashes: { a: "1" },
      entities: [
        company("ent_c", "demo", "Demo"),
        {
          id: "ent_w",
          schemaVersion: KNOWLEDGE_SCHEMA_VERSION,
          type: "Website",
          name: "https://example.com",
          normalizedKey: "example-com",
          properties: {},
          epistemicClass: "fact",
          visibility: "project_private",
          sourceProjects: ["demo"],
          evidenceIds: ["ev1"],
          reviewStatus: "unreviewed",
          conflictIds: [],
          createdAt: "2026-01-01T00:00:00.000Z",
          updatedAt: "2026-01-01T00:00:00.000Z",
        },
      ],
      relationships: [
        {
          id: "rel_1",
          schemaVersion: KNOWLEDGE_SCHEMA_VERSION,
          type: "COMPANY_HAS_WEBSITE",
          fromId: "ent_c",
          toId: "ent_w",
          properties: {},
          epistemicClass: "fact",
          visibility: "project_private",
          sourceProjects: ["demo"],
          evidenceIds: ["ev1"],
          reviewStatus: "unreviewed",
          conflictIds: [],
          createdAt: "2026-01-01T00:00:00.000Z",
          updatedAt: "2026-01-01T00:00:00.000Z",
        },
      ],
      evidence: [
        {
          id: "ev1",
          schemaVersion: KNOWLEDGE_SCHEMA_VERSION,
          provenance: {
            sourceCompany: "Demo",
            sourceProject: "demo",
            sourceUrl: "https://example.com",
            captureDate: "2026-01-01T00:00:00.000Z",
            confidence: "high",
            extractionMethod: "inventory_map",
            reviewStatus: "unreviewed",
            epistemicClass: "fact",
            visibility: "project_private",
          },
          relatedEntityIds: ["ent_c", "ent_w"],
          relatedRelationshipIds: ["rel_1"],
          stale: false,
          createdAt: "2026-01-01T00:00:00.000Z",
          updatedAt: "2026-01-01T00:00:00.000Z",
        },
      ],
      conflicts: [],
    };
    mergeSliceIntoStore(store, slice);
    mergeSliceIntoStore(store, slice);
    expect(store.entities.size).toBe(2);
    expect(store.relationships.size).toBe(1);

    // simulate force replace: delete project-only, re-merge
    for (const [id, ent] of [...store.entities.entries()]) {
      if (ent.sourceProjects.length === 1 && ent.sourceProjects[0] === "demo") {
        store.entities.delete(id);
      }
    }
    for (const [id, rel] of [...store.relationships.entries()]) {
      if (rel.sourceProjects[0] === "demo") store.relationships.delete(id);
    }
    for (const [id, ev] of [...store.evidence.entries()]) {
      if (ev.provenance.sourceProject === "demo") store.evidence.delete(id);
    }
    mergeSliceIntoStore(store, slice);
    for (const rel of store.relationships.values()) {
      expect(store.entities.has(rel.fromId)).toBe(true);
      expect(store.entities.has(rel.toId)).toBe(true);
    }
    const index = buildIndex(store);
    expect(index.schemaVersion).toBe(KNOWLEDGE_SCHEMA_VERSION);
  });
});
