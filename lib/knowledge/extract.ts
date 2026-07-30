import fs from "node:fs";
import { projectPath, readJsonFile, readProjectConfig } from "@/lib/project";
import {
  KNOWLEDGE_SCHEMA_VERSION,
  type ConflictRecord,
  type EvidenceRecord,
  type KnowledgeEntity,
  type KnowledgeRelationship,
  type ProjectKnowledgeSlice,
} from "@/lib/schemas/knowledge";
import type { CompanyProfile, DigitalMaturity, DocumentInventory, ProductInventory } from "@/lib/schemas/analysis";
import type { PageRecord } from "@/lib/schemas/crawl";
import {
  entityId,
  evidenceId,
  fileContentHash,
  normalizeKey,
  observationKey,
  relationshipId,
} from "@/lib/knowledge/ids";
import { classifySourceReliability } from "@/lib/reliability/scores";
import { normalizeExtractedText } from "@/lib/crawler/text-normalize";

function now(): string {
  return new Date().toISOString();
}

type Builder = {
  entities: Map<string, KnowledgeEntity>;
  relationships: Map<string, KnowledgeRelationship>;
  evidence: Map<string, EvidenceRecord>;
  conflicts: Map<string, ConflictRecord>;
};

function upsertEntity(
  b: Builder,
  partial: Omit<KnowledgeEntity, "createdAt" | "updatedAt" | "schemaVersion"> & {
    createdAt?: string;
    updatedAt?: string;
  },
): KnowledgeEntity {
  const existing = b.entities.get(partial.id);
  const ts = now();
  if (!existing) {
    const ent: KnowledgeEntity = {
      ...partial,
      schemaVersion: KNOWLEDGE_SCHEMA_VERSION,
      createdAt: ts,
      updatedAt: ts,
    };
    b.entities.set(ent.id, ent);
    return ent;
  }
  const merged: KnowledgeEntity = {
    ...existing,
    ...partial,
    properties: { ...existing.properties, ...partial.properties },
    sourceProjects: [
      ...new Set([...existing.sourceProjects, ...partial.sourceProjects]),
    ],
    evidenceIds: [
      ...new Set([...existing.evidenceIds, ...partial.evidenceIds]),
    ],
    conflictIds: [
      ...new Set([...existing.conflictIds, ...(partial.conflictIds ?? [])]),
    ],
    updatedAt: ts,
  };
  // Prefer the longer human-readable name within a single project extract.
  // Cross-project contradictions are handled in merge.ts, not here.
  if (partial.name.length > existing.name.length) {
    merged.name = partial.name;
  } else {
    merged.name = existing.name;
  }
  b.entities.set(merged.id, merged);
  return merged;
}

function addEvidence(
  b: Builder,
  input: {
    projectSlug: string;
    companyName: string;
    sourceUrl?: string;
    sourcePageTitle?: string;
    excerpt: string;
    confidence: "high" | "medium" | "low";
    method: EvidenceRecord["provenance"]["extractionMethod"];
    epistemicClass: EvidenceRecord["provenance"]["epistemicClass"];
    entityIds?: string[];
    relationshipIds?: string[];
  },
): EvidenceRecord {
  const id = evidenceId(input.projectSlug, input.sourceUrl, input.excerpt);
  const ts = now();
  const existing = b.evidence.get(id);
  if (existing) {
    existing.relatedEntityIds = [
      ...new Set([
        ...existing.relatedEntityIds,
        ...(input.entityIds ?? []),
      ]),
    ];
    existing.relatedRelationshipIds = [
      ...new Set([
        ...existing.relatedRelationshipIds,
        ...(input.relationshipIds ?? []),
      ]),
    ];
    existing.updatedAt = ts;
    return existing;
  }
  const reliability = classifySourceReliability({
    url: input.sourceUrl,
    title: input.sourcePageTitle,
    pathHints: input.excerpt,
  });
  const textQuality = normalizeExtractedText(input.excerpt, { maxLength: 500 });
  let confidence = input.confidence;
  if (!textQuality.ok) confidence = "low";
  else if (textQuality.confidencePenalty >= 0.1 && confidence === "high") {
    confidence = "medium";
  }

  const ev: EvidenceRecord = {
    id,
    schemaVersion: KNOWLEDGE_SCHEMA_VERSION,
    provenance: {
      sourceCompany: input.companyName,
      sourceProject: input.projectSlug,
      sourceUrl: input.sourceUrl,
      sourcePageTitle: input.sourcePageTitle,
      captureDate: ts,
      evidenceExcerpt: (textQuality.ok ? textQuality.text : input.excerpt).slice(
        0,
        500,
      ),
      confidence,
      extractionMethod: input.method,
      reviewStatus: "unreviewed",
      lastVerifiedAt: ts,
      epistemicClass: input.epistemicClass,
      visibility: "project_private",
      sourceReliabilityClass: reliability.sourceClass,
      reliabilityScore: reliability.reliabilityScore,
      textQualityOk: textQuality.ok,
      textQualityIssues: textQuality.issues,
    },
    relatedEntityIds: input.entityIds ?? [],
    relatedRelationshipIds: input.relationshipIds ?? [],
    stale: false,
    createdAt: ts,
    updatedAt: ts,
  };
  b.evidence.set(id, ev);
  return ev;
}

