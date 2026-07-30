import fs from "node:fs";
import path from "node:path";
import { listProjectSlugs, projectPath } from "@/lib/project";
import { normalizeKey } from "@/lib/knowledge/ids";
import { knowledgePath } from "@/lib/knowledge/paths";
import { loadStore, type KnowledgeStoreState } from "@/lib/knowledge/store";
import {
  KnowledgeEntitySchema,
  KnowledgeRelationshipSchema,
  EvidenceRecordSchema,
  KNOWLEDGE_SCHEMA_VERSION,
  type KnowledgeEntity,
  type EvidenceRecord,
} from "@/lib/schemas/knowledge";

export type IssueSeverity = "critical" | "high" | "medium" | "low" | "info";

export type IntegrityIssue = {
  id: string;
  severity: IssueSeverity;
  category: string;
  message: string;
  entityIds?: string[];
  evidenceIds?: string[];
  relationshipIds?: string[];
  recommendedCorrection: string;
};

export type KnowledgeInspection = {
  generatedAt: string;
  schemaVersion: string;
  projectSlug?: string;
  totals: {
    entities: number;
    relationships: number;
    evidence: number;
    conflicts: number;
    candidatePatterns: number;
    staleEvidence: number;
  };
  entitiesByType: Record<string, number>;
  relationshipsByType: Record<string, number>;
  evidenceByConfidence: Record<string, number>;
  evidenceByReviewStatus: Record<string, number>;
  evidenceBySourcePage: Record<string, number>;
  visibility: Record<string, number>;
  epistemicClass: Record<string, number>;
  issues: IntegrityIssue[];
  exportPaths: string[];
  criticalCount: number;
  highCount: number;
};

const FACT_EXEMPT_TYPES = new Set([
  "Industry", // global hub may accumulate evidence across projects
]);

function countBy<T>(items: T[], keyFn: (item: T) => string): Record<string, number> {
  const out: Record<string, number> = {};
  for (const item of items) {
    const k = keyFn(item);
    out[k] = (out[k] ?? 0) + 1;
  }
  return out;
}

function isValidUrl(value: string | undefined): boolean {
  if (!value) return true;
  try {
    const u = new URL(value);
    return u.protocol === "http:" || u.protocol === "https:";
  } catch {
    return false;
  }
}

function nearDuplicateKey(ent: KnowledgeEntity): string {
  return `${ent.type}:${normalizeKey(ent.name).slice(0, 80)}`;
}

