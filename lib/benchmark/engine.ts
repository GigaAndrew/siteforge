import fs from "node:fs";
import { createHash, randomUUID } from "node:crypto";
import { writeJson } from "@/lib/knowledge/paths";
import { loadProjectMappings } from "@/lib/normalization/engine";
import {
  ensureBenchmarkDefinitions,
  loadBenchmarkDefinition,
  listBenchmarkDefinitions,
} from "@/lib/benchmark/definitions";
import {
  companyName,
  generateObservations,
  isSyntheticFixture,
} from "@/lib/benchmark/observe";
import { scoreObservations } from "@/lib/benchmark/score";
import { compareBenchmarkPeers } from "@/lib/benchmark/compare";
import { generateRecommendations } from "@/lib/benchmark/recommend";
import {
  digestPayload,
  invalidateStaleApprovals,
  requiredApprovalsForPublish,
} from "@/lib/benchmark/approvals";
import {
  CompanyBenchmarkStatusSchema,
  type BenchmarkObservation,
  type CompanyBenchmarkStatus,
  type ScoreOutput,
} from "@/lib/benchmark/schemas";
import {
  benchmarkPath,
  ensureBenchmarkDirs,
  ensureProjectBenchmarkDir,
  projectBenchmarkDir,
} from "@/lib/benchmark/paths";
import type { PeerComparisonResult } from "@/lib/benchmark/compare";

export type BenchmarkRunOptions = {
  slugs: string[];
  benchmarkId?: string;
  benchmarkVersion?: string;
  dryRun?: boolean;
  rebuild?: boolean;
};

export type BenchmarkRunResult = {
  runId: string;
  dryRun: boolean;
  benchmarkId: string;
  benchmarkVersion: string;
  statuses: CompanyBenchmarkStatus[];
  peer: PeerComparisonResult | null;
  approvalsRequired: { key: string; satisfied: boolean }[];
  inputDigest: string;
};

function inputDigestFor(
  slug: string,
  benchmarkId: string,
  version: string,
): string {
  const mappings = loadProjectMappings(slug);
  return digestPayload({
    slug,
    benchmarkId,
    version,
    mappingCount: mappings.length,
    mappingIds: mappings.map((m) => m.id).sort(),
  });
}

function countStates(obs: BenchmarkObservation[]) {
  const c = {
    present: 0,
    absent: 0,
    partial: 0,
    unknown: 0,
    ambiguous: 0,
  };
  for (const o of obs) {
    if (o.observedState in c) c[o.observedState as keyof typeof c]++;
  }
  return c;
}

