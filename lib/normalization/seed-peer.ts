/**
 * Seeds a second CFS manufacturer fixture for cross-company intelligence proof.
 * Uses a fictional company — no EB Metal special-casing; no real-site crawl required.
 */
import fs from "node:fs";
import {
  entityId,
  evidenceId,
  observationKey,
  relationshipId,
} from "@/lib/knowledge/ids";
import {
  buildIndex,
  mergeSliceIntoStore,
  refreshCandidatePatterns,
} from "@/lib/knowledge/merge";
import { refreshCanonicalCandidatePatterns } from "@/lib/normalization/patterns";
import { normalizeProject } from "@/lib/normalization/engine";
import { ensureConceptRegistry } from "@/lib/normalization/registry";
import { ensureKnowledgeSkeleton, writeJson } from "@/lib/knowledge/paths";
import { loadStore, persistStore } from "@/lib/knowledge/store";
import { KNOWLEDGE_SCHEMA_VERSION } from "@/lib/schemas/knowledge";
import type { ProjectKnowledgeSlice } from "@/lib/schemas/knowledge";
import {
  ensureProjectDirs,
  projectPath,
  writeJsonFile,
  writeProjectConfig,
} from "@/lib/project";

export const PEER_SLUG = "northline-framing";
export const PEER_NAME = "Northline Framing";

function now(): string {
  return new Date().toISOString();
}

