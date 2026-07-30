#!/usr/bin/env tsx
/**
 * Cross-company normalization CLI
 *
 * npm run siteforge -- normalize --slug <project> [--dry-run] [--rebuild]
 * npm run siteforge -- normalization-status --slug <project>
 * npm run siteforge -- normalization-review --slug <project>
 * npm run siteforge -- compare --slugs a,b
 * npm run siteforge -- seed-peer
 */
import {
  normalizeProject,
  normalizationReviewQueue,
  normalizationStatus,
  confirmMapping,
  rejectMapping,
  unresolveMapping,
} from "@/lib/normalization/engine";
import { loadMappingReviewLog } from "@/lib/normalization/review-audit";
import { compareProjects } from "@/lib/normalization/compare";
import { refreshCanonicalCandidatePatterns } from "@/lib/normalization/patterns";
import { ensureConceptRegistry } from "@/lib/normalization/registry";
import { seedPeerManufacturer } from "@/lib/normalization/seed-peer";
import { buildIndex } from "@/lib/knowledge/merge";
import { loadStore, persistStore } from "@/lib/knowledge/store";
import { assertValidProjectSlug } from "@/lib/project";

function arg(flag: string): string | undefined {
  const idx = process.argv.indexOf(flag);
  if (idx === -1) return undefined;
  return process.argv[idx + 1];
}

export async function runNormalizationCommand(command: string): Promise<void> {
  ensureConceptRegistry();

  switch (command) {
    case "normalize": {
      const slug = arg("--slug");
      if (!slug) throw new Error("--slug required");
      assertValidProjectSlug(slug);
      const result = normalizeProject({
        slug,
        dryRun: process.argv.includes("--dry-run"),
        rebuild: process.argv.includes("--rebuild"),
      });
      if (!result.dryRun) {
        const store = loadStore();
        const stats = refreshCanonicalCandidatePatterns(store);
        persistStore(store, buildIndex(store));
        console.log(
          JSON.stringify(
            { ...result.status, patternStats: stats, reviewQueue: result.reviewQueue.length },
            null,
            2,
          ),
        );
      } else {
        console.log(
          JSON.stringify(
            {
              ...result.status,
              reviewQueue: result.reviewQueue.length,
              sampleMappings: result.mappings.slice(0, 12).map((m) => ({
                label: m.originalLabel,
                concept: m.canonicalConceptId,
                confidence: m.mappingConfidence,
                method: m.mappingMethod,
                belowThreshold: m.belowThreshold,
                notes: m.ambiguityNotes,
              })),
            },
            null,
            2,
          ),
        );
      }
      break;
    }
    case "normalization-status": {
      const slug = arg("--slug");
      if (!slug) throw new Error("--slug required");
      assertValidProjectSlug(slug);
      console.log(JSON.stringify(normalizationStatus(slug), null, 2));
      break;
    }
    case "normalization-review": {
      const slug = arg("--slug");
      if (!slug) throw new Error("--slug required");
      assertValidProjectSlug(slug);
      const statusArg = arg("--status") as
        | "queue"
        | "ambiguous"
        | "unreviewed"
        | "confirmed"
        | "rejected"
        | "below_threshold"
        | "all"
        | undefined;
      const queue = normalizationReviewQueue(slug, {
        status: statusArg ?? "queue",
        method: arg("--method") as
          | "exact"
          | "alias"
          | "semantic"
          | "structural"
          | "manually_reviewed"
          | undefined,
        minConfidence: arg("--min-confidence")
          ? Number(arg("--min-confidence"))
          : undefined,
        maxConfidence: arg("--max-confidence")
          ? Number(arg("--max-confidence"))
          : undefined,
      });
      const limit = arg("--limit") ? Number(arg("--limit")) : 40;
      console.log(
        JSON.stringify(
          {
            slug: queue.slug,
            count: queue.count,
            filter: statusArg ?? "queue",
            items: queue.items.slice(0, limit).map((m) => ({
              id: m.id,
              label: m.originalLabel,
              concept: m.canonicalConceptId,
              confidence: m.mappingConfidence,
              method: m.mappingMethod,
              status: m.reviewStatus,
              belowThreshold: m.belowThreshold,
              evidenceIds: m.evidenceIds,
              notes: m.ambiguityNotes,
            })),
            auditCount: loadMappingReviewLog(slug).length,
          },
          null,
          2,
        ),
      );
      break;
    }
    case "normalization-confirm": {
      const slug = arg("--slug");
      const mappingId = arg("--mapping");
      const conceptId = arg("--concept");
      if (!slug || !mappingId || !conceptId) {
        throw new Error("--slug --mapping --concept required");
      }
      assertValidProjectSlug(slug);
      const m = confirmMapping(
        slug,
        mappingId,
        conceptId,
        arg("--actor") ?? "human",
        arg("--reason") ?? "",
      );
      console.log(JSON.stringify(m, null, 2));
      break;
    }
    case "normalization-reject": {
      const slug = arg("--slug");
      const mappingId = arg("--mapping");
      if (!slug || !mappingId) throw new Error("--slug --mapping required");
      assertValidProjectSlug(slug);
      const m = rejectMapping(
        slug,
        mappingId,
        arg("--actor") ?? "human",
        arg("--reason") ?? "Rejected by reviewer",
      );
      console.log(JSON.stringify(m, null, 2));
      break;
    }
    case "normalization-unresolve": {
      const slug = arg("--slug");
      const mappingId = arg("--mapping");
      if (!slug || !mappingId) throw new Error("--slug --mapping required");
      assertValidProjectSlug(slug);
      const m = unresolveMapping(
        slug,
        mappingId,
        arg("--actor") ?? "human",
        arg("--reason") ?? "Left unresolved pending better evidence",
      );
      console.log(JSON.stringify(m, null, 2));
      break;
    }
    case "compare": {
      const slugsRaw = arg("--slugs") ?? arg("--slug");
      if (!slugsRaw) throw new Error("--slugs a,b required");
      const slugs = slugsRaw.split(",").map((s) => s.trim()).filter(Boolean);
      for (const s of slugs) assertValidProjectSlug(s);
      const report = compareProjects(slugs);
      console.log(
        JSON.stringify(
          {
            generatedAt: report.generatedAt,
            projects: report.projects,
            sharedCount: report.sharedConcepts.length,
            candidatePatternReady: report.candidatePatternReady.length,
            unmappedCounts: report.unmappedCounts,
            shared: report.sharedConcepts.map((c) => ({
              concept: c.canonicalName,
              companies: c.companies.map((x) => ({
                project: x.projectSlug,
                label: x.originalLabel,
                method: x.mapping.mappingMethod,
                confidence: x.mapping.mappingConfidence,
              })),
            })),
          },
          null,
          2,
        ),
      );
      break;
    }
    case "seed-peer": {
      const result = seedPeerManufacturer({ alsoNormalizeEbMetal: true });
      console.log(JSON.stringify(result, null, 2));
      break;
    }
    default:
      throw new Error(`Unknown normalization command: ${command}`);
  }
}

// Direct invocation
if (import.meta.url === `file://${process.argv[1]}` || process.argv[1]?.endsWith("normalize-knowledge.ts")) {
  const cmd = process.argv[2];
  if (!cmd) {
    console.error("Usage: normalize|normalization-status|normalization-review|compare|seed-peer");
    process.exit(1);
  }
  runNormalizationCommand(cmd).catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
