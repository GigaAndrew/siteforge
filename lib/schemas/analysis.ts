import { z } from "zod";

export const SourcedFactSchema = z.object({
  claim: z.string(),
  sourceUrl: z.string().url(),
  confidence: z.enum(["high", "medium", "low"]),
  kind: z.enum(["fact", "observation", "inference"]).default("fact"),
  notes: z.string().optional(),
});

export const CompanyProfileSchema = z.object({
  projectSlug: z.string(),
  companyName: z.string(),
  websiteUrl: z.string().url(),
  industry: z.string(),
  summary: z.string(),
  locations: z.array(SourcedFactSchema).default([]),
  offerings: z.array(SourcedFactSchema).default([]),
  audiences: z.array(SourcedFactSchema).default([]),
  standards: z.array(SourcedFactSchema).default([]),
  contacts: z.array(SourcedFactSchema).default([]),
  openQuestions: z.array(z.string()).default([]),
  updatedAt: z.string(),
});

export const ProductInventoryItemSchema = z.object({
  name: z.string(),
  family: z.string().optional(),
  category: z.string().optional(),
  description: z.string().optional(),
  sourceUrl: z.string().url(),
  attributes: z.record(z.string(), z.string()).default({}),
  documents: z.array(z.string()).default([]),
  confidence: z.enum(["high", "medium", "low"]).default("medium"),
  notes: z.string().optional(),
});

export const ProductInventorySchema = z.object({
  projectSlug: z.string(),
  products: z.array(ProductInventoryItemSchema),
  families: z.array(z.string()).default([]),
  updatedAt: z.string(),
});

export const DocumentInventoryItemSchema = z.object({
  title: z.string(),
  href: z.string(),
  fileType: z.string(),
  productFamily: z.string().optional(),
  documentType: z.string().optional(),
  sourcePageUrl: z.string().url(),
  revisionDate: z.string().optional(),
  status: z.enum(["current", "archived", "unknown"]).default("unknown"),
  confidence: z.enum(["high", "medium", "low"]).default("medium"),
});

export const DocumentInventorySchema = z.object({
  projectSlug: z.string(),
  documents: z.array(DocumentInventoryItemSchema),
  updatedAt: z.string(),
});

export const MaturityCategorySchema = z.object({
  category: z.string(),
  score: z.number().min(0).max(10),
  evidence: z.string(),
  sourceUrl: z.string().optional(),
  userImpact: z.string(),
  businessImpact: z.string(),
  recommendation: z.string(),
  prototypeResponse: z.string(),
  confidence: z.enum(["high", "medium", "low"]),
});

export const DigitalMaturitySchema = z.object({
  projectSlug: z.string(),
  categories: z.array(MaturityCategorySchema),
  overallScore: z.number().min(0).max(10),
  overallRationale: z.string(),
  updatedAt: z.string(),
});

export const CompetitorBenchmarkEntrySchema = z.object({
  competitor: z.string(),
  website: z.string().url().optional(),
  productSearch: z.string().optional(),
  calculators: z.string().optional(),
  submittals: z.string().optional(),
  documentCenter: z.string().optional(),
  bimCad: z.string().optional(),
  distributorTools: z.string().optional(),
  mobileExperience: z.string().optional(),
  seoMaturity: z.string().optional(),
  aiFeatures: z.string().optional(),
  observedStrengths: z.array(z.string()).default([]),
  observedWeaknesses: z.array(z.string()).default([]),
  analysisDate: z.string().optional(),
  status: z.enum(["empty", "partial", "complete"]).default("empty"),
  notes: z.string().optional(),
});

export const CompetitorBenchmarkSchema = z.object({
  projectSlug: z.string(),
  entries: z.array(CompetitorBenchmarkEntrySchema),
  status: z.enum(["empty", "partial", "complete"]).default("partial"),
  notes: z.string().default(
    "MVP framework only. Competitor domains are not auto-crawled.",
  ),
  updatedAt: z.string(),
});

export const CalculatorClassificationSchema = z.enum([
  "conceptual",
  "table_driven",
  "production_engineering",
]);

export const CalculatorRequirementsSchema = z.object({
  projectSlug: z.string(),
  calculators: z.array(
    z.object({
      id: z.string(),
      name: z.string(),
      classification: CalculatorClassificationSchema,
      problemSolved: z.string(),
      inputs: z.array(z.string()),
      outputs: z.array(z.string()),
      dataDependencies: z.array(z.string()),
      disclaimer: z.string(),
      prototypeScope: z.string(),
      productionScope: z.string(),
      risks: z.array(z.string()).default([]),
    }),
  ),
  updatedAt: z.string(),
});

export const CalculatorDemoDataSchema = z.object({
  projectSlug: z.string(),
  calculatorId: z.string(),
  classification: CalculatorClassificationSchema,
  disclaimer: z.string(),
  assumptions: z.array(z.string()).default([]),
  members: z.array(
    z.object({
      designation: z.string(),
      family: z.string(),
      depthIn: z.number(),
      thicknessMils: z.number().optional(),
      spacingIn: z.number(),
      lateralLoadPsf: z.number(),
      deflectionLimit: z.string(),
      maxHeightFt: z.number(),
      composite: z.boolean().optional(),
      sourceDocument: z.string().optional(),
      sourcePage: z.string().optional(),
      demoOnly: z.boolean().default(true),
    }),
  ),
  updatedAt: z.string(),
});

export type CompanyProfile = z.infer<typeof CompanyProfileSchema>;
export type ProductInventory = z.infer<typeof ProductInventorySchema>;
export type DocumentInventory = z.infer<typeof DocumentInventorySchema>;
export type DigitalMaturity = z.infer<typeof DigitalMaturitySchema>;
export type CompetitorBenchmark = z.infer<typeof CompetitorBenchmarkSchema>;
export type CalculatorRequirements = z.infer<typeof CalculatorRequirementsSchema>;
export type CalculatorDemoData = z.infer<typeof CalculatorDemoDataSchema>;
