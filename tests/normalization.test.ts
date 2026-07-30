import { describe, expect, it } from "vitest";
import { normalizeKey } from "@/lib/knowledge/ids";
import { seedCanonicalConcepts } from "@/lib/normalization/seed-concepts";
import {
  pickBestMapping,
  scoreEntityMappings,
} from "@/lib/normalization/match";
import { DEFAULT_MAPPING_THRESHOLD } from "@/lib/normalization/schemas";
import { KNOWLEDGE_SCHEMA_VERSION } from "@/lib/schemas/knowledge";
import type { KnowledgeEntity } from "@/lib/schemas/knowledge";

function ent(
  type: KnowledgeEntity["type"],
  name: string,
  extras: Partial<KnowledgeEntity> = {},
): KnowledgeEntity {
  return {
    id: `ent_${normalizeKey(name)}`,
    schemaVersion: KNOWLEDGE_SCHEMA_VERSION,
    type,
    name,
    normalizedKey: normalizeKey(name),
    properties: {},
    epistemicClass: "observation",
    visibility: "shared_unreviewed",
    sourceProjects: ["acme-steel"],
    evidenceIds: ["ev1"],
    reviewStatus: "unreviewed",
    conflictIds: [],
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    ...extras,
  };
}

describe("canonical concept registry seed", () => {
  it("includes core CFS concepts with aliases", () => {
    const concepts = seedCanonicalConcepts();
    const names = concepts.map((c) => c.canonical_name);
    expect(names).toContain("Document Center");
    expect(names).toContain("Engineering Calculator");
    expect(names).toContain("Submittal Workflow");
    const doc = concepts.find((c) => c.canonical_name === "Document Center")!;
    expect(doc.aliases).toContain("Engineering Resources");
    expect(doc.aliases).toContain("Literature");
  });
});

describe("normalization matching", () => {
  const concepts = seedCanonicalConcepts();

  it("maps Engineering Resources → Document Center via alias", () => {
    const candidates = scoreEntityMappings(
      ent("TechnicalResource", "Engineering Resources"),
      "acme-steel",
      concepts,
    );
    expect(candidates[0]?.canonicalName).toBe("Document Center");
    expect(["exact", "alias", "semantic"]).toContain(candidates[0]?.method);
    const pick = pickBestMapping(candidates, DEFAULT_MAPPING_THRESHOLD);
    expect(pick.best?.conceptId).toBe("canon_document-center");
    expect(pick.belowThreshold).toBe(false);
  });

  it("maps Wall Selector → Engineering Calculator via alias", () => {
    const candidates = scoreEntityMappings(
      ent("Calculator", "Wall Selector"),
      "acme-steel",
      concepts,
    );
    expect(candidates[0]?.canonicalName).toBe("Engineering Calculator");
    const pick = pickBestMapping(candidates, DEFAULT_MAPPING_THRESHOLD);
    expect(pick.best?.conceptId).toBe("canon_engineering-calculator");
  });

  it("maps Submittal Builder → Submittal Workflow", () => {
    const candidates = scoreEntityMappings(
      ent("SubmittalWorkflow", "Submittal Builder"),
      "peer-b",
      concepts,
    );
    expect(candidates[0]?.canonicalName).toBe("Submittal Workflow");
  });

  it("does not map Company entities", () => {
    const candidates = scoreEntityMappings(
      ent("Company", "Acme Steel"),
      "acme-steel",
      concepts,
    );
    expect(candidates).toHaveLength(0);
  });

  it("does not accept pure string similarity without registry backing", () => {
    const candidates = scoreEntityMappings(
      ent("UxIssue", "zzzxqy unrelated phrase 999"),
      "acme-steel",
      concepts,
    );
    const pick = pickBestMapping(candidates, DEFAULT_MAPPING_THRESHOLD);
    expect(pick.best === null || pick.belowThreshold || !candidates.length).toBe(
      true,
    );
  });

  it("flags ambiguity when two concepts score nearly equally", () => {
    // Force near-tie by inventing a label that hits two strong aliases poorly;
    // pickBestMapping unit: fabricate candidates
    const pick = pickBestMapping(
      [
        {
          conceptId: "a",
          canonicalName: "A",
          confidence: 0.8,
          method: "alias",
          notes: "",
        },
        {
          conceptId: "b",
          canonicalName: "B",
          confidence: 0.79,
          method: "alias",
          notes: "",
        },
      ],
      DEFAULT_MAPPING_THRESHOLD,
    );
    expect(pick.ambiguous).toBe(true);
    expect(pick.best).toBeNull();
  });
});
