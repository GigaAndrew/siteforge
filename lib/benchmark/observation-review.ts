import fs from "node:fs";
import { createHash } from "node:crypto";
import { z } from "zod";
import { writeJson } from "@/lib/knowledge/paths";
import {
  ensureProjectBenchmarkDir,
  projectBenchmarkDir,
} from "@/lib/benchmark/paths";
import type { BenchmarkObservation } from "@/lib/benchmark/schemas";
import { BenchmarkObservationSchema } from "@/lib/benchmark/schemas";

export const ObservationReviewDecisionSchema = z.object({
  id: z.string(),
  projectSlug: z.string(),
  observationId: z.string(),
  decision: z.enum(["accepted", "rejected", "overridden", "unresolved"]),
  reviewer: z.string(),
  rationale: z.string(),
  originalState: z.string(),
  resultingState: z.string(),
  originalNormalized: z.number().nullable(),
  resultingNormalized: z.number().nullable(),
  evidenceIds: z.array(z.string()).default([]),
  benchmarkId: z.string(),
  benchmarkVersion: z.string(),
  artifactDigest: z.string(),
  timestamp: z.string(),
  valid: z.boolean().default(true),
  invalidatedReason: z.string().nullable().default(null),
  materialOverride: z.boolean().default(false),
});

export type ObservationReviewDecision = z.infer<
  typeof ObservationReviewDecisionSchema
>;

export function observationDigest(obs: BenchmarkObservation): string {
  return createHash("sha256")
    .update(
      JSON.stringify({
        id: obs.id,
        state: obs.observedState,
        normalized: obs.normalizedValue,
        confidence: obs.confidence,
        evidenceIds: obs.evidenceIds,
        concept: obs.canonicalConceptId,
        dimension: obs.dimensionId,
      }),
    )
    .digest("hex")
    .slice(0, 24);
}

function logPath(
  slug: string,
  benchmarkId: string,
  version: string,
): string {
  return `${projectBenchmarkDir(slug, benchmarkId, version)}/observation-review-log.json`;
}

export function loadObservationReviews(
  slug: string,
  benchmarkId: string,
  version: string,
): ObservationReviewDecision[] {
  const path = logPath(slug, benchmarkId, version);
  if (!fs.existsSync(path)) return [];
  const raw = JSON.parse(fs.readFileSync(path, "utf8")) as unknown[];
  return raw
    .map((r) => ObservationReviewDecisionSchema.safeParse(r))
    .filter((r) => r.success)
    .map((r) => r.data);
}

export function reviewObservation(opts: {
  slug: string;
  benchmarkId: string;
  benchmarkVersion: string;
  observationId: string;
  decision: ObservationReviewDecision["decision"];
  reviewer: string;
  rationale: string;
  resultingState?: BenchmarkObservation["observedState"];
  resultingNormalized?: number | null;
  materialOverride?: boolean;
}): {
  observation: BenchmarkObservation;
  review: ObservationReviewDecision;
} {
  const dir = ensureProjectBenchmarkDir(
    opts.slug,
    opts.benchmarkId,
    opts.benchmarkVersion,
  );
  const obsPath = `${dir}/observations.json`;
  if (!fs.existsSync(obsPath)) {
    throw new Error(`No observations for ${opts.slug}`);
  }
  const observations = (
    JSON.parse(fs.readFileSync(obsPath, "utf8")) as unknown[]
  )
    .map((o) => BenchmarkObservationSchema.safeParse(o))
    .filter((r) => r.success)
    .map((r) => r.data);

  const idx = observations.findIndex((o) => o.id === opts.observationId);
  if (idx === -1) throw new Error(`Observation not found: ${opts.observationId}`);
  const prev = observations[idx]!;
  const ts = new Date().toISOString();

  let next: BenchmarkObservation = { ...prev, notes: prev.notes };
  if (opts.decision === "overridden") {
    if (!opts.resultingState) {
      throw new Error("Override requires --state");
    }
    next = {
      ...prev,
      observedState: opts.resultingState,
      normalizedValue:
        opts.resultingNormalized !== undefined
          ? opts.resultingNormalized
          : prev.normalizedValue,
      notes: `${prev.notes}; OVERRIDE by ${opts.reviewer}: ${opts.rationale}`.trim(),
      evaluator: "benchmark.observation.review",
      generatedAt: ts,
    };
  } else if (opts.decision === "rejected") {
    next = {
      ...prev,
      observedState: "unknown",
      normalizedValue: null,
      notes: `${prev.notes}; REJECTED observation: ${opts.rationale}`.trim(),
      generatedAt: ts,
    };
  } else if (opts.decision === "accepted") {
    next = {
      ...prev,
      notes: `${prev.notes}; ACCEPTED by ${opts.reviewer}`.trim(),
      generatedAt: ts,
    };
  }

  observations[idx] = next;
  writeJson(obsPath, observations);

  const log = loadObservationReviews(
    opts.slug,
    opts.benchmarkId,
    opts.benchmarkVersion,
  );
  for (const e of log) {
    if (e.observationId === prev.id && e.valid) {
      e.valid = false;
      e.invalidatedReason = "Superseded by newer observation review";
    }
  }
  const review = ObservationReviewDecisionSchema.parse({
    id: `orev_${createHash("sha256")
      .update([opts.observationId, ts, opts.decision].join("|"))
      .digest("hex")
      .slice(0, 14)}`,
    projectSlug: opts.slug,
    observationId: prev.id,
    decision: opts.decision,
    reviewer: opts.reviewer,
    rationale: opts.rationale,
    originalState: prev.observedState,
    resultingState: next.observedState,
    originalNormalized: prev.normalizedValue,
    resultingNormalized: next.normalizedValue,
    evidenceIds: [...next.evidenceIds],
    benchmarkId: opts.benchmarkId,
    benchmarkVersion: opts.benchmarkVersion,
    artifactDigest: observationDigest(next),
    timestamp: ts,
    valid: true,
    invalidatedReason: null,
    materialOverride: Boolean(opts.materialOverride || opts.decision === "overridden"),
  });
  log.push(review);
  writeJson(logPath(opts.slug, opts.benchmarkId, opts.benchmarkVersion), log);
  return { observation: next, review };
}