function addRel(
  b: Builder,
  type: KnowledgeRelationship["type"],
  fromId: string,
  toId: string,
  projectSlug: string,
  epistemicClass: KnowledgeRelationship["epistemicClass"],
  evidenceIds: string[],
  properties: Record<string, unknown> = {},
): KnowledgeRelationship {
  const id = relationshipId(type, fromId, toId, projectSlug);
  const ts = now();
  const existing = b.relationships.get(id);
  if (existing) {
    existing.evidenceIds = [...new Set([...existing.evidenceIds, ...evidenceIds])];
    existing.updatedAt = ts;
    return existing;
  }
  const rel: KnowledgeRelationship = {
    id,
    schemaVersion: KNOWLEDGE_SCHEMA_VERSION,
    type,
    fromId,
    toId,
    properties,
    epistemicClass,
    visibility: "project_private",
    sourceProjects: [projectSlug],
    evidenceIds,
    reviewStatus: "unreviewed",
    conflictIds: [],
    createdAt: ts,
    updatedAt: ts,
  };
  b.relationships.set(id, rel);
  return rel;
}

function hashArtifact(slug: string, rel: string): string | null {
  const p = projectPath(slug, rel);
  if (!fs.existsSync(p)) return null;
  return fileContentHash(fs.readFileSync(p, "utf8"));
}

