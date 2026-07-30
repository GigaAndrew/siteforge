import { describe, expect, it } from "vitest";
import { seedCfsCapabilityBenchmark } from "@/lib/benchmark/seed-definition";
import { BenchmarkDefinitionSchema } from "@/lib/benchmark/schemas";
import { scoreObservations } from "@/lib/benchmark/score";
import { compareBenchmarkPeers } from "@/lib/benchmark/compare";
import { generateRecommendations } from "@/lib/benchmark/recommend";
import {
  digestPayload,
  invalidateStaleApprovals,
  loadApprovals,
  recordApproval,
  saveApprovals,
} from "@/lib/benchmark/approvals";
import type { BenchmarkObservation } from "@/lib/benchmark/schemas";
import { ensureBenchmarkDirs } from "@/lib/benchmark/paths";
import fs from "node:fs";
import path from "node:path";

function obs(
  partial: Partial<BenchmarkObservation> &
    Pick<
      BenchmarkObservation,
      "canonicalConceptId" | "dimensionId" | "observedState"
    >,
): BenchmarkObservation {
  return {
    id: `t_${partial.canonicalConceptId}_${partial.dimensionId}`,
    schemaVersion: "1.0.0",
    projectSlug: partial.projectSlug ?? "co-a",
    companyName: "Co A",
    benchmarkId: "cfs-digital-capability",
    benchmarkVersion: "1.0.0",
    sourceEntityId: null,
    rawValue: partial.rawValue ?? null,
    normalizedValue: partial.normalizedValue ?? null,
    confidence: partial.confidence ?? 0.8,
    evidenceIds: partial.evidenceIds ?? [],
    provenance: {},
    conflictIds: partial.conflictIds ?? [],
    ambiguity: partial.ambiguity ?? "",
    evaluator: "test",
    method: "test",
    generatedAt: "2026-01-01T00:00:00.000Z",
    notes: partial.notes ?? "",
    ...partial,
  };
}

describe("benchmark definition", () => {
  it("validates seeded CFS definition", () => {
    const def = seedCfsCapabilityBenchmark();
    const parsed = BenchmarkDefinitionSchema.parse(def);
    expect(parsed.id).toBe("cfs-digital-capability");
    expect(parsed.version).toBe("1.0.0");
    expect(parsed.missing_data_policy.fabricateScores).toBe(false);
    expect(parsed.evidence_requirements.excludeCandidatePatterns).toBe(true);
    const weightSum = parsed.dimensions.reduce((s, d) => s + d.weight, 0);
    expect(weightSum).toBeCloseTo(1.0, 5);
  });

  it("is versioned and not presented as universal standard", () => {
    const def = seedCfsCapabilityBenchmark();
    expect(def.description.toLowerCase()).toContain("not a universal");
    expect(def.version).toMatch(/^\d+\.\d+\.\d+$/);
  });
});

describe("present vs absent vs unknown", () => {
  it("does not convert unknown into absent performance", () => {
    const def = seedCfsCapabilityBenchmark();
    const observations = def.canonical_concepts.flatMap((c) =>
      def.dimensions
        .filter((d) => d.applicableConcepts.includes(c))
        .map((d) =>
          obs({
            canonicalConceptId: c,
            dimensionId: d.id,
            observedState: "unknown",
            normalizedValue: null,
            confidence: 0.35,
          }),
        ),
    );
    const scored = scoreObservations("co-a", def, observations);
    expect(
      scored.conceptScores.every(
        (c) => c.rawScore == null || c.exclusions.length > 0,
      ),
    ).toBe(true);
    expect(scored.companyScore.eligible).toBe(false);
  });

  it("scores present observations", () => {
    const def = seedCfsCapabilityBenchmark();
    const observations: BenchmarkObservation[] = [];
    for (const c of def.canonical_concepts) {
      for (const d of def.dimensions) {
        if (!d.applicableConcepts.includes(c)) continue;
        observations.push(
          obs({
            canonicalConceptId: c,
            dimensionId: d.id,
            observedState: "present",
            normalizedValue: 1,
            confidence: 0.9,
            evidenceIds: ["ev1"],
          }),
        );
      }
    }
    const scored = scoreObservations("co-a", def, observations);
    expect(scored.conceptScores.some((c) => c.rawScore === 100)).toBe(true);
    expect(scored.companyScore.confidence).toBeGreaterThan(0.5);
  });
});