export function inspectKnowledge(opts: {
  slug?: string;
  store?: KnowledgeStoreState;
}): KnowledgeInspection {
  const store = opts.store ?? loadStore();
  const slug = opts.slug;
  const issues: IntegrityIssue[] = [];
  const projectSlugs = new Set(listProjectSlugs());

  let entities = [...store.entities.values()];
  let relationships = [...store.relationships.values()];
  let evidence = [...store.evidence.values()];

  if (slug) {
    entities = entities.filter((e) => e.sourceProjects.includes(slug));
    relationships = relationships.filter((r) => r.sourceProjects.includes(slug));
    evidence = evidence.filter((e) => e.provenance.sourceProject === slug);
  }

  const entityIds = new Set(entities.map((e) => e.id));
  // For endpoint checks when filtering by project, use full store endpoints
  // so shared Industry/Technology targets still resolve.
  const allEntityIds = new Set(store.entities.keys());

  // Schema validation
  for (const ent of entities) {
    const parsed = KnowledgeEntitySchema.safeParse(ent);
    if (!parsed.success) {
      issues.push({
        id: `schema-entity-${ent.id}`,
        severity: "critical",
        category: "schema_validation",
        message: `Entity ${ent.id} failed schema validation: ${parsed.error.message}`,
        entityIds: [ent.id],
        recommendedCorrection: "Re-extract project knowledge or fix schema mismatch.",
      });
    }
  }
  for (const rel of relationships) {
    const parsed = KnowledgeRelationshipSchema.safeParse(rel);
    if (!parsed.success) {
      issues.push({
        id: `schema-rel-${rel.id}`,
        severity: "critical",
        category: "schema_validation",
        message: `Relationship ${rel.id} failed schema validation`,
        relationshipIds: [rel.id],
        recommendedCorrection: "Re-ingest after fixing relationship shape.",
      });
    }
  }
  for (const ev of evidence) {
    const parsed = EvidenceRecordSchema.safeParse(ev);
    if (!parsed.success) {
      issues.push({
        id: `schema-ev-${ev.id}`,
        severity: "critical",
        category: "schema_validation",
        message: `Evidence ${ev.id} failed schema validation`,
        evidenceIds: [ev.id],
        recommendedCorrection: "Re-ingest evidence records.",
      });
    }
  }

  // Missing relationship endpoints
  for (const rel of relationships) {
    if (!allEntityIds.has(rel.fromId) || !allEntityIds.has(rel.toId)) {
      issues.push({
        id: `orphan-rel-${rel.id}`,
        severity: "critical",
        category: "missing_endpoints",
        message: `Relationship ${rel.type} missing endpoint(s)`,
        relationshipIds: [rel.id],
        entityIds: [rel.fromId, rel.toId].filter((id) => !allEntityIds.has(id)),
        recommendedCorrection: "Force re-ingest source project or delete orphan relationship.",
      });
    }
  }

  // Orphan entities: no relationships and not Company/Industry hubs when scoped
  for (const ent of entities) {
    const linked = relationships.some(
      (r) => r.fromId === ent.id || r.toId === ent.id,
    );
    // Also check full-store relationships for global entities
    const linkedGlobal = [...store.relationships.values()].some(
      (r) => r.fromId === ent.id || r.toId === ent.id,
    );
    if (!linked && !linkedGlobal) {
      issues.push({
        id: `orphan-ent-${ent.id}`,
        severity: "medium",
        category: "orphan_entities",
        message: `Entity ${ent.type} "${ent.name}" has no relationships`,
        entityIds: [ent.id],
        recommendedCorrection: "Attach via extract rules or remove unused entity.",
      });
    }
  }

  // Orphan evidence: no related entities that exist
  for (const ev of evidence) {
    const points = ev.relatedEntityIds.filter((id: string) =>
      allEntityIds.has(id),
    );
    if (ev.relatedEntityIds.length === 0 || points.length === 0) {
      issues.push({
        id: `orphan-ev-${ev.id}`,
        severity: "high",
        category: "orphan_evidence",
        message: `Evidence ${ev.id} has no resolvable related entities`,
        evidenceIds: [ev.id],
        recommendedCorrection: "Link evidence to entity IDs during extract.",
      });
    }
    if (!projectSlugs.has(ev.provenance.sourceProject) && !slug) {
      issues.push({
        id: `ev-project-${ev.id}`,
        severity: "high",
        category: "unsupported_project",
        message: `Evidence sourceProject "${ev.provenance.sourceProject}" not in projects/`,
        evidenceIds: [ev.id],
        recommendedCorrection: "Restore project folder or remove stale evidence.",
      });
    }
    if (!isValidUrl(ev.provenance.sourceUrl)) {
      issues.push({
        id: `ev-url-${ev.id}`,
        severity: "high",
        category: "invalid_source_url",
        message: `Evidence has invalid sourceUrl: ${ev.provenance.sourceUrl}`,
        evidenceIds: [ev.id],
        recommendedCorrection: "Normalize URLs at extract time; drop non-http(s).",
      });
    }
  }

  // Facts without evidence
  for (const ent of entities) {
    if (ent.epistemicClass !== "fact") continue;
    if (FACT_EXEMPT_TYPES.has(ent.type)) continue;
    if (!ent.evidenceIds.length) {
      issues.push({
        id: `fact-no-ev-${ent.id}`,
        severity: "critical",
        category: "unsupported_facts",
        message: `Fact entity ${ent.type} "${ent.name}" has no evidence`,
        entityIds: [ent.id],
        recommendedCorrection: "Attach evidence or downgrade epistemic class.",
      });
    }
  }

  // Misclassified recommendations / inferences as facts
  for (const ent of entities) {
    if (ent.epistemicClass === "fact") {
      const props = ent.properties ?? {};
      if (
        ent.type === "Calculator" &&
        props.classification === "conceptual"
      ) {
        issues.push({
          id: `misc-calc-${ent.id}`,
          severity: "critical",
          category: "misclassification",
          message: `Conceptual calculator stored as fact: ${ent.name}`,
          entityIds: [ent.id],
          recommendedCorrection: "Classify conceptual calculators as recommendation.",
        });
      }
      if (
        typeof ent.name === "string" &&
        /recommend|should |prototype response/i.test(ent.name) &&
        ent.type === "DigitalOpportunity"
      ) {
        issues.push({
          id: `misc-opp-fact-${ent.id}`,
          severity: "critical",
          category: "misclassification",
          message: `Digital opportunity appears stored as fact`,
          entityIds: [ent.id],
          recommendedCorrection: "Keep DigitalOpportunity as recommendation.",
        });
      }
    }
  }

  // Evidence epistemic mismatch: recommendation evidence claiming fact on entity
  for (const ent of entities) {
    if (ent.epistemicClass !== "recommendation") continue;
    // OK — but ensure not also labeled fact in properties
    if (ent.properties?.observedFact === true) {
      issues.push({
        id: `rec-as-fact-${ent.id}`,
        severity: "critical",
        category: "misclassification",
        message: `Recommendation entity marked observedFact=true`,
        entityIds: [ent.id],
        recommendedCorrection: "Remove observedFact flag from recommendations.",
      });
    }
  }

  // Near-duplicates
  const dupBuckets = new Map<string, KnowledgeEntity[]>();
  for (const ent of entities) {
    const k = nearDuplicateKey(ent);
    const list = dupBuckets.get(k) ?? [];
    list.push(ent);
    dupBuckets.set(k, list);
  }
  for (const [key, list] of dupBuckets) {
    if (list.length < 2) continue;
    // Same normalized name+type but different ids
    const ids = [...new Set(list.map((e) => e.id))];
    if (ids.length < 2) continue;
    issues.push({
      id: `near-dup-${normalizeKey(key).slice(0, 40)}`,
      severity: "medium",
      category: "near_duplicates",
      message: `Near-duplicate entities for ${key} (${ids.length} ids)`,
      entityIds: ids,
      recommendedCorrection:
        "Tighten normalization keys / merge on ingest for cross-page duplicates.",
    });
  }

  // Low confidence evidence (informational listing as issues medium)
  const lowConf = evidence.filter((e) => e.provenance.confidence === "low");
  if (lowConf.length) {
    issues.push({
      id: "low-confidence-summary",
      severity: "low",
      category: "low_confidence",
      message: `${lowConf.length} evidence records have low confidence`,
      evidenceIds: lowConf.slice(0, 20).map((e) => e.id),
      recommendedCorrection: "Manual review before using in pitch claims.",
    });
  }

  const stale = evidence.filter((e) => e.stale);
  if (stale.length) {
    issues.push({
      id: "stale-evidence-summary",
      severity: "medium",
      category: "stale_evidence",
      message: `${stale.length} stale evidence records`,
      evidenceIds: stale.slice(0, 20).map((e) => e.id),
      recommendedCorrection: "Re-verify sources or drop stale evidence from exports.",
    });
  }

  // Redirect / failed URL hints from crawl-errors if project scoped
  if (slug) {
    const errPath = projectPath(slug, "source/crawl-errors.json");
    if (fs.existsSync(errPath)) {
      const errors = JSON.parse(fs.readFileSync(errPath, "utf8")) as {
        url?: string;
        error?: string;
      }[];
      const downloadFails = errors.filter((e) =>
        /download is starting|net::|timeout|404/i.test(e.error ?? ""),
      );
      if (downloadFails.length) {
        issues.push({
          id: "crawl-url-failures",
          severity: "medium",
          category: "source_url_failures",
          message: `${downloadFails.length} crawl URL failures/redirects/downloads recorded`,
          recommendedCorrection:
            "Treat failed URLs as incomplete evidence; do not elevate related facts to high confidence.",
        });
      }
    }

    // Extraction warning: binary garbage in company summary
    const profilePath = projectPath(slug, "data/company-profile.json");
    if (fs.existsSync(profilePath)) {
      const profile = JSON.parse(fs.readFileSync(profilePath, "utf8")) as {
        summary?: string;
      };
      if (profile.summary && /[\u0000-\u0008\u000e-\u001f]/.test(profile.summary)) {
        issues.push({
          id: "extract-binary-summary",
          severity: "high",
          category: "extraction_warning",
          message:
            "Company profile summary contains binary/control characters (likely compressed HTML mis-decoded).",
          recommendedCorrection:
            "Fix crawler text extraction / encoding; regenerate company-profile.json; re-ingest knowledge.",
        });
      }
      if (profile.summary && profile.summary.length > 50) {
        const printable = profile.summary.replace(/[^\x20-\x7E\n]/g, "").length;
        if (printable / profile.summary.length < 0.5) {
          issues.push({
            id: "extract-summary-unreadable",
            severity: "high",
            category: "extraction_warning",
            message: "Company summary appears mostly non-printable — weak traceability narrative.",
            recommendedCorrection: "Re-crawl homepage with proper decoding before pitch use.",
          });
        }
      }
    }
  }

  // Candidate pattern single-company check (should be zero for one company)
  for (const p of store.candidatePatterns.values()) {
    if (slug && !p.supportingProjectSlugs.includes(slug)) continue;
    if (p.supportingCompanyIds.length < 2) {
      issues.push({
        id: `cpat-single-${p.id}`,
        severity: "critical",
        category: "candidate_pattern_rule",
        message: `Candidate pattern ${p.id} has fewer than 2 supporting companies`,
        recommendedCorrection: "Delete invalid candidate; reinforce independence rules.",
      });
    }
  }

  const exportDir = knowledgePath("exports");
  const exportPaths = fs.existsSync(exportDir)
    ? fs
        .readdirSync(exportDir)
        .filter((f) => f.endsWith(".json") || f.endsWith(".jsonl"))
        .map((f) => path.join("knowledge/exports", f))
        .sort()
    : [];

  const criticalCount = issues.filter((i) => i.severity === "critical").length;
  const highCount = issues.filter((i) => i.severity === "high").length;

  return {
    generatedAt: new Date().toISOString(),
    schemaVersion: KNOWLEDGE_SCHEMA_VERSION,
    projectSlug: slug,
    totals: {
      entities: entities.length,
      relationships: relationships.length,
      evidence: evidence.length,
      conflicts: slug
        ? [...store.conflicts.values()].filter((c) =>
            c.sourceProjects.includes(slug),
          ).length
        : store.conflicts.size,
      candidatePatterns: slug
        ? [...store.candidatePatterns.values()].filter((p) =>
            p.supportingProjectSlugs.includes(slug),
          ).length
        : store.candidatePatterns.size,
      staleEvidence: evidence.filter((e) => e.stale).length,
    },
    entitiesByType: countBy(entities, (e) => e.type),
    relationshipsByType: countBy(relationships, (r) => r.type),
    evidenceByConfidence: countBy(evidence, (e) => e.provenance.confidence),
    evidenceByReviewStatus: countBy(
      evidence,
      (e) => e.provenance.reviewStatus,
    ),
    evidenceBySourcePage: countBy(
      evidence,
      (e) => e.provenance.sourceUrl ?? "(no-url)",
    ),
    visibility: countBy(entities, (e) => e.visibility),
    epistemicClass: countBy(entities, (e) => e.epistemicClass),
    issues,
    exportPaths,
    criticalCount,
    highCount,
  };
}

