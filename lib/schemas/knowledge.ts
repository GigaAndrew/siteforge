import { z } from "zod";

/** Bump when breaking entity/relationship shapes. See knowledge/schemas/MIGRATIONS.md */
export const KNOWLEDGE_SCHEMA_VERSION = "1.0.0" as const;

export const EpistemicClassSchema = z.enum([
  "fact",
  "observation",
  "inference",
  "recommendation",
  "reusable_pattern",
  "industry_conclusion",
  "candidate_pattern",
]);

export const ConfidenceSchema = z.enum(["high", "medium", "low"]);

export const ReviewStatusSchema = z.enum([
  "unreviewed",
  "approved",
  "rejected",
  "needs_review",
  "stale",
]);

export const VisibilitySchema = z.enum([
  "project_private",
  "shared_unreviewed",
  "shared_reviewed",
  "industry_candidate",
  "industry_approved",
]);

export const ExtractionMethodSchema = z.enum([
  "crawl_extract",
  "inventory_map",
  "audit_map",
  "strategy_map",
  "manual",
  "pattern_aggregate",
]);

export const EntityTypeSchema = z.enum([
  "Company",
  "Industry",
  "MarketSegment",
  "Website",
  "Page",
  "Audience",
  "UserTask",
  "ProductFamily",
  "Product",
  "ProductAttribute",
  "Document",
  "DocumentType",
  "Calculator",
  "ProductSelector",
  "SubmittalWorkflow",
  "DistributorWorkflow",
  "TechnicalResource",
  "Form",
  "Integration",
  "CMS",
  "Technology",
  "UxIssue",
  "AccessibilityIssue",
  "SeoIssue",
  "PerformanceIssue",
  "ProcessIssue",
  "DigitalOpportunity",
  "Feature",
  "DesignPattern",
  "NavigationPattern",
  "ContentPattern",
  "EngineeringWorkflow",
  "ImplementationDependency",
  "CandidatePattern",
]);

export const RelationshipTypeSchema = z.enum([
  "COMPANY_OPERATES_IN_INDUSTRY",
  "COMPANY_HAS_WEBSITE",
  "COMPANY_SERVES_AUDIENCE",
  "COMPANY_OFFERS_PRODUCT_FAMILY",
  "PRODUCT_BELONGS_TO_FAMILY",
  "PRODUCT_HAS_DOCUMENT",
  "PRODUCT_HAS_ATTRIBUTE",
  "WEBSITE_CONTAINS_PAGE",
  "PAGE_LINKS_TO_DOCUMENT",
  "PAGE_SUPPORTS_USER_TASK",
  "PAGE_EXHIBITS_UX_ISSUE",
  "WEBSITE_USES_TECHNOLOGY",
  "COMPANY_PROVIDES_CALCULATOR",
  "CALCULATOR_SUPPORTS_PRODUCT",
  "CALCULATOR_USES_DOCUMENT",
  "COMPANY_PROVIDES_SUBMITTAL_WORKFLOW",
  "WORKFLOW_HAS_PROCESS_ISSUE",
  "PROCESS_ISSUE_CREATES_OPPORTUNITY",
  "OPPORTUNITY_RECOMMENDS_FEATURE",
  "FEATURE_REQUIRES_DEPENDENCY",
  "COMPANY_EXHIBITS_DESIGN_PATTERN",
  "COMPANY_EXHIBITS_NAVIGATION_PATTERN",
  "FINDING_SUPPORTED_BY_SOURCE",
  "FINDING_HAS_CONFIDENCE",
  "PATTERN_OBSERVED_ACROSS_COMPANIES",
  "COMPANY_HAS_PROCESS_ISSUE",
  "COMPANY_HAS_DIGITAL_OPPORTUNITY",
  "PAGE_EXHIBITS_ACCESSIBILITY_ISSUE",
  "PAGE_EXHIBITS_SEO_ISSUE",
  "WEBSITE_HAS_PERFORMANCE_ISSUE",
]);

export const ProvenanceSchema = z.object({
  sourceCompany: z.string(),
  sourceProject: z.string(),
  sourceUrl: z.string().optional(),
  sourcePageTitle: z.string().optional(),
  captureDate: z.string(),
  evidenceExcerpt: z.string().optional(),
  structuredRef: z.string().optional(),
  confidence: ConfidenceSchema,
  extractionMethod: ExtractionMethodSchema,
  reviewStatus: ReviewStatusSchema.default("unreviewed"),
  lastVerifiedAt: z.string().optional(),
  epistemicClass: EpistemicClassSchema,
  visibility: VisibilitySchema.default("project_private"),
  /** Forge Reliability — additive Sprint 2 fields */
  sourceReliabilityClass: z.string().optional(),
  reliabilityScore: z.number().min(0).max(1).optional(),
  textQualityOk: z.boolean().optional(),
  textQualityIssues: z.array(z.string()).optional(),
});