describe("confidence separation", () => {
  it("keeps performance and confidence distinct", () => {
    const def = seedCfsCapabilityBenchmark();
    const observations = def.dimensions.flatMap((d) =>
      d.applicableConcepts.slice(0, 2).map((c) =>
        obs({
          canonicalConceptId: c,
          dimensionId: d.id,
          observedState: "present",
          normalizedValue: 1,
          confidence: 0.4,
          evidenceIds: ["ev"],
        }),
      ),
    );
    const scored = scoreObservations("co-a", def, observations);
    const dim = scored.dimensionScores.find((d) => d.eligible);
    expect(dim).toBeTruthy();
    expect(dim!.rawScore).toBeGreaterThan(50);
    expect(dim!.confidence).toBeLessThan(0.6);
  });
});

describe("eligibility and overall suppression", () => {
  it("suppresses overall when coverage too low", () => {
    const def = seedCfsCapabilityBenchmark();
    const observations = [
      obs({
        canonicalConceptId: "canon_document-center",
        dimensionId: "capability_presence",
        observedState: "present",
        normalizedValue: 1,
        confidence: 0.9,
        evidenceIds: ["ev"],
      }),
    ];
    // fill rest unknown
    for (const c of def.canonical_concepts) {
      for (const d of def.dimensions) {
        if (!d.applicableConcepts.includes(c)) continue;
        if (
          c === "canon_document-center" &&
          d.id === "capability_presence"
        ) {
          continue;
        }
        observations.push(
          obs({
            canonicalConceptId: c,
            dimensionId: d.id,
            observedState: "unknown",
            normalizedValue: null,
            confidence: 0.3,
          }),
        );
      }
    }
    const scored = scoreObservations("sparse", def, observations);
    expect(scored.companyScore.eligible).toBe(false);
    expect(scored.companyScore.rawScore).toBeNull();
    expect(
      scored.companyScore.caveats.some((c) =>
        c.toLowerCase().includes("false precision"),
      ),
    ).toBe(true);
  });
});

describe("peer comparison", () => {
  it("labels two-company results as limited cohort", () => {
    const def = seedCfsCapabilityBenchmark();
    const mkConcept = (slug: string, score: number) =>
      def.canonical_concepts.map((id) => ({
        level: "canonical_concept" as const,
        id: `${slug}:${id}`,
        label: id,
        projectSlug: slug,
        canonicalConceptId: id,
        rawScore: score,
        weightedScore: score,
        confidence: 0.8,
        evidenceCoverage: 1,
        completeness: 1,
        uncertainty: 0.2,
        exclusions: [],
        caveats: [],
        benchmarkId: def.id,
        benchmarkVersion: def.version,
        eligible: true,
        calculationTrace: [],
      }));
    const peer = compareBenchmarkPeers(
      def,
      [
        {
          level: "company",
          id: "a",
          label: "a",
          projectSlug: "a",
          rawScore: 50,
          weightedScore: 50,
          confidence: 0.7,
          evidenceCoverage: 0.5,
          completeness: 0.5,
          uncertainty: 0.3,
          exclusions: [],
          caveats: [],
          benchmarkId: def.id,
          benchmarkVersion: def.version,
          eligible: true,
          calculationTrace: [],
        },
        {
          level: "company",
          id: "b",
          label: "b",
          projectSlug: "b",
          rawScore: 55,
          weightedScore: 55,
          confidence: 0.7,
          evidenceCoverage: 0.5,
          completeness: 0.5,
          uncertainty: 0.3,
          exclusions: [],
          caveats: [],
          benchmarkId: def.id,
          benchmarkVersion: def.version,
          eligible: true,
          calculationTrace: [],
        },
      ],
      { a: [], b: [] },
      { a: mkConcept("a", 80), b: mkConcept("b", 40) },
    );
    expect(peer.limitedCohort).toBe(true);
    expect(peer.cohortLabel.toLowerCase()).toContain("limited");
  });

  it("marks near-ties inconclusive", () => {
    const def = seedCfsCapabilityBenchmark();
    const peer = compareBenchmarkPeers(
      def,
      [
        {
          level: "company",
          id: "a",
          label: "a",
          projectSlug: "a",
          rawScore: 50,
          weightedScore: 50,
          confidence: 0.8,
          evidenceCoverage: 0.5,
          completeness: 0.5,
          uncertainty: 0.2,
          exclusions: [],
          caveats: [],
          benchmarkId: def.id,
          benchmarkVersion: def.version,
          eligible: true,
          calculationTrace: [],
        },
        {
          level: "company",
          id: "b",
          label: "b",
          projectSlug: "b",
          rawScore: 51,
          weightedScore: 51,
          confidence: 0.8,
          evidenceCoverage: 0.5,
          completeness: 0.5,
          uncertainty: 0.2,
          exclusions: [],
          caveats: [],
          benchmarkId: def.id,
          benchmarkVersion: def.version,
          eligible: true,
          calculationTrace: [],
        },
      ],
      { a: [], b: [] },
      {
        a: [
          {
            level: "canonical_concept",
            id: "a:c",
            label: "c",
            projectSlug: "a",
            canonicalConceptId: "canon_document-center",
            rawScore: 50,
            weightedScore: 50,
            confidence: 0.8,
            evidenceCoverage: 1,
            completeness: 1,
            uncertainty: 0.2,
            exclusions: [],
            caveats: [],
            benchmarkId: def.id,
            benchmarkVersion: def.version,
            eligible: true,
            calculationTrace: [],
          },
        ],
        b: [
          {
            level: "canonical_concept",
            id: "b:c",
            label: "c",
            projectSlug: "b",
            canonicalConceptId: "canon_document-center",
            rawScore: 52,
            weightedScore: 52,
            confidence: 0.8,
            evidenceCoverage: 1,
            completeness: 1,
            uncertainty: 0.2,
            exclusions: [],
            caveats: [],
            benchmarkId: def.id,
            benchmarkVersion: def.version,
            eligible: true,
            calculationTrace: [],
          },
        ],
      },
    );
    const gap = peer.gaps.find((g) => g.conceptId === "canon_document-center");
    expect(gap?.inconclusive).toBe(true);
  });
});

