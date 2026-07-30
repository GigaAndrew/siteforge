import { z } from "zod";

export const NORMALIZATION_SCHEMA_VERSION = "1.0.0" as const;

export const ConceptStatusSchema = z.enum([
  "draft",
  "candidate",
  "reviewed",
  "accepted",
  "deprecated",
]);

export const ConceptTypeSchema = z.enum([
  "capability",
  "workflow",
  "document_type",
  "product_structure",
  "navigation",
  "tool",
  "experience",
  "resource",
  "observation_signal",
  "other",
]);

export const MappingMethodSchema = z.enum([
  "exact",
  "alias",
  "semantic",
  "structural",
  "manually_reviewed",
]);

export const MappingReviewStatusSchema = z.enum([
  "unreviewed",
  "confirmed",
  "rejected",
  "ambiguous",
]);

export const CanonicalConceptSchema = z.object({
  id: z.string(),
  schemaVersion: z.string().default(NORMALIZATION_SCHEMA_VERSION),
  canonical_name: z.string(),
  description: z.string(),
  concept_type: ConceptTypeSchema,
  industry: z.string().default("cold-formed-steel"),
  aliases: z.array(z.string()).default([]),
  company_specific_aliases: z
    .record(z.string(), z.array(z.string()))
    .default({}),
  status: ConceptStatusSchema.default("accepted"),
  confidence: z.number().min(0).max(1).default(0.9),
  version: z.string().default("1.0.0"),
  created_at: z.string(),
  updated_at: z.string(),
  reviewed_by: z.string().nullable().default(null),
  reviewed_at: z.string().nullable().default(null),
  notes: z.string().default(""),
});

export const AliasMappingSchema = z.object({
  id: z.string(),
  schemaVersion: z.string().default(NORMALIZATION_SCHEMA_VERSION),
  sourceCompany: z.string(),
  sourceProject: z.string(),
  sourceEntityId: z.string().nullable().default(null),
  originalLabel: z.string(),
  lexicalKey: z.string(),
  canonicalConceptId: z.string().nullable().default(null),
  mappingConfidence: z.number().min(0).max(1),
  mappingMethod: MappingMethodSchema,
  evidenceIds: z.array(z.string()).default([]),
  reviewStatus: MappingReviewStatusSchema.default("unreviewed"),
  ambiguityNotes: z.string().default(""),
  version: z.string().default("1.0.0"),
  createdAt: z.string(),
  updatedAt: z.string(),
  belowThreshold: z.boolean().default(false),
});

export const ProjectNormalizationStatusSchema = z.object({
  schemaVersion: z.literal(NORMALIZATION_SCHEMA_VERSION),
  projectSlug: z.string(),
  generatedAt: z.string(),
  entityCount: z.number().int().nonnegative(),
  mappedCount: z.number().int().nonnegative(),
  unmappedCount: z.number().int().nonnegative(),
  ambiguousCount: z.number().int().nonnegative(),
  belowThresholdCount: z.number().int().nonnegative(),
  averageConfidence: z.number().min(0).max(1),
  conceptCoverage: z.record(z.string(), z.number()),
  dryRun: z.boolean().default(false),
});

export type ConceptStatus = z.infer<typeof ConceptStatusSchema>;
export type ConceptType = z.infer<typeof ConceptTypeSchema>;
export type MappingMethod = z.infer<typeof MappingMethodSchema>;
export type MappingReviewStatus = z.infer<typeof MappingReviewStatusSchema>;
export type CanonicalConcept = z.infer<typeof CanonicalConceptSchema>;
export type AliasMapping = z.infer<typeof AliasMappingSchema>;
export type ProjectNormalizationStatus = z.infer<
  typeof ProjectNormalizationStatusSchema
>;

/** Default auto-map threshold — below this remains unmapped/flagged. */
export const DEFAULT_MAPPING_THRESHOLD = 0.72;