export function buildPeerKnowledgeSlice(): ProjectKnowledgeSlice {
  const slug = PEER_SLUG;
  const company = PEER_NAME;
  const ts = now();
  const capture = ts.slice(0, 10);

  const companyEntId = entityId("Company", "northline-framing", {
    projectSlug: slug,
  });
  const industryId = entityId(
    "Industry",
    "cold-formed-steel-framing-and-building-products",
    { global: true },
  );
  const websiteId = entityId("Website", "https-www-northline-framing-example", {
    projectSlug: slug,
  });

  const mkEv = (excerpt: string, url: string, epistemicClass: "fact" | "observation" = "observation") => {
    const id = evidenceId(slug, url, excerpt);
    return {
      id,
      schemaVersion: KNOWLEDGE_SCHEMA_VERSION,
      provenance: {
        sourceCompany: company,
        sourceProject: slug,
        sourceUrl: url,
        sourcePageTitle: "Northline Framing",
        captureDate: capture,
        evidenceExcerpt: excerpt,
        confidence: "medium" as const,
        extractionMethod: "inventory_map" as const,
        reviewStatus: "unreviewed" as const,
        epistemicClass,
        visibility: "shared_unreviewed" as const,
      },
      relatedEntityIds: [] as string[],
      relatedRelationshipIds: [] as string[],
      stale: false,
      createdAt: ts,
      updatedAt: ts,
    };
  };

  const evidences = [
    mkEv(
      "Engineering Resources hosts load tables and literature downloads.",
      "https://www.northline-framing.example/resources",
      "fact",
    ),
    mkEv(
      "Wall Selector helps size studs for limiting height conditions.",
      "https://www.northline-framing.example/tools/wall-selector",
      "fact",
    ),
    mkEv(
      "Submittal Builder assembles product packages for bid documents.",
      "https://www.northline-framing.example/submittals",
      "fact",
    ),
    mkEv(
      "Primary nav: Products, Tools, Resources, Contact.",
      "https://www.northline-framing.example/",
      "observation",
    ),
    mkEv(
      "Mobile homepage is dense; calculator entry is weak on small viewports.",
      "https://www.northline-framing.example/",
      "observation",
    ),
    mkEv(
      "Maturity: calculators weak; document management weak; accessibility weak.",
      "https://www.northline-framing.example/",
      "observation",
    ),
  ];

  const ev = (i: number) => evidences[i]!.id;

  const entities = [
    {
      id: companyEntId,
      schemaVersion: KNOWLEDGE_SCHEMA_VERSION,
      type: "Company" as const,
      name: company,
      normalizedKey: "northline-framing",
      properties: {
        websiteUrl: "https://www.northline-framing.example/",
        industry: "Cold-formed steel framing and building products",
        fixture: true,
      },
      epistemicClass: "fact" as const,
      visibility: "shared_unreviewed" as const,
      sourceProjects: [slug],
      evidenceIds: [ev(0)],
      reviewStatus: "unreviewed" as const,
      conflictIds: [] as string[],
      createdAt: ts,
      updatedAt: ts,
    },
    {
      id: industryId,
      schemaVersion: KNOWLEDGE_SCHEMA_VERSION,
      type: "Industry" as const,
      name: "Cold-formed steel framing and building products",
      normalizedKey: "cold-formed-steel-framing-and-building-products",
      properties: {},
      epistemicClass: "fact" as const,
      visibility: "shared_unreviewed" as const,
      sourceProjects: [slug],
      evidenceIds: [ev(0)],
      reviewStatus: "unreviewed" as const,
      conflictIds: [] as string[],
      createdAt: ts,
      updatedAt: ts,
    },
    {
      id: websiteId,
      schemaVersion: KNOWLEDGE_SCHEMA_VERSION,
      type: "Website" as const,
      name: "https://www.northline-framing.example/",
      normalizedKey: "https-www-northline-framing-example",
      properties: { approvedHosts: ["northline-framing.example"] },
      epistemicClass: "fact" as const,
      visibility: "project_private" as const,
      sourceProjects: [slug],
      evidenceIds: [ev(0)],
      reviewStatus: "unreviewed" as const,
      conflictIds: [] as string[],
      createdAt: ts,
      updatedAt: ts,
    },
    {
      id: entityId("TechnicalResource", "engineering-resources", {
        projectSlug: slug,
      }),
      schemaVersion: KNOWLEDGE_SCHEMA_VERSION,
      type: "TechnicalResource" as const,
      name: "Engineering Resources",
      normalizedKey: "engineering-resources",
      properties: { role: "document_center" },
      epistemicClass: "fact" as const,
      visibility: "shared_unreviewed" as const,
      sourceProjects: [slug],
      evidenceIds: [ev(0)],
      reviewStatus: "unreviewed" as const,
      conflictIds: [] as string[],
      createdAt: ts,
      updatedAt: ts,
    },
    {
      id: entityId("Calculator", "wall-selector", { projectSlug: slug }),
      schemaVersion: KNOWLEDGE_SCHEMA_VERSION,
      type: "Calculator" as const,
      name: "Wall Selector",
      normalizedKey: "wall-selector",
      properties: { classification: "table_driven" },
      epistemicClass: "observation" as const,
      visibility: "shared_unreviewed" as const,
      sourceProjects: [slug],
      evidenceIds: [ev(1)],
      reviewStatus: "unreviewed" as const,
      conflictIds: [] as string[],
      createdAt: ts,
      updatedAt: ts,
    },
    {
      id: entityId("SubmittalWorkflow", "submittal-builder", {
        projectSlug: slug,
      }),
      schemaVersion: KNOWLEDGE_SCHEMA_VERSION,
      type: "SubmittalWorkflow" as const,
      name: "Submittal Builder",
      normalizedKey: "submittal-builder",
      properties: {},
      epistemicClass: "observation" as const,
      visibility: "shared_unreviewed" as const,
      sourceProjects: [slug],
      evidenceIds: [ev(2)],
      reviewStatus: "unreviewed" as const,
      conflictIds: [] as string[],
      createdAt: ts,
      updatedAt: ts,
    },
    {
      id: entityId("ProductFamily", "prostud-series", { projectSlug: slug }),
      schemaVersion: KNOWLEDGE_SCHEMA_VERSION,
      type: "ProductFamily" as const,
      name: "ProStud Series",
      normalizedKey: "prostud-series",
      properties: {},
      epistemicClass: "fact" as const,
      visibility: "shared_unreviewed" as const,
      sourceProjects: [slug],
      evidenceIds: [ev(0)],
      reviewStatus: "unreviewed" as const,
      conflictIds: [] as string[],
      createdAt: ts,
      updatedAt: ts,
    },
    {
      id: entityId("Document", "limiting-height-tables", { projectSlug: slug }),
      schemaVersion: KNOWLEDGE_SCHEMA_VERSION,
      type: "Document" as const,
      name: "Limiting Height Tables",
      normalizedKey: "limiting-height-tables",
      properties: { documentKind: "engineering_table" },
      epistemicClass: "fact" as const,
      visibility: "shared_unreviewed" as const,
      sourceProjects: [slug],
      evidenceIds: [ev(0)],
      reviewStatus: "unreviewed" as const,
      conflictIds: [] as string[],
      createdAt: ts,
      updatedAt: ts,
    },
    {
      id: entityId("NavigationPattern", "products-tools-resources", {
        projectSlug: slug,
      }),
      schemaVersion: KNOWLEDGE_SCHEMA_VERSION,
      type: "NavigationPattern" as const,
      name: "Products / Tools / Resources IA",
      normalizedKey: "navigation-products-tools-resources-present",
      properties: {
        observationKey: observationKey({
          category: "navigation-pattern",
          signal: "dept-ia-products-tools-resources",
          polarity: "present",
        }),
      },
      epistemicClass: "observation" as const,
      visibility: "shared_unreviewed" as const,
      sourceProjects: [slug],
      evidenceIds: [ev(3)],
      reviewStatus: "unreviewed" as const,
      conflictIds: [] as string[],
      createdAt: ts,
      updatedAt: ts,
    },
    // Shared observation keys with typical CFS audits (matches EB Metal maturity keys)
    {
      id: entityId("ProcessIssue", "calculators-weak", { projectSlug: slug }),
      schemaVersion: KNOWLEDGE_SCHEMA_VERSION,
      type: "ProcessIssue" as const,
      name: "Calculators: score 2/10",
      normalizedKey: "calculators-calculators-weak",
      properties: {
        observationKey: "calculators-calculators-weak",
        score: 2,
      },
      epistemicClass: "observation" as const,
      visibility: "shared_unreviewed" as const,
      sourceProjects: [slug],
      evidenceIds: [ev(5)],
      reviewStatus: "unreviewed" as const,
      conflictIds: [] as string[],
      createdAt: ts,
      updatedAt: ts,
    },
    {
      id: entityId("UxIssue", "document-management-weak", { projectSlug: slug }),
      schemaVersion: KNOWLEDGE_SCHEMA_VERSION,
      type: "UxIssue" as const,
      name: "Document management: score 3/10",
      normalizedKey: "document-management-document-management-weak",
      properties: {
        observationKey: "document-management-document-management-weak",
        score: 3,
      },
      epistemicClass: "observation" as const,
      visibility: "shared_unreviewed" as const,
      sourceProjects: [slug],
      evidenceIds: [ev(5)],
      reviewStatus: "unreviewed" as const,
      conflictIds: [] as string[],
      createdAt: ts,
      updatedAt: ts,
    },
    {
      id: entityId("AccessibilityIssue", "accessibility-weak", {
        projectSlug: slug,
      }),
      schemaVersion: KNOWLEDGE_SCHEMA_VERSION,
      type: "AccessibilityIssue" as const,
      name: "Accessibility: score 3/10",
      normalizedKey: "accessibility-accessibility-weak",
      properties: {
        observationKey: "accessibility-accessibility-weak",
        score: 3,
      },
      epistemicClass: "observation" as const,
      visibility: "shared_unreviewed" as const,
      sourceProjects: [slug],
      evidenceIds: [ev(5)],
      reviewStatus: "unreviewed" as const,
      conflictIds: [] as string[],
      createdAt: ts,
      updatedAt: ts,
    },
    {
      id: entityId("ProcessIssue", "submittal-weak", { projectSlug: slug }),
      schemaVersion: KNOWLEDGE_SCHEMA_VERSION,
      type: "ProcessIssue" as const,
      name: "Submittal workflow: score 2/10",
      normalizedKey: "submittal-workflow-submittal-workflow-weak",
      properties: {
        observationKey: "submittal-workflow-submittal-workflow-weak",
        score: 2,
      },
      epistemicClass: "observation" as const,
      visibility: "shared_unreviewed" as const,
      sourceProjects: [slug],
      evidenceIds: [ev(2)],
      reviewStatus: "unreviewed" as const,
      conflictIds: [] as string[],
      createdAt: ts,
      updatedAt: ts,
    },
  ];

  const relationships = [
    {
      id: relationshipId(
        "COMPANY_OPERATES_IN_INDUSTRY",
        companyEntId,
        industryId,
        slug,
      ),
      schemaVersion: KNOWLEDGE_SCHEMA_VERSION,
      type: "COMPANY_OPERATES_IN_INDUSTRY" as const,
      fromId: companyEntId,
      toId: industryId,
      properties: {},
      epistemicClass: "fact" as const,
      visibility: "shared_unreviewed" as const,
      sourceProjects: [slug],
      evidenceIds: [ev(0)],
      reviewStatus: "unreviewed" as const,
      conflictIds: [] as string[],
      createdAt: ts,
      updatedAt: ts,
    },
    {
      id: relationshipId(
        "COMPANY_HAS_WEBSITE",
        companyEntId,
        websiteId,
        slug,
      ),
      schemaVersion: KNOWLEDGE_SCHEMA_VERSION,
      type: "COMPANY_HAS_WEBSITE" as const,
      fromId: companyEntId,
      toId: websiteId,
      properties: {},
      epistemicClass: "fact" as const,
      visibility: "shared_unreviewed" as const,
      sourceProjects: [slug],
      evidenceIds: [ev(0)],
      reviewStatus: "unreviewed" as const,
      conflictIds: [] as string[],
      createdAt: ts,
      updatedAt: ts,
    },
    {
      id: relationshipId(
        "COMPANY_PROVIDES_CALCULATOR",
        companyEntId,
        entities[4]!.id,
        slug,
      ),
      schemaVersion: KNOWLEDGE_SCHEMA_VERSION,
      type: "COMPANY_PROVIDES_CALCULATOR" as const,
      fromId: companyEntId,
      toId: entities[4]!.id,
      properties: {},
      epistemicClass: "observation" as const,
      visibility: "shared_unreviewed" as const,
      sourceProjects: [slug],
      evidenceIds: [ev(1)],
      reviewStatus: "unreviewed" as const,
      conflictIds: [] as string[],
      createdAt: ts,
      updatedAt: ts,
    },
  ];

  // Wire evidence related ids
  for (const e of evidences) {
    e.relatedEntityIds = entities
      .filter((ent) => ent.evidenceIds.includes(e.id))
      .map((ent) => ent.id);
  }

  return {
    schemaVersion: KNOWLEDGE_SCHEMA_VERSION,
    projectSlug: slug,
    companyName: company,
    industry: "Cold-formed steel framing and building products",
    extractedAt: ts,
    sourceArtifactHashes: { fixture: "northline-framing-v1" },
    entities,
    relationships,
    evidence: evidences,
    conflicts: [],
  };
}

