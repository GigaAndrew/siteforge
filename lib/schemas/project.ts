import { z } from "zod";

export const ProjectStageSchema = z.enum([
  "created",
  "crawling",
  "evidence_collected",
  "audit_generated",
  "strategy_generated",
  "art_direction_ready",
  "design_system_ready",
  "prototype_ready",
  "qa_in_progress",
  "complete",
  "failed",
]);

export const PrototypeDepthSchema = z.enum([
  "audit_only",
  "homepage_concept",
  "core_website_concept",
  "website_plus_interactive_tools",
  "full_digital_platform_concept",
]);

export const ModuleOptionSchema = z.enum([
  "product_catalog",
  "product_detail",
  "calculator",
  "document_center",
  "submittal_builder",
  "distributor_locator",
  "project_workspace",
  "contact_workflow",
  "ai_search_concept",
]);

export const ProjectConfigSchema = z.object({
  name: z.string().min(1),
  slug: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  websiteUrl: z.string().url(),
  approvedHosts: z.array(z.string()).default([]),
  industry: z.string().min(1),
  maxCrawlPages: z.number().int().positive().max(200).default(75),
  crawlDelayMs: z.number().int().nonnegative().default(750),
  prototypeDepth: PrototypeDepthSchema.default(
    "website_plus_interactive_tools",
  ),
  modules: z.array(ModuleOptionSchema).default([]),
  notes: z.string().default(""),
  stage: ProjectStageSchema.default("created"),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export type ProjectConfig = z.infer<typeof ProjectConfigSchema>;
export type ProjectStage = z.infer<typeof ProjectStageSchema>;
export type PrototypeDepth = z.infer<typeof PrototypeDepthSchema>;
export type ModuleOption = z.infer<typeof ModuleOptionSchema>;
