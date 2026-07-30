import { z } from "zod";

export const BENCHMARK_SCHEMA_VERSION = "1.0.0" as const;

export const BenchmarkStatusSchema = z.enum([
  "draft",
  "candidate",
  "reviewed",
  "accepted",
  "deprecated",
]);

export const ObservedStateSchema = z.enum([
  "present",
  "absent",
  "partial",
  "unknown",
  "ambiguous",
  "not_applicable",
]);

export const RecommendationKindSchema = z.enum([
  "confirmed_gap",
  "likely_gap",
  "evidence_gap",
  "optimization_opportunity",
  "peer_relative_advantage",
]);

export const DimensionIdSchema = z.enum([
  "capability_presence",
  "discoverability",
  "information_completeness",
  "technical_depth",
  "workflow_support",
  "document_accessibility",
  "product_navigation",
  "engineering_utility",
  "evidence_quality",
  "evidence_recency",
  "cross_channel_consistency",
]);

export const DimensionDefinitionSchema = z.object({
  id: DimensionIdSchema,
  name: z.string(),
  description: z.string(),
  measures: z.string(),
  applicableConcepts: z.array(z.string()).default([]),
  requiredObservations: z.array(z.string()).default([]),
  scoringRules: z.string(),
  confidenceRules: z.string(),
  exclusionRules: z.string().default(""),
  missingEvidenceBehavior: z.enum([
    "mark_unknown",
    "exclude_dimension",
    "cap_confidence",
  ]),
  outputRange: z.object({ min: z.number(), max: z.number() }),
  weight: z.number().min(0).max(1),
  version: z.string(),
});

export const BenchmarkDefinitionSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string(),
  version: z.string(),
  industry: z.string(),
  status: BenchmarkStatusSchema,
  scope: z.string(),
  canonical_concepts: z.array(z.string()),
  dimensions: z.array(DimensionDefinitionSchema),
  weights: z.record(z.string(), z.number()),
  eligibility_rules: z.object({
    minMappedConcepts: z.number().int().nonnegative(),
    minEvidenceCoverage: z.number().min(0).max(1),
    minEligibleDimensions: z.number().int().nonnegative(),
    requiredDimensions: z.array(z.string()).default([]),
  }),
  evidence_requirements: z.object({
    requireEvidenceForPresent: z.boolean().default(true),
    allowStaleEvidence: z.boolean().default(false),
    excludeCandidatePatterns: z.boolean().default(true),
  }),
  confidence_rules: z.object({
    highMappingFloor: z.number().min(0).max(1).default(0.9),
    mediumMappingFloor: z.number().min(0).max(1).default(0.75),
    stalePenalty: z.number().min(0).max(1).default(0.25),
    conflictPenalty: z.number().min(0).max(1).default(0.35),
    unknownCapsAggregate: z.boolean().default(true),
  }),
  missing_data_policy: z.object({
    unknownIsNotAbsent: z.literal(true).default(true),
    suppressOverallBelowCoverage: z.number().min(0).max(1),
    fabricateScores: z.literal(false).default(false),
  }),
  created_at: z.string(),
  updated_at: z.string(),
  reviewed_by: z.string().nullable().default(null),
  reviewed_at: z.string().nullable().default(null),
  notes: z.string().default(""),
  schemaVersion: z.string().default(BENCHMARK_SCHEMA_VERSION),
});

export const BenchmarkObservationSchema = z.object({
  id: z.string(),
  schemaVersion: z.string().default(BENCHMARK_SCHEMA_VERSION),
  projectSlug: z.string(),
  companyName: z.string(),
  benchmarkId: z.string(),
  benchmarkVersion: z.string(),
  canonicalConceptId: z.string(),
  sourceEntityId: z.string().nullable().default(null),
  dimensionId: DimensionIdSchema,
  observedState: ObservedStateSchema,
  rawValue: z.union([z.number(), z.string(), z.boolean(), z.null()]),
  normalizedValue: z.number().min(0).max(1).nullable(),
  confidence: z.number().min(0).max(1),
  evidenceIds: z.array(z.string()).default([]),
  provenance: z.record(z.string(), z.unknown()).default({}),
  conflictIds: z.array(z.string()).default([]),
  ambiguity: z.string().default(""),
  evaluator: z.string().default("benchmark.observe.v1"),
  method: z.string().default("mapping_evidence"),
  generatedAt: z.string(),
  notes: z.string().default(""),
});