export function extractProjectKnowledge(slug: string): ProjectKnowledgeSlice {
  const config = readProjectConfig(slug);
  const profile =
    readJsonFile<CompanyProfile>(projectPath(slug, "data/company-profile.json"));
  const products =
    readJsonFile<ProductInventory>(projectPath(slug, "data/product-inventory.json"));
  const documents =
    readJsonFile<DocumentInventory>(
      projectPath(slug, "data/document-inventory.json"),
    );
  const maturity =
    readJsonFile<DigitalMaturity>(
      projectPath(slug, "analysis/digital-maturity.json"),
    );
  const pages =
    readJsonFile<PageRecord[]>(projectPath(slug, "source/pages.json")) ?? [];

  if (!profile) {
    throw new Error(
      `Missing data/company-profile.json for ${slug}. Run project:audit first.`,
    );
  }

  const b: Builder = {
    entities: new Map(),
    relationships: new Map(),
    evidence: new Map(),
    conflicts: new Map(),
  };

  const companyKey = normalizeKey(profile.companyName);
  const company = upsertEntity(b, {
    id: entityId("Company", companyKey, { projectSlug: slug }),
    type: "Company",
    name: profile.companyName,
    normalizedKey: companyKey,
    properties: {
      websiteUrl: profile.websiteUrl,
      industry: profile.industry,
      summary: profile.summary?.slice(0, 400),
    },
    epistemicClass: "fact",
    visibility: "shared_unreviewed",
    sourceProjects: [slug],
    evidenceIds: [],
    reviewStatus: "unreviewed",
    conflictIds: [],
  });

  const industryKey = normalizeKey(profile.industry);
  const industry = upsertEntity(b, {
    id: entityId("Industry", industryKey, { global: true }),
    type: "Industry",
    name: profile.industry,
    normalizedKey: industryKey,
    properties: {},
    epistemicClass: "fact",
    visibility: "shared_unreviewed",
    sourceProjects: [slug],
    evidenceIds: [],
    reviewStatus: "unreviewed",
    conflictIds: [],
  });

  const websiteKey = normalizeKey(profile.websiteUrl);
  const website = upsertEntity(b, {
    id: entityId("Website", websiteKey, { projectSlug: slug }),
    type: "Website",
    name: profile.websiteUrl,
    normalizedKey: websiteKey,
    properties: { approvedHosts: config.approvedHosts },
    epistemicClass: "fact",
    visibility: "project_private",
    sourceProjects: [slug],
    evidenceIds: [],
    reviewStatus: "unreviewed",
    conflictIds: [],
  });

  const homeEv = addEvidence(b, {
    projectSlug: slug,
    companyName: profile.companyName,
    sourceUrl: profile.websiteUrl,
    excerpt: `Company profile for ${profile.companyName}`,
    confidence: "high",
    method: "inventory_map",
    epistemicClass: "fact",
    entityIds: [company.id, industry.id, website.id],
  });
  company.evidenceIds.push(homeEv.id);
  industry.evidenceIds.push(homeEv.id);
  website.evidenceIds.push(homeEv.id);

  addRel(
    b,
    "COMPANY_OPERATES_IN_INDUSTRY",
    company.id,
    industry.id,
    slug,
    "fact",
    [homeEv.id],
  );
  addRel(
    b,
    "COMPANY_HAS_WEBSITE",
    company.id,
    website.id,
    slug,
    "fact",
    [homeEv.id],
  );

  for (const fact of profile.offerings) {
    const ev = addEvidence(b, {
      projectSlug: slug,
      companyName: profile.companyName,
      sourceUrl: fact.sourceUrl,
      excerpt: fact.claim,
      confidence: fact.confidence,
      method: "inventory_map",
      epistemicClass: fact.kind === "inference" ? "inference" : "fact",
      entityIds: [company.id],
    });
    company.evidenceIds.push(ev.id);
  }

  for (const aud of profile.audiences) {
    const key = normalizeKey(aud.claim.slice(0, 80));
    const audience = upsertEntity(b, {
      id: entityId("Audience", key, { projectSlug: slug }),
      type: "Audience",
      name: aud.claim.slice(0, 120),
      normalizedKey: key,
      properties: { notes: aud.notes },
      epistemicClass: aud.kind === "inference" ? "inference" : "fact",
      visibility: "project_private",
      sourceProjects: [slug],
      evidenceIds: [],
      reviewStatus: "unreviewed",
      conflictIds: [],
    });
    const ev = addEvidence(b, {
      projectSlug: slug,
      companyName: profile.companyName,
      sourceUrl: aud.sourceUrl,
      excerpt: aud.claim,
      confidence: aud.confidence,
      method: "inventory_map",
      epistemicClass: audience.epistemicClass,
      entityIds: [audience.id, company.id],
    });
    audience.evidenceIds.push(ev.id);
    addRel(
      b,
      "COMPANY_SERVES_AUDIENCE",
      company.id,
      audience.id,
      slug,
      audience.epistemicClass,
      [ev.id],
    );
  }

  const familyIds = new Map<string, string>();
  for (const fam of products?.families ?? []) {
    const key = normalizeKey(fam);
    const ent = upsertEntity(b, {
      id: entityId("ProductFamily", key, { projectSlug: slug }),
      type: "ProductFamily",
      name: fam,
      normalizedKey: key,
      properties: {},
      epistemicClass: "fact",
      visibility: "project_private",
      sourceProjects: [slug],
      evidenceIds: [],
      reviewStatus: "unreviewed",
      conflictIds: [],
    });
    familyIds.set(key, ent.id);
    const ev = addEvidence(b, {
      projectSlug: slug,
      companyName: profile.companyName,
      sourceUrl: profile.websiteUrl,
      excerpt: `Product family term observed: ${fam}`,
      confidence: "medium",
      method: "inventory_map",
      epistemicClass: "fact",
      entityIds: [ent.id],
    });
    ent.evidenceIds.push(ev.id);
    addRel(
      b,
      "COMPANY_OFFERS_PRODUCT_FAMILY",
      company.id,
      ent.id,
      slug,
      "fact",
      [ev.id],
    );
  }

  for (const prod of products?.products ?? []) {
    const key = normalizeKey(prod.name);
    const product = upsertEntity(b, {
      id: entityId("Product", key, { projectSlug: slug }),
      type: "Product",
      name: prod.name,
      normalizedKey: key,
      properties: {
        family: prod.family,
        category: prod.category,
        description: prod.description?.slice(0, 280),
      },
      epistemicClass: "fact",
      visibility: "project_private",
      sourceProjects: [slug],
      evidenceIds: [],
      reviewStatus: "unreviewed",
      conflictIds: [],
    });
    const ev = addEvidence(b, {
      projectSlug: slug,
      companyName: profile.companyName,
      sourceUrl: prod.sourceUrl,
      excerpt: `Product inventory: ${prod.name}`,
      confidence: prod.confidence,
      method: "inventory_map",
      epistemicClass: "fact",
      entityIds: [product.id],
    });
    product.evidenceIds.push(ev.id);
    if (prod.family) {
      const fk = normalizeKey(prod.family);
      let famId = familyIds.get(fk);
      if (!famId) {
        const fam = upsertEntity(b, {
          id: entityId("ProductFamily", fk, { projectSlug: slug }),
          type: "ProductFamily",
          name: prod.family,
          normalizedKey: fk,
          properties: {},
          epistemicClass: "fact",
          visibility: "project_private",
          sourceProjects: [slug],
          evidenceIds: [ev.id],
          reviewStatus: "unreviewed",
          conflictIds: [],
        });
        famId = fam.id;
        familyIds.set(fk, famId);
        addRel(
          b,
          "COMPANY_OFFERS_PRODUCT_FAMILY",
          company.id,
          famId,
          slug,
          "fact",
          [ev.id],
        );
      }
      addRel(
        b,
        "PRODUCT_BELONGS_TO_FAMILY",
        product.id,
        famId,
        slug,
        "fact",
        [ev.id],
      );
    }
    for (const [attr, value] of Object.entries(prod.attributes ?? {})) {
      const ak = normalizeKey(`${prod.name}:${attr}`);
      const attrEnt = upsertEntity(b, {
        id: entityId("ProductAttribute", ak, { projectSlug: slug }),
        type: "ProductAttribute",
        name: `${attr}=${value}`,
        normalizedKey: ak,
        properties: { attribute: attr, value },
        epistemicClass: "fact",
        visibility: "project_private",
        sourceProjects: [slug],
        evidenceIds: [ev.id],
        reviewStatus: "unreviewed",
        conflictIds: [],
      });
      addRel(
        b,
        "PRODUCT_HAS_ATTRIBUTE",
        product.id,
        attrEnt.id,
        slug,
        "fact",
        [ev.id],
      );
    }
    for (const docHref of prod.documents.slice(0, 20)) {
      const dk = normalizeKey(docHref);
      const doc = upsertEntity(b, {
        id: entityId("Document", dk, { projectSlug: slug }),
        type: "Document",
        name: docHref.split("/").pop() || docHref,
        normalizedKey: dk,
        properties: { href: docHref },
        epistemicClass: "fact",
        visibility: "project_private",
        sourceProjects: [slug],
        evidenceIds: [ev.id],
        reviewStatus: "unreviewed",
        conflictIds: [],
      });
      addRel(
        b,
        "PRODUCT_HAS_DOCUMENT",
        product.id,
        doc.id,
        slug,
        "fact",
        [ev.id],
      );
    }
  }

  for (const doc of (documents?.documents ?? []).slice(0, 200)) {
    const key = normalizeKey(doc.href);
    const ent = upsertEntity(b, {
      id: entityId("Document", key, { projectSlug: slug }),
      type: "Document",
      name: doc.title,
      normalizedKey: key,
      properties: {
        href: doc.href,
        fileType: doc.fileType,
        documentType: doc.documentType,
        status: doc.status,
      },
      epistemicClass: "fact",
      visibility: "project_private",
      sourceProjects: [slug],
      evidenceIds: [],
      reviewStatus: "unreviewed",
      conflictIds: [],
    });
    const ev = addEvidence(b, {
      projectSlug: slug,
      companyName: profile.companyName,
      sourceUrl: doc.sourcePageUrl,
      excerpt: `Document: ${doc.title}`,
      confidence: doc.confidence,
      method: "inventory_map",
      epistemicClass: "fact",
      entityIds: [ent.id],
    });
    ent.evidenceIds.push(ev.id);

    if (doc.documentType || doc.fileType) {
      const dtKey = normalizeKey(doc.documentType || doc.fileType);
      const dt = upsertEntity(b, {
        id: entityId("DocumentType", dtKey, { global: true }),
        type: "DocumentType",
        name: doc.documentType || doc.fileType,
        normalizedKey: dtKey,
        properties: {},
        epistemicClass: "fact",
        visibility: "shared_unreviewed",
        sourceProjects: [slug],
        evidenceIds: [ev.id],
        reviewStatus: "unreviewed",
        conflictIds: [],
      });
      // Link document → type via properties; relationship type reuse FINDING_SUPPORTED_BY_SOURCE avoided.
      // Store typed edge using PAGE_LINKS_TO_DOCUMENT inverse pattern via properties on document.
      ent.properties.documentTypeId = dt.id;
      dt.evidenceIds = [...new Set([...dt.evidenceIds, ev.id])];
    }

    const pageKey = normalizeKey(doc.sourcePageUrl);
    const page = upsertEntity(b, {
      id: entityId("Page", pageKey, { projectSlug: slug }),
      type: "Page",
      name: doc.sourcePageUrl,
      normalizedKey: pageKey,
      properties: { url: doc.sourcePageUrl },
      epistemicClass: "fact",
      visibility: "project_private",
      sourceProjects: [slug],
      evidenceIds: [ev.id],
      reviewStatus: "unreviewed",
      conflictIds: [],
    });
    addRel(
      b,
      "WEBSITE_CONTAINS_PAGE",
      website.id,
      page.id,
      slug,
      "fact",
      [ev.id],
    );
    addRel(
      b,
      "PAGE_LINKS_TO_DOCUMENT",
      page.id,
      ent.id,
      slug,
      "fact",
      [ev.id],
    );
  }

  // Technology from crawl
  const techSet = new Set<string>();
  for (const page of pages.slice(0, 75)) {
    for (const t of page.technologyIndicators) techSet.add(t);
    const pageKey = normalizeKey(page.url);
    const pageEnt = upsertEntity(b, {
      id: entityId("Page", pageKey, { projectSlug: slug }),
      type: "Page",
      name: page.title || page.url,
      normalizedKey: pageKey,
      properties: {
        url: page.url,
        h1: page.h1.slice(0, 3),
      },
      epistemicClass: "fact",
      visibility: "project_private",
      sourceProjects: [slug],
      evidenceIds: [],
      reviewStatus: "unreviewed",
      conflictIds: [],
    });
    const ev = addEvidence(b, {
      projectSlug: slug,
      companyName: profile.companyName,
      sourceUrl: page.url,
      sourcePageTitle: page.title,
      excerpt: page.mainTextSummary?.slice(0, 200) || page.title || page.url,
      confidence: "high",
      method: "crawl_extract",
      epistemicClass: "fact",
      entityIds: [pageEnt.id],
    });
    pageEnt.evidenceIds.push(ev.id);
    addRel(
      b,
      "WEBSITE_CONTAINS_PAGE",
      website.id,
      pageEnt.id,
      slug,
      "fact",
      [ev.id],
    );
  }
  for (const t of techSet) {
    const key = normalizeKey(t);
    const tech = upsertEntity(b, {
      id: entityId("Technology", key, { global: true }),
      type: "Technology",
      name: t,
      normalizedKey: key,
      properties: {},
      epistemicClass: "observation",
      visibility: "shared_unreviewed",
      sourceProjects: [slug],
      evidenceIds: [],
      reviewStatus: "unreviewed",
      conflictIds: [],
    });
    const ev = addEvidence(b, {
      projectSlug: slug,
      companyName: profile.companyName,
      sourceUrl: profile.websiteUrl,
      excerpt: `Technology indicator: ${t}`,
      confidence: "medium",
      method: "crawl_extract",
      epistemicClass: "observation",
      entityIds: [tech.id, website.id],
    });
    tech.evidenceIds.push(ev.id);
    addRel(
      b,
      "WEBSITE_USES_TECHNOLOGY",
      website.id,
      tech.id,
      slug,
      "observation",
      [ev.id],
    );
    if (/wordpress|cms/i.test(t)) {
      const cms = upsertEntity(b, {
        id: entityId("CMS", key, { projectSlug: slug }),
        type: "CMS",
        name: t,
        normalizedKey: key,
        properties: { technologyId: tech.id },
        epistemicClass: "observation",
        visibility: "project_private",
        sourceProjects: [slug],
        evidenceIds: [ev.id],
        reviewStatus: "unreviewed",
        conflictIds: [],
      });
      addRel(
        b,
        "WEBSITE_USES_TECHNOLOGY",
        website.id,
        cms.id,
        slug,
        "observation",
        [ev.id],
      );
    }
  }

  // Maturity → issues / opportunities (not facts)
  if (maturity) {
    for (const cat of maturity.categories) {
      if (cat.score > 5) continue;
      const issueType =
        cat.category === "Accessibility"
          ? "AccessibilityIssue"
          : cat.category === "SEO"
            ? "SeoIssue"
            : cat.category === "Performance"
              ? "PerformanceIssue"
              : cat.category === "Process efficiency" ||
                  cat.category === "Submittal workflow" ||
                  cat.category === "Calculators"
                ? "ProcessIssue"
                : "UxIssue";

      const obsKey = observationKey({
        category: cat.category,
        signal: cat.recommendation.slice(0, 80),
        polarity: `score-${cat.score}`,
      });
      const issue = upsertEntity(b, {
        id: entityId(issueType, obsKey, { projectSlug: slug }),
        type: issueType,
        name: `${cat.category}: score ${cat.score}/10`,
        normalizedKey: obsKey,
        properties: {
          category: cat.category,
          score: cat.score,
          evidence: cat.evidence,
          recommendation: cat.recommendation,
          /** Used for cross-project candidate pattern matching */
          observationKey: observationKey({
            category: normalizeKey(cat.category),
            signal: normalizeKey(cat.category),
            polarity: cat.score <= 3 ? "weak" : "moderate",
          }),
        },
        epistemicClass: "observation",
        visibility: "shared_unreviewed",
        sourceProjects: [slug],
        evidenceIds: [],
        reviewStatus: "unreviewed",
        conflictIds: [],
      });
      const ev = addEvidence(b, {
        projectSlug: slug,
        companyName: profile.companyName,
        sourceUrl: cat.sourceUrl || profile.websiteUrl,
        excerpt: cat.evidence,
        confidence: cat.confidence,
        method: "audit_map",
        epistemicClass: "observation",
        entityIds: [issue.id, company.id],
      });
      issue.evidenceIds.push(ev.id);

      if (issueType === "ProcessIssue") {
        addRel(
          b,
          "COMPANY_HAS_PROCESS_ISSUE",
          company.id,
          issue.id,
          slug,
          "observation",
          [ev.id],
        );
      } else if (issueType === "AccessibilityIssue") {
        addRel(
          b,
          "PAGE_EXHIBITS_ACCESSIBILITY_ISSUE",
          website.id,
          issue.id,
          slug,
          "observation",
          [ev.id],
        );
      } else if (issueType === "SeoIssue") {
        addRel(
          b,
          "PAGE_EXHIBITS_SEO_ISSUE",
          website.id,
          issue.id,
          slug,
          "observation",
          [ev.id],
        );
      } else if (issueType === "PerformanceIssue") {
        addRel(
          b,
          "WEBSITE_HAS_PERFORMANCE_ISSUE",
          website.id,
          issue.id,
          slug,
          "observation",
          [ev.id],
        );
      } else {
        addRel(
          b,
          "PAGE_EXHIBITS_UX_ISSUE",
          website.id,
          issue.id,
          slug,
          "observation",
          [ev.id],
        );
      }

      const oppKey = observationKey({
        category: "opportunity",
        signal: cat.prototypeResponse.slice(0, 80),
      });
      const opp = upsertEntity(b, {
        id: entityId("DigitalOpportunity", oppKey, { projectSlug: slug }),
        type: "DigitalOpportunity",
        name: cat.prototypeResponse.slice(0, 120),
        normalizedKey: oppKey,
        properties: {
          fromCategory: cat.category,
          observationKey: observationKey({
            category: "opportunity",
            signal: normalizeKey(cat.category),
          }),
        },
        epistemicClass: "recommendation",
        visibility: "project_private",
        sourceProjects: [slug],
        evidenceIds: [ev.id],
        reviewStatus: "unreviewed",
        conflictIds: [],
      });
      addRel(
        b,
        "COMPANY_HAS_DIGITAL_OPPORTUNITY",
        company.id,
        opp.id,
        slug,
        "recommendation",
        [ev.id],
      );
      if (issueType === "ProcessIssue") {
        addRel(
          b,
          "PROCESS_ISSUE_CREATES_OPPORTUNITY",
          issue.id,
          opp.id,
          slug,
          "inference",
          [ev.id],
        );
      }
    }
  }

  // Calculator conceptual entity from requirements if present
  const calcReq = readJsonFile<{
    calculators?: { id: string; name: string; classification: string; disclaimer: string }[];
  }>(projectPath(slug, "data/calculator-requirements.json"));
  for (const calc of calcReq?.calculators ?? []) {
    const key = normalizeKey(calc.id);
    const ent = upsertEntity(b, {
      id: entityId("Calculator", key, { projectSlug: slug }),
      type: "Calculator",
      name: calc.name,
      normalizedKey: key,
      properties: {
        classification: calc.classification,
        disclaimer: calc.disclaimer,
      },
      epistemicClass:
        calc.classification === "conceptual" ? "recommendation" : "observation",
      visibility: "project_private",
      sourceProjects: [slug],
      evidenceIds: [],
      reviewStatus: "unreviewed",
      conflictIds: [],
    });
    const ev = addEvidence(b, {
      projectSlug: slug,
      companyName: profile.companyName,
      sourceUrl: profile.websiteUrl,
      excerpt: `Calculator requirement: ${calc.name} (${calc.classification})`,
      confidence: "medium",
      method: "strategy_map",
      epistemicClass: ent.epistemicClass,
      entityIds: [ent.id],
    });
    ent.evidenceIds.push(ev.id);
    addRel(
      b,
      "COMPANY_PROVIDES_CALCULATOR",
      company.id,
      ent.id,
      slug,
      ent.epistemicClass,
      [ev.id],
    );
  }

  // Navigation pattern observation (department IA)
  const navPatternKey = observationKey({
    category: "navigation",
    signal: "products-tools-tables-documents",
  });
  const nav = upsertEntity(b, {
    id: entityId("NavigationPattern", navPatternKey, { projectSlug: slug }),
    type: "NavigationPattern",
    name: "Products / Tools / Tables / Documents IA",
    normalizedKey: navPatternKey,
    properties: {
      observationKey: observationKey({
        category: "navigation-pattern",
        signal: "dept-ia-products-tools-tables-documents",
      }),
    },
    epistemicClass: "observation",
    visibility: "shared_unreviewed",
    sourceProjects: [slug],
    evidenceIds: [],
    reviewStatus: "unreviewed",
    conflictIds: [],
  });
  const navEv = addEvidence(b, {
    projectSlug: slug,
    companyName: profile.companyName,
    sourceUrl: profile.websiteUrl,
    excerpt:
      "Navigation themes Products/Tools/Tables/Documents observed in public IA",
    confidence: "medium",
    method: "audit_map",
    epistemicClass: "observation",
    entityIds: [nav.id, company.id],
  });
  nav.evidenceIds.push(navEv.id);
  addRel(
    b,
    "COMPANY_EXHIBITS_NAVIGATION_PATTERN",
    company.id,
    nav.id,
    slug,
    "observation",
    [navEv.id],
  );

  const hashes: Record<string, string> = {};
  for (const rel of [
    "data/company-profile.json",
    "data/product-inventory.json",
    "data/document-inventory.json",
    "analysis/digital-maturity.json",
    "source/pages.json",
  ]) {
    const h = hashArtifact(slug, rel);
    if (h) hashes[rel] = h;
  }

  return {
    schemaVersion: KNOWLEDGE_SCHEMA_VERSION,
    projectSlug: slug,
    companyName: profile.companyName,
    industry: profile.industry,
    extractedAt: now(),
    sourceArtifactHashes: hashes,
    entities: [...b.entities.values()],
    relationships: [...b.relationships.values()],
    evidence: [...b.evidence.values()],
    conflicts: [...b.conflicts.values()],
  };
}