export function runBenchmark(opts: BenchmarkRunOptions): BenchmarkRunResult {
  ensureBenchmarkDirs();
  ensureBenchmarkDefinitions();
  const def = loadBenchmarkDefinition(
    opts.benchmarkId ?? "cfs-digital-capability",
    opts.benchmarkVersion,
  );
  const dryRun = Boolean(opts.dryRun);
  const rebuild = Boolean(opts.rebuild);
  const runId = randomUUID();
  const slugs = opts.slugs;

  // Invalidate approvals if definition payload/version changed
  invalidateStaleApprovals(
    def.id,
    def.version,
    def,
    "Benchmark definition changed or digest mismatch",
  );

  const statuses: CompanyBenchmarkStatus[] = [];
  const conceptScoresBySlug: Record<string, ScoreOutput[]> = {};
  const dimensionScoresBySlug: Record<string, ScoreOutput[]> = {};
  const companyScores: ScoreOutput[] = [];
  const digests: string[] = [];

  for (const slug of slugs) {
    const digest = inputDigestFor(slug, def.id, def.version);
    digests.push(digest);
    const dir = projectBenchmarkDir(slug, def.id, def.version);

    if (!rebuild && !dryRun && fs.existsSync(`${dir}/run-manifest.json`)) {
      const prior = JSON.parse(
        fs.readFileSync(`${dir}/run-manifest.json`, "utf8"),
      ) as { inputDigest?: string };
      if (prior.inputDigest === digest && fs.existsSync(`${dir}/status.json`)) {
        const status = CompanyBenchmarkStatusSchema.parse(
          JSON.parse(fs.readFileSync(`${dir}/status.json`, "utf8")),
        );
        statuses.push(status);
        conceptScoresBySlug[slug] = JSON.parse(
          fs.readFileSync(`${dir}/concept-scores.json`, "utf8"),
        ) as ScoreOutput[];
        dimensionScoresBySlug[slug] = JSON.parse(
          fs.readFileSync(`${dir}/dimension-scores.json`, "utf8"),
        ) as ScoreOutput[];
        companyScores.push(
          JSON.parse(
            fs.readFileSync(`${dir}/company-score.json`, "utf8"),
          ) as ScoreOutput,
        );
        continue;
      }
      // digest mismatch → stale outputs invalid
      if (prior.inputDigest && prior.inputDigest !== digest) {
        invalidateStaleApprovals(
          `${def.id}:${slug}`,
          def.version,
          { digest },
          "Upstream mappings or benchmark inputs changed",
        );
      }
    }

    const observations = generateObservations(slug, def);
    const scored = scoreObservations(slug, def, observations);
    const peerPlaceholder = null;
    const recommendations = generateRecommendations(
      slug,
      companyName(slug),
      def,
      observations,
      scored.conceptScores,
      peerPlaceholder,
    );

    const states = countStates(observations);
    const conflictCount = new Set(
      observations.flatMap((o) => o.conflictIds),
    ).size;

    const status = CompanyBenchmarkStatusSchema.parse({
      schemaVersion: "1.0.0",
      projectSlug: slug,
      companyName: companyName(slug),
      benchmarkId: def.id,
      benchmarkVersion: def.version,
      generatedAt: new Date().toISOString(),
      dryRun,
      syntheticFixture: isSyntheticFixture(slug),
      observationCount: observations.length,
      presentCount: states.present,
      absentCount: states.absent,
      partialCount: states.partial,
      unknownCount: states.unknown,
      ambiguousCount: states.ambiguous,
      conflictCount,
      conceptScoreCount: scored.conceptScores.length,
      dimensionScoreCount: scored.dimensionScores.length,
      overallEligible: scored.companyScore.eligible,
      overallRawScore: scored.companyScore.rawScore,
      overallWeightedScore: scored.companyScore.weightedScore,
      overallConfidence: scored.companyScore.confidence,
      evidenceCoverage: scored.companyScore.evidenceCoverage,
      recommendationCount: recommendations.length,
      caveats: [
        ...scored.companyScore.caveats,
        ...(isSyntheticFixture(slug)
          ? [
              "SYNTHETIC FIXTURE: results are for validation only — not live market evidence",
            ]
          : []),
      ],
      runId,
      inputDigest: digest,
    });

    conceptScoresBySlug[slug] = scored.conceptScores;
    dimensionScoresBySlug[slug] = scored.dimensionScores;
    companyScores.push(scored.companyScore);
    statuses.push(status);

    if (!dryRun) {
      const outDir = ensureProjectBenchmarkDir(slug, def.id, def.version);
      writeJson(`${outDir}/observations.json`, observations);
      writeJson(`${outDir}/concept-scores.json`, scored.conceptScores);
      writeJson(`${outDir}/dimension-scores.json`, scored.dimensionScores);
      writeJson(`${outDir}/company-score.json`, scored.companyScore);
      writeJson(`${outDir}/recommendations.json`, recommendations);
      writeJson(`${outDir}/status.json`, status);
      writeJson(`${outDir}/run-manifest.json`, {
        runId,
        benchmarkId: def.id,
        benchmarkVersion: def.version,
        inputDigest: digest,
        generatedAt: status.generatedAt,
        definitionDigest: digestPayload(def),
      });
    }
  }

  // Peer comparison when ≥2 scored
  let peer: PeerComparisonResult | null = null;
  if (companyScores.length >= 2) {
    peer = compareBenchmarkPeers(
      def,
      companyScores,
      dimensionScoresBySlug,
      conceptScoresBySlug,
    );
    // Refresh recommendations with peer context
    if (!dryRun) {
      for (const slug of slugs) {
        const dir = projectBenchmarkDir(slug, def.id, def.version);
        const observations = JSON.parse(
          fs.readFileSync(`${dir}/observations.json`, "utf8"),
        ) as BenchmarkObservation[];
        const conceptScores = conceptScoresBySlug[slug] ?? [];
        const recommendations = generateRecommendations(
          slug,
          companyName(slug),
          def,
          observations,
          conceptScores,
          peer,
        );
        writeJson(`${dir}/recommendations.json`, recommendations);
        const statusPath = `${dir}/status.json`;
        if (fs.existsSync(statusPath)) {
          const st = CompanyBenchmarkStatusSchema.parse(
            JSON.parse(fs.readFileSync(statusPath, "utf8")),
          );
          st.recommendationCount = recommendations.length;
          writeJson(statusPath, st);
          const idx = statuses.findIndex((s) => s.projectSlug === slug);
          if (idx >= 0) statuses[idx] = st;
        }
      }
      writeJson(benchmarkPath("indexes", `peer-${def.id}-${def.version}.json`), peer);
    }
  }

  const runDigest = createHash("sha256")
    .update(digests.sort().join("|"))
    .digest("hex")
    .slice(0, 24);

  if (!dryRun) {
    writeJson(benchmarkPath("runs", `${runId}.json`), {
      runId,
      benchmarkId: def.id,
      benchmarkVersion: def.version,
      slugs,
      statuses,
      peer,
      inputDigest: runDigest,
      generatedAt: new Date().toISOString(),
    });
  }

  return {
    runId,
    dryRun,
    benchmarkId: def.id,
    benchmarkVersion: def.version,
    statuses,
    peer,
    approvalsRequired: requiredApprovalsForPublish(def.id, def.version),
    inputDigest: runDigest,
  };
}

export function benchmarkStatus(slug: string, benchmarkId?: string) {
  ensureBenchmarkDefinitions();
  const def = loadBenchmarkDefinition(benchmarkId ?? "cfs-digital-capability");
  const path = `${projectBenchmarkDir(slug, def.id, def.version)}/status.json`;
  if (!fs.existsSync(path)) {
    return { slug, exists: false, benchmarkId: def.id, version: def.version };
  }
  return {
    slug,
    exists: true,
    status: CompanyBenchmarkStatusSchema.parse(
      JSON.parse(fs.readFileSync(path, "utf8")),
    ),
  };
}

export function listBenchmarks() {
  return ensureBenchmarkDefinitions().map((d) => ({
    id: d.id,
    name: d.name,
    version: d.version,
    status: d.status,
    industry: d.industry,
    dimensions: d.dimensions.length,
    concepts: d.canonical_concepts.length,
  }));
}

export { listBenchmarkDefinitions, loadBenchmarkDefinition };
