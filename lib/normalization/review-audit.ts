import fs from "node:fs";
import { createHash } from "node:crypto";
import { z } from "zod";
import { writeJson } from "@/lib/knowledge/paths";
import {
  normalizationPath,
  projectNormalizationDir,
  ensureProjectNormalizationDir,
  ensureNormalizationDirs,
} from "@/lib/normalization/paths";
import type { AliasMapping } from "@/lib/normalization/schemas";

export const MappingReviewDecisionSchema = z.object({
  id: z.string(),
  projectSlug: z.string(),
  mappingId: z.string(),
  decision: z.enum(["confirmed", "rejected", "unresolved"]),
  reviewer: z.string(),
  rationale: z.string(),
  originalStatus: z.string(),
  resultingStatus: z.string(),
  originalConceptId: z.string().nullable(),
  resultingConceptId: z.string().nullable(),
  evidenceIds: z.array(z.string()).default([]),
  artifactDigest: z.string(),
  mappingVersion: z.string(),
  timestamp: z.string(),
  valid: z.boolean().default(true),
  invalidatedReason: z.string().nullable().default(null),
});

export type MappingReviewDecision = z.infer<typeof MappingReviewDecisionSchema>;

export function mappingDigest(mapping: AliasMapping): string {
  return createHash("sha256")
    .update(
      JSON.stringify({
        id: mapping.id,
        concept: mapping.canonicalConceptId,
        label: mapping.originalLabel,
        confidence: mapping.mappingConfidence,
        method: mapping.mappingMethod,
        status: mapping.reviewStatus,
        evidenceIds: mapping.evidenceIds,
        version: mapping.version,
      }),
    )
    .digest("hex")
    .slice(0, 24);
}

function auditPath(slug: string): string {
  return `${projectNormalizationDir(slug)}/review-log.json`;
}

export function loadMappingReviewLog(slug: string): MappingReviewDecision[] {
  const path = auditPath(slug);
  if (!fs.existsSync(path)) return [];
  const raw = JSON.parse(fs.readFileSync(path, "utf8")) as unknown[];
  return raw
    .map((r) => MappingReviewDecisionSchema.safeParse(r))
    .filter((r) => r.success)
    .map((r) => r.data);
}

export function appendMappingReview(
  slug: string,
  entry: Omit<MappingReviewDecision, "id">,
): MappingReviewDecision {
  ensureProjectNormalizationDir(slug);
  ensureNormalizationDirs();
  const full = MappingReviewDecisionSchema.parse({
    ...entry,
    id: `nrev_${createHash("sha256")
      .update([slug, entry.mappingId, entry.timestamp, entry.decision].join("|"))
      .digest("hex")
      .slice(0, 14)}`,
  });
  const log = loadMappingReviewLog(slug);
  // invalidate prior valid decisions for same mapping when decision changes
  for (const prev of log) {
    if (prev.mappingId === full.mappingId && prev.valid) {
      prev.valid = false;
      prev.invalidatedReason = "Superseded by newer review decision";
    }
  }
  log.push(full);
  writeJson(auditPath(slug), log);
  writeJson(normalizationPath("reviews", `${slug}-log.json`), log);
  return full;
}

export function invalidateMappingReviewsForDigestMismatch(
  slug: string,
  mapping: AliasMapping,
  reason: string,
): number {
  const digest = mappingDigest(mapping);
  const log = loadMappingReviewLog(slug);
  let n = 0;
  for (const e of log) {
    if (!e.valid || e.mappingId !== mapping.id) continue;
    if (e.artifactDigest !== digest) {
      e.valid = false;
      e.invalidatedReason = reason;
      n++;
    }
  }
  if (n) {
    writeJson(auditPath(slug), log);
    writeJson(normalizationPath("reviews", `${slug}-log.json`), log);
  }
  return n;
}
