import { describe, expect, it, beforeEach } from "vitest";
import fs from "node:fs";
import path from "node:path";
import {
  confirmMapping,
  rejectMapping,
  unresolveMapping,
  normalizationReviewQueue,
} from "@/lib/normalization/engine";
import {
  appendMappingReview,
  loadMappingReviewLog,
  mappingDigest,
  invalidateMappingReviewsForDigestMismatch,
} from "@/lib/normalization/review-audit";
import type { AliasMapping } from "@/lib/normalization/schemas";
import { cohortLabel, listLiveProjectSlugs } from "@/lib/benchmark/cohort";
import { isSyntheticFixture } from "@/lib/benchmark/observe";
import { ensureProjectNormalizationDir } from "@/lib/normalization/paths";
import { writeJson } from "@/lib/knowledge/paths";

const SLUG = "review-fixture-co";

function sampleMapping(overrides: Partial<AliasMapping> = {}): AliasMapping {
  return {
    id: "nmap_test_review_1",
    schemaVersion: "1.0.0",
    sourceCompany: "Review Fixture Co",
    sourceProject: SLUG,
    sourceEntityId: "ent_test",
    originalLabel: "Engineering Resources",
    lexicalKey: "engineering-resources",
    canonicalConceptId: "canon_document-center",
    mappingConfidence: 0.82,
    mappingMethod: "alias",
    evidenceIds: ["ev1"],
    reviewStatus: "ambiguous",
    ambiguityNotes: "Ambiguous test mapping",
    version: "1.0.0",
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    belowThreshold: true,
    ...overrides,
  };
}

describe("normalization review workflow", () => {
  beforeEach(() => {
    ensureProjectNormalizationDir(SLUG);
    writeJson(
      path.join(
        process.cwd(),
        "projects",
        SLUG,
        "knowledge",
        "normalization",
        "mappings.json",
      ),
      [sampleMapping()],
    );
    writeJson(
      path.join(
        process.cwd(),
        "projects",
        SLUG,
        "knowledge",
        "normalization",
        "review-log.json",
      ),
      [],
    );
  });

  it("filters review queue by status", () => {
    const q = normalizationReviewQueue(SLUG, { status: "ambiguous" });
    expect(q.count).toBeGreaterThan(0);
    expect(q.items.every((m) => m.reviewStatus === "ambiguous")).toBe(true);
  });

  it("confirms mapping with audit digest", () => {
    const m = confirmMapping(
      SLUG,
      "nmap_test_review_1",
      "canon_document-center",
      "tester",
      "Alias match confirmed against resource hub page",
    );
    expect(m.reviewStatus).toBe("confirmed");
    expect(m.mappingMethod).toBe("manually_reviewed");
    const log = loadMappingReviewLog(SLUG);
    expect(log.some((e) => e.decision === "confirmed" && e.valid)).toBe(true);
    expect(log[0]?.artifactDigest).toBe(mappingDigest(m));
  });

  it("rejects and unresolves with audit history", () => {
    rejectMapping(SLUG, "nmap_test_review_1", "tester", "Wrong concept family");
    let log = loadMappingReviewLog(SLUG);
    expect(log.some((e) => e.decision === "rejected" && e.valid)).toBe(true);
    unresolveMapping(SLUG, "nmap_test_review_1", "tester", "Need more evidence");
    log = loadMappingReviewLog(SLUG);
    expect(log.filter((e) => e.valid).some((e) => e.decision === "unresolved")).toBe(
      true,
    );
    expect(log.filter((e) => e.decision === "rejected").every((e) => !e.valid)).toBe(
      true,
    );
  });

  it("invalidates review when digest mismatches", () => {
    const m = sampleMapping({ reviewStatus: "confirmed", belowThreshold: false });
    appendMappingReview(SLUG, {
      projectSlug: SLUG,
      mappingId: m.id,
      decision: "confirmed",
      reviewer: "tester",
      rationale: "ok",
      originalStatus: "ambiguous",
      resultingStatus: "confirmed",
      originalConceptId: m.canonicalConceptId,
      resultingConceptId: m.canonicalConceptId,
      evidenceIds: m.evidenceIds,
      artifactDigest: "stale-digest",
      mappingVersion: m.version,
      timestamp: new Date().toISOString(),
      valid: true,
      invalidatedReason: null,
    });
    const n = invalidateMappingReviewsForDigestMismatch(
      SLUG,
      m,
      "Evidence changed",
    );
    expect(n).toBe(1);
    expect(loadMappingReviewLog(SLUG)[0]?.valid).toBe(false);
  });
});

describe("live vs synthetic cohort", () => {
  it("labels synthetic fixtures distinctly", () => {
    // northline exists in repo as synthetic
    if (fs.existsSync(path.join(process.cwd(), "projects", "northline-framing"))) {
      expect(isSyntheticFixture("northline-framing")).toBe(true);
    }
    const mixed = cohortLabel(["eb-metal", "northline-framing"]);
    expect(mixed.mixed).toBe(true);
    expect(mixed.label.toLowerCase()).toContain("synthetic");
  });

  it("does not treat 'Not synthetic' notes as synthetic", () => {
    if (fs.existsSync(path.join(process.cwd(), "projects", "cemco", "config.json"))) {
      expect(isSyntheticFixture("cemco")).toBe(false);
    }
  });

  it("live cohort helper excludes synthetic when listing", () => {
    const live = listLiveProjectSlugs();
    expect(live.every((s) => !isSyntheticFixture(s))).toBe(true);
    expect(live).not.toContain("northline-framing");
  });
});
