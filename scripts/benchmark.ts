#!/usr/bin/env tsx
/**
 * Benchmark Engine CLI
 */
import {
  runBenchmark,
  benchmarkStatus,
  listBenchmarks,
  loadBenchmarkDefinition,
} from "@/lib/benchmark/engine";
import { writeBenchmarkReports } from "@/lib/benchmark/report";
import { recordApproval } from "@/lib/benchmark/approvals";
import { reviewObservation } from "@/lib/benchmark/observation-review";
import {
  listLiveProjectSlugs,
  cohortLabel,
} from "@/lib/benchmark/cohort";
import { assertValidProjectSlug } from "@/lib/project";
import { seedCfsCapabilityBenchmark } from "@/lib/benchmark/seed-definition";
import type { ObservedState } from "@/lib/benchmark/schemas";

function arg(flag: string): string | undefined {
  const idx = process.argv.indexOf(flag);
  if (idx === -1) return undefined;
  return process.argv[idx + 1];
}

function parseSlugs(): string[] {
  if (process.argv.includes("--live-cohort")) {
    const live = listLiveProjectSlugs();
    if (live.length < 1) throw new Error("No live projects found");
    return live;
  }
  const multi = arg("--slugs");
  if (multi) {
    return multi
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
  }
  const one = arg("--slug");
  if (!one) throw new Error("--slug or --slugs or --live-cohort required");
  return [one];
}

export async function runBenchmarkCommand(command: string): Promise<void> {
  switch (command) {
    case "benchmark-list": {
      console.log(JSON.stringify(listBenchmarks(), null, 2));
      break;
    }
    case "benchmark-inspect": {
      const id = arg("--benchmark") ?? "cfs-digital-capability";
      const def = loadBenchmarkDefinition(id, arg("--version"));
      console.log(JSON.stringify(def, null, 2));
      break;
    }
    case "benchmark-run":
    case "benchmark-rebuild": {
      const slugs = parseSlugs();
      for (const s of slugs) assertValidProjectSlug(s);
      const result = runBenchmark({
        slugs,
        benchmarkId: arg("--benchmark") ?? "cfs-digital-capability",
        benchmarkVersion: arg("--version"),
        dryRun: process.argv.includes("--dry-run"),
        rebuild:
          command === "benchmark-rebuild" ||
          process.argv.includes("--rebuild"),
      });
      if (!result.dryRun) {
        writeBenchmarkReports({
          slugs,
          peer: result.peer,
          benchmarkId: result.benchmarkId,
        });
      }
      console.log(
        JSON.stringify(
          {
            runId: result.runId,
            dryRun: result.dryRun,
            benchmarkId: result.benchmarkId,
            version: result.benchmarkVersion,
            statuses: result.statuses.map((s) => ({
              slug: s.projectSlug,
              synthetic: s.syntheticFixture,
              observations: s.observationCount,
              unknown: s.unknownCount,
              ambiguous: s.ambiguousCount,
              overallEligible: s.overallEligible,
              overall: s.overallRawScore,
              confidence: s.overallConfidence,
              coverage: s.evidenceCoverage,
              recommendations: s.recommendationCount,
            })),
            peer: result.peer
              ? {
                  label: result.peer.cohortLabel,
                  strongest: result.peer.strongestSupported,
                  weakest: result.peer.weakestSupported,
                  gaps: result.peer.gaps.length,
                }
              : null,
            approvalsRequired: result.approvalsRequired,
          },
          null,
          2,
        ),
      );
      break;
    }
    case "benchmark-status": {
      const slug = arg("--slug");
      if (!slug) throw new Error("--slug required");
      assertValidProjectSlug(slug);
      console.log(
        JSON.stringify(
          benchmarkStatus(slug, arg("--benchmark")),
          null,
          2,
        ),
      );
      break;
    }
    case "benchmark-report": {
      const slug = arg("--slug");
      if (!slug) throw new Error("--slug required");
      assertValidProjectSlug(slug);
      const { renderCompanyBenchmarkReport } = await import(
        "@/lib/benchmark/report"
      );
      process.stdout.write(
        renderCompanyBenchmarkReport(slug, arg("--benchmark")),
      );
      break;
    }
    case "benchmark-compare": {
      const slugs = parseSlugs();
      for (const s of slugs) assertValidProjectSlug(s);
      const result = runBenchmark({
        slugs,
        benchmarkId: arg("--benchmark") ?? "cfs-digital-capability",
        rebuild: process.argv.includes("--rebuild"),
      });
      writeBenchmarkReports({
        slugs,
        peer: result.peer,
        benchmarkId: result.benchmarkId,
      });
      console.log(
        JSON.stringify(
          {
            cohort: result.peer?.cohortLabel,
            projects: slugs,
            strongest: result.peer?.strongestSupported,
            weakest: result.peer?.weakestSupported,
            warnings: result.peer?.warnings,
            gapCount: result.peer?.gaps.length,
          },
          null,
          2,
        ),
      );
      break;
    }
    case "benchmark-approve": {
      const key = arg("--key") as
        | "benchmark.definition.review"
        | "benchmark.observation.review"
        | "benchmark.publish"
        | undefined;
      if (!key) throw new Error("--key required");
      const def = loadBenchmarkDefinition(
        arg("--benchmark") ?? "cfs-digital-capability",
        arg("--version"),
      );
      const entry = recordApproval({
        key,
        artifactId: def.id,
        artifactVersion: def.version,
        payload: def,
        reviewer: arg("--actor") ?? "human",
        decision: (arg("--decision") as "approved" | "rejected" | "needs_changes") ?? "approved",
        rationale: arg("--reason") ?? "Reviewed",
      });
      console.log(JSON.stringify(entry, null, 2));
      break;
    }
    case "benchmark-seed": {
      const def = seedCfsCapabilityBenchmark();
      const { saveBenchmarkDefinition } = await import(
        "@/lib/benchmark/definitions"
      );
      saveBenchmarkDefinition(def);
      console.log(JSON.stringify({ id: def.id, version: def.version }, null, 2));
      break;
    }
    case "benchmark-observation-review": {
      const slug = arg("--slug");
      const observationId = arg("--observation");
      const decision = arg("--decision") as
        | "accepted"
        | "rejected"
        | "overridden"
        | "unresolved"
        | undefined;
      if (!slug || !observationId || !decision) {
        throw new Error("--slug --observation --decision required");
      }
      assertValidProjectSlug(slug);
      const result = reviewObservation({
        slug,
        benchmarkId: arg("--benchmark") ?? "cfs-digital-capability",
        benchmarkVersion: arg("--version") ?? "1.0.0",
        observationId,
        decision,
        reviewer: arg("--actor") ?? "human",
        rationale: arg("--reason") ?? "Reviewed",
        resultingState: arg("--state") as ObservedState | undefined,
        resultingNormalized: arg("--normalized")
          ? Number(arg("--normalized"))
          : undefined,
        materialOverride: process.argv.includes("--material"),
      });
      console.log(JSON.stringify(result, null, 2));
      break;
    }
    case "benchmark-cohort": {
      const slugs = process.argv.includes("--live-cohort")
        ? listLiveProjectSlugs()
        : parseSlugs();
      console.log(JSON.stringify(cohortLabel(slugs), null, 2));
      break;
    }
    default:
      throw new Error(`Unknown benchmark command: ${command}`);
  }
}