export const ScoreOutputSchema = z.object({
  level: z.enum([
    "observation",
    "canonical_concept",
    "dimension",
    "company",
    "peer_comparison",
    "benchmark_run",
  ]),
  id: z.string(),
  label: z.string(),
  projectSlug: z.string().optional(),
  canonicalConceptId: z.string().optional(),
  dimensionId: z.string().optional(),
  rawScore: z.number().nullable(),
  weightedScore: z.number().nullable(),
  confidence: z.number().min(0).max(1),
  evidenceCoverage: z.number().min(0).max(1),
  completeness: z.number().min(0).max(1),
  uncertainty: z.number().min(0).max(1),
  exclusions: z.array(z.string()).default([]),
  caveats: z.array(z.string()).default([]),
  benchmarkId: z.string(),
  benchmarkVersion: z.string(),
  eligible: z.boolean(),
  calculationTrace: z.array(z.string()).default([]),
});

export const BenchmarkRecommendationSchema = z.object({
  id: z.string(),
  projectSlug: z.string(),
  companyName: z.string(),
  canonicalConceptId: z.string(),
  dimensionId: z.string(),
  kind: RecommendationKindSchema,
  observedGap: z.string(),
  evidenceIds: z.array(z.string()).default([]),
  confidence: z.number().min(0).max(1),
  expectedImpact: z.string(),
  recommendedAction: z.string(),
  priorityRationale: z.string(),
  dependencies: z.array(z.string()).default([]),
  limitations: z.array(z.string()).default([]),
  benchmarkId: z.string(),
  benchmarkVersion: z.string(),
  generatedAt: z.string(),
});

export const BenchmarkApprovalSchema = z.object({
  key: z.enum([
    "benchmark.definition.review",
    "benchmark.observation.review",
    "benchmark.publish",
  ]),
  artifactId: z.string(),
  artifactVersion: z.string(),
  digest: z.string(),
  reviewer: z.string(),
  timestamp: z.string(),
  decision: z.enum(["approved", "rejected", "needs_changes"]),
  rationale: z.string(),
  valid: z.boolean().default(true),
  invalidatedReason: z.string().nullable().default(null),
});

export const CompanyBenchmarkStatusSchema = z.object({
  schemaVersion: z.literal(BENCHMARK_SCHEMA_VERSION),
  projectSlug: z.string(),
  companyName: z.string(),
  benchmarkId: z.string(),
  benchmarkVersion: z.string(),
  generatedAt: z.string(),
  dryRun: z.boolean().default(false),
  syntheticFixture: z.boolean().default(false),
  observationCount: z.number().int().nonnegative(),
  presentCount: z.number().int().nonnegative(),
  absentCount: z.number().int().nonnegative(),
  partialCount: z.number().int().nonnegative(),
  unknownCount: z.number().int().nonnegative(),
  ambiguousCount: z.number().int().nonnegative(),
  conflictCount: z.number().int().nonnegative(),
  conceptScoreCount: z.number().int().nonnegative(),
  dimensionScoreCount: z.number().int().nonnegative(),
  overallEligible: z.boolean(),
  overallRawScore: z.number().nullable(),
  overallWeightedScore: z.number().nullable(),
  overallConfidence: z.number().min(0).max(1),
  evidenceCoverage: z.number().min(0).max(1),
  recommendationCount: z.number().int().nonnegative(),
  caveats: z.array(z.string()).default([]),
  runId: z.string(),
  inputDigest: z.string(),
});

export type BenchmarkStatus = z.infer<typeof BenchmarkStatusSchema>;
export type ObservedState = z.infer<typeof ObservedStateSchema>;
export type DimensionId = z.infer<typeof DimensionIdSchema>;
export type DimensionDefinition = z.infer<typeof DimensionDefinitionSchema>;
export type BenchmarkDefinition = z.infer<typeof BenchmarkDefinitionSchema>;
export type BenchmarkObservation = z.infer<typeof BenchmarkObservationSchema>;
export type ScoreOutput = z.infer<typeof ScoreOutputSchema>;
export type BenchmarkRecommendation = z.infer<
  typeof BenchmarkRecommendationSchema
>;
export type BenchmarkApproval = z.infer<typeof BenchmarkApprovalSchema>;
export type CompanyBenchmarkStatus = z.infer<
  typeof CompanyBenchmarkStatusSchema
>;