export type SeedPeerResult = {
  slug: string;
  entityCount: number;
  observationCandidatesCreated: number;
  canonicalCandidatesCreated: number;
  normalizeEb?: unknown;
  normalizePeer?: unknown;
};

/**
 * Create fixture project + ingest into shared knowledge store + normalize both companies.
 */
export function seedPeerManufacturer(opts: {
  alsoNormalizeEbMetal?: boolean;
} = {}): SeedPeerResult {
  const slug = PEER_SLUG;
  ensureProjectDirs(slug);
  writeProjectConfig({
    name: PEER_NAME,
    slug,
    websiteUrl: "https://www.northline-framing.example/",
    approvedHosts: ["northline-framing.example", "www.northline-framing.example"],
    industry: "Cold-formed steel framing and building products",
    maxCrawlPages: 40,
    crawlDelayMs: 750,
    prototypeDepth: "website_plus_interactive_tools",
    modules: [
      "product_catalog",
      "calculator",
      "document_center",
      "submittal_builder",
      "contact_workflow",
    ],
    notes:
      "Synthetic CFS peer manufacturer fixture for Sprint 4 cross-company intelligence. Not a live crawl.",
    stage: "evidence_collected",
    createdAt: now(),
    updatedAt: now(),
  });

  writeJsonFile(projectPath(slug, "data/company-profile.json"), {
    name: PEER_NAME,
    websiteUrl: "https://www.northline-framing.example/",
    industry: "Cold-formed steel framing and building products",
    summary:
      "Northline Framing is a fictional cold-formed steel framing manufacturer used as a SiteForge cross-company fixture.",
    fixture: true,
  });
  writeJsonFile(projectPath(slug, "data/product-inventory.json"), {
    families: [{ name: "ProStud Series", products: ["PS-362", "PS-600"] }],
  });
  writeJsonFile(projectPath(slug, "data/document-inventory.json"), {
    documents: [
      { title: "Limiting Height Tables", type: "engineering_table" },
      { title: "ProStud Data Sheet", type: "datasheet" },
    ],
  });
  writeJsonFile(projectPath(slug, "source/pages.json"), [
    {
      url: "https://www.northline-framing.example/",
      title: "Northline Framing",
      status: 200,
      mainTextSummary:
        "Cold-formed steel framing. Products, Tools, Engineering Resources, Submittal Builder.",
    },
  ]);

  const slice = buildPeerKnowledgeSlice();
  const dir = projectPath(slug, "knowledge");
  fs.mkdirSync(dir, { recursive: true });
  writeJson(`${dir}/entities.json`, slice.entities);
  writeJson(`${dir}/relationships.json`, slice.relationships);
  writeJson(`${dir}/evidence.json`, slice.evidence);
  writeJson(`${dir}/conflicts.json`, []);
  writeJson(`${dir}/extract-manifest.json`, {
    schemaVersion: slice.schemaVersion,
    projectSlug: slug,
    extractedAt: slice.extractedAt,
    sourceArtifactHashes: slice.sourceArtifactHashes,
    fixture: true,
  });

  ensureKnowledgeSkeleton();
  ensureConceptRegistry();
  const store = loadStore();

  // Remove prior peer contribution for idempotent re-seed
  for (const [id, ent] of [...store.entities.entries()]) {
    const only =
      ent.sourceProjects.length === 1 && ent.sourceProjects[0] === slug;
    if (only) store.entities.delete(id);
    else if (ent.sourceProjects.includes(slug)) {
      ent.sourceProjects = ent.sourceProjects.filter((p) => p !== slug);
    }
  }
  for (const [id, rel] of [...store.relationships.entries()]) {
    if (rel.sourceProjects.length === 1 && rel.sourceProjects[0] === slug) {
      store.relationships.delete(id);
    }
  }
  for (const [id, ev] of [...store.evidence.entries()]) {
    if (ev.provenance.sourceProject === slug) store.evidence.delete(id);
  }

  mergeSliceIntoStore(store, slice);
  const obsStats = refreshCandidatePatterns(store);

  let normalizeEb: unknown;
  let normalizePeer: unknown;
  if (opts.alsoNormalizeEbMetal !== false) {
    persistStore(store, buildIndex(store));
    normalizeEb = normalizeProject({ slug: "eb-metal", rebuild: true });
    normalizePeer = normalizeProject({ slug, rebuild: true });
    const store2 = loadStore();
    const canonStats = refreshCanonicalCandidatePatterns(store2, [
      "eb-metal",
      slug,
    ]);
    persistStore(store2, buildIndex(store2));
    return {
      slug,
      entityCount: slice.entities.length,
      observationCandidatesCreated: obsStats.created,
      canonicalCandidatesCreated: canonStats.created,
      normalizeEb: (normalizeEb as { status: unknown }).status,
      normalizePeer: (normalizePeer as { status: unknown }).status,
    };
  }

  persistStore(store, buildIndex(store));
  return {
    slug,
    entityCount: slice.entities.length,
    observationCandidatesCreated: obsStats.created,
    canonicalCandidatesCreated: 0,
  };
}