export const EvidenceRecordSchema = z.object({
  id: z.string(),
  schemaVersion: z.literal(KNOWLEDGE_SCHEMA_VERSION).or(z.string()),
  provenance: ProvenanceSchema,
  relatedEntityIds: z.array(z.string()).default([]),
  relatedRelationshipIds: z.array(z.string()).default([]),
  stale: z.boolean().default(false),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export const KnowledgeEntitySchema = z.object({
  id: z.string(),
  schemaVersion: z.string().default(KNOWLEDGE_SCHEMA_VERSION),
  type: EntityTypeSchema,
  name: z.string(),
  normalizedKey: z.string(),
  properties: z.record(z.string(), z.unknown()).default({}),
  epistemicClass: EpistemicClassSchema,
  visibility: VisibilitySchema.default("project_private"),
  sourceProjects: z.array(z.string()).default([]),
  evidenceIds: z.array(z.string()).default([]),
  reviewStatus: ReviewStatusSchema.default("unreviewed"),
  conflictIds: z.array(z.string()).default([]),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export const KnowledgeRelationshipSchema = z.object({
  id: z.string(),
  schemaVersion: z.string().default(KNOWLEDGE_SCHEMA_VERSION),
  type: RelationshipTypeSchema,
  fromId: z.string(),
  toId: z.string(),
  properties: z.record(z.string(), z.unknown()).default({}),
  epistemicClass: EpistemicClassSchema,
  visibility: VisibilitySchema.default("project_private"),
  sourceProjects: z.array(z.string()).default([]),
  evidenceIds: z.array(z.string()).default([]),
  reviewStatus: ReviewStatusSchema.default("unreviewed"),
  conflictIds: z.array(z.string()).default([]),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export const ConflictRecordSchema = z.object({
  id: z.string(),
  schemaVersion: z.string().default(KNOWLEDGE_SCHEMA_VERSION),
  kind: z.enum([
    "entity_property_mismatch",
    "relationship_contradiction",
    "epistemic_downgrade",
    "stale_vs_fresh",
  ]),
  description: z.string(),
  entityIds: z.array(z.string()).default([]),
  relationshipIds: z.array(z.string()).default([]),
  evidenceIds: z.array(z.string()).default([]),
  sourceProjects: z.array(z.string()).default([]),
  blocksPatternPromotion: z.boolean().default(true),
  reviewStatus: ReviewStatusSchema.default("needs_review"),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export const CandidatePatternSchema = z.object({
  id: z.string(),
  schemaVersion: z.string().default(KNOWLEDGE_SCHEMA_VERSION),
  type: z.literal("CandidatePattern"),
  name: z.string(),
  normalizedObservationKey: z.string(),
  status: z.literal("candidate_unapproved"),
  label: z.string().default(
    "Candidate pattern — unapproved. Not an industry standard, best practice, or verified conclusion.",
  ),
  supportingCompanyIds: z.array(z.string()).default([]),
  supportingProjectSlugs: z.array(z.string()).default([]),
  evidenceIds: z.array(z.string()).default([]),
  confidenceSummary: ConfidenceSchema,
  exceptions: z.array(z.string()).default([]),
  normalizationLogic: z.string(),
  conflictIds: z.array(z.string()).default([]),
  blockedByConflicts: z.boolean().default(false),
  reviewStatus: ReviewStatusSchema.default("unreviewed"),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export const PromotionAuditEntrySchema = z.object({
  id: z.string(),
  at: z.string(),
  action: z.enum([
    "candidate_created",
    "candidate_blocked",
    "promoted",
    "rejected",
    "rebuilt",
    "stale_marked",
    "ingested",
  ]),
  actor: z.string().default("system"),
  patternId: z.string().optional(),
  projectSlug: z.string().optional(),
  reason: z.string(),
  details: z.record(z.string(), z.unknown()).default({}),
});

export const ProjectKnowledgeSliceSchema = z.object({
  schemaVersion: z.string().default(KNOWLEDGE_SCHEMA_VERSION),
  projectSlug: z.string(),
  companyName: z.string(),
  industry: z.string(),
  extractedAt: z.string(),
  sourceArtifactHashes: z.record(z.string(), z.string()).default({}),
  entities: z.array(KnowledgeEntitySchema),
  relationships: z.array(KnowledgeRelationshipSchema),
  evidence: z.array(EvidenceRecordSchema),
  conflicts: z.array(ConflictRecordSchema).default([]),
});

export const KnowledgeIndexSchema = z.object({
  schemaVersion: z.string().default(KNOWLEDGE_SCHEMA_VERSION),
  updatedAt: z.string(),
  byCompany: z.record(z.string(), z.array(z.string())),
  byIndustry: z.record(z.string(), z.array(z.string())),
  byProject: z.record(z.string(), z.array(z.string())),
  byEntityType: z.record(z.string(), z.array(z.string())),
  byRelationshipType: z.record(z.string(), z.array(z.string())),
  byEvidenceStatus: z.record(z.string(), z.array(z.string())),
  candidatePatternIds: z.array(z.string()).default([]),
});

export type EpistemicClass = z.infer<typeof EpistemicClassSchema>;
export type EntityType = z.infer<typeof EntityTypeSchema>;
export type RelationshipType = z.infer<typeof RelationshipTypeSchema>;
export type Provenance = z.infer<typeof ProvenanceSchema>;
export type EvidenceRecord = z.infer<typeof EvidenceRecordSchema>;
export type KnowledgeEntity = z.infer<typeof KnowledgeEntitySchema>;
export type KnowledgeRelationship = z.infer<typeof KnowledgeRelationshipSchema>;
export type ConflictRecord = z.infer<typeof ConflictRecordSchema>;
export type CandidatePattern = z.infer<typeof CandidatePatternSchema>;
export type PromotionAuditEntry = z.infer<typeof PromotionAuditEntrySchema>;
export type ProjectKnowledgeSlice = z.infer<typeof ProjectKnowledgeSliceSchema>;
export type KnowledgeIndex = z.infer<typeof KnowledgeIndexSchema>;
export type ReviewStatus = z.infer<typeof ReviewStatusSchema>;
export type Visibility = z.infer<typeof VisibilitySchema>;