describe("recommendations", () => {
  it("creates evidence_gap for unknown and does not peer-copy alone", () => {
    const def = seedCfsCapabilityBenchmark();
    const observations = [
      obs({
        canonicalConceptId: "canon_submittal-workflow",
        dimensionId: "capability_presence",
        observedState: "unknown",
        confidence: 0.35,
      }),
    ];
    const conceptScores = [
      {
        level: "canonical_concept" as const,
        id: "x",
        label: "Submittal Workflow",
        projectSlug: "co-a",
        canonicalConceptId: "canon_submittal-workflow",
        rawScore: null,
        weightedScore: null,
        confidence: 0.35,
        evidenceCoverage: 0,
        completeness: 0,
        uncertainty: 0.65,
        exclusions: ["unknown_not_scored_as_absent"],
        caveats: [],
        benchmarkId: def.id,
        benchmarkVersion: def.version,
        eligible: false,
        calculationTrace: [],
      },
    ];
    const recs = generateRecommendations(
      "co-a",
      "Co A",
      def,
      observations,
      conceptScores,
      null,
    );
    expect(recs.some((r) => r.kind === "evidence_gap")).toBe(true);
    expect(
      recs.every((r) =>
        r.limitations.some((l) => l.toLowerCase().includes("peer")),
      ),
    ).toBe(true);
  });
});

describe("approval invalidation", () => {
  it("invalidates approvals when digest changes", () => {
    ensureBenchmarkDirs();
    const approvalsPath = path.join(
      process.cwd(),
      "knowledge",
      "benchmarks",
      "approvals",
      "log.json",
    );
    // isolate
    saveApprovals([]);
    const payload = { v: 1 };
    recordApproval({
      key: "benchmark.definition.review",
      artifactId: "cfs-digital-capability",
      artifactVersion: "1.0.0",
      payload,
      reviewer: "tester",
      decision: "approved",
      rationale: "ok",
    });
    expect(digestPayload(payload)).toBeTruthy();
    const n = invalidateStaleApprovals(
      "cfs-digital-capability",
      "1.0.0",
      { v: 2 },
      "definition changed",
    );
    expect(n).toBe(1);
    expect(loadApprovals()[0]?.valid).toBe(false);
    // cleanup test pollution
    if (fs.existsSync(approvalsPath)) saveApprovals([]);
  });
});

describe("candidate pattern exclusion", () => {
  it("definition excludes candidate patterns from criteria", () => {
    expect(
      seedCfsCapabilityBenchmark().evidence_requirements.excludeCandidatePatterns,
    ).toBe(true);
  });
});