export function renderQualityReportMarkdown(insp: KnowledgeInspection): string {
  const topPages = Object.entries(insp.evidenceBySourcePage)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 25);

  const issueLines = insp.issues.length
    ? insp.issues
        .map(
          (i) =>
            `### ${i.id}\n- **Severity:** ${i.severity}\n- **Category:** ${i.category}\n- **Problem:** ${i.message}\n- **Recommended correction:** ${i.recommendedCorrection}\n` +
            (i.entityIds?.length
              ? `- **Entities:** ${i.entityIds.slice(0, 10).join(", ")}\n`
              : "") +
            (i.evidenceIds?.length
              ? `- **Evidence:** ${i.evidenceIds.slice(0, 10).join(", ")}\n`
              : ""),
        )
        .join("\n")
    : "_No integrity issues detected._\n";

  return `# Knowledge quality report${insp.projectSlug ? ` — ${insp.projectSlug}` : ""}

Generated: ${insp.generatedAt}  
Schema version: ${insp.schemaVersion}

## Totals

| Metric | Count |
|---|---|
| Entities | ${insp.totals.entities} |
| Relationships | ${insp.totals.relationships} |
| Evidence | ${insp.totals.evidence} |
| Conflicts | ${insp.totals.conflicts} |
| Candidate patterns | ${insp.totals.candidatePatterns} |
| Stale evidence | ${insp.totals.staleEvidence} |
| Critical issues | ${insp.criticalCount} |
| High issues | ${insp.highCount} |

## Entities by type

| Type | Count |
|---|---|
${Object.entries(insp.entitiesByType)
  .sort((a, b) => b[1] - a[1])
  .map(([k, v]) => `| ${k} | ${v} |`)
  .join("\n")}

## Relationships by type

| Type | Count |
|---|---|
${Object.entries(insp.relationshipsByType)
  .sort((a, b) => b[1] - a[1])
  .map(([k, v]) => `| ${k} | ${v} |`)
  .join("\n")}

## Evidence by confidence

| Confidence | Count |
|---|---|
${Object.entries(insp.evidenceByConfidence)
  .map(([k, v]) => `| ${k} | ${v} |`)
  .join("\n")}

## Evidence by review status

| Status | Count |
|---|---|
${Object.entries(insp.evidenceByReviewStatus)
  .map(([k, v]) => `| ${k} | ${v} |`)
  .join("\n")}

## Visibility classifications

| Visibility | Count |
|---|---|
${Object.entries(insp.visibility)
  .map(([k, v]) => `| ${k} | ${v} |`)
  .join("\n")}

## Epistemic classes

| Class | Count |
|---|---|
${Object.entries(insp.epistemicClass)
  .map(([k, v]) => `| ${k} | ${v} |`)
  .join("\n")}

## Evidence by source page (top 25)

| Source URL | Evidence count |
|---|---|
${topPages.map(([k, v]) => `| ${k} | ${v} |`).join("\n")}

## Issues

${issueLines}

## Export paths

${insp.exportPaths.map((p) => `- \`${p}\``).join("\n") || "_None_"}

## Readiness notes

- Candidate patterns are expected to be **0** until a second independent company is ingested.
- All factual entities should retain evidence IDs before pitch use.
- Re-run \`npm run knowledge:inspect -- --slug ${insp.projectSlug ?? "<slug>"} --strict\` after corrections.
`;
}

export function getEvidenceForEntity(
  store: KnowledgeStoreState,
  entityId: string,
): EvidenceRecord[] {
  const ent = store.entities.get(entityId);
  if (!ent) return [];
  return ent.evidenceIds
    .map((id: string) => store.evidence.get(id))
    .filter((e: EvidenceRecord | undefined): e is EvidenceRecord => Boolean(e));
}
