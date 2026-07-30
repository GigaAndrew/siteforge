#!/usr/bin/env tsx
import { queryKnowledge } from "@/lib/knowledge/query";

function hasFlag(flag: string): boolean {
  return process.argv.includes(flag);
}

function arg(flag: string): string | undefined {
  const idx = process.argv.indexOf(flag);
  if (idx === -1) return undefined;
  return process.argv[idx + 1];
}

async function main() {
  const result = queryKnowledge({
    company: arg("--company"),
    industry: arg("--industry"),
    entityType: arg("--entity-type"),
    relationshipType: arg("--relationship-type"),
    evidenceStatus: arg("--evidence-status"),
    project: arg("--project"),
    candidatePatterns: hasFlag("--candidate-patterns"),
    limit: arg("--limit") ? Number(arg("--limit")) : 50,
  });

  console.log(
    JSON.stringify(
      {
        meta: result.meta,
        counts: {
          entities: result.entities.length,
          relationships: result.relationships.length,
          evidence: result.evidence.length,
          candidatePatterns: result.candidatePatterns.length,
        },
        entities: result.entities.map((e) => ({
          id: e.id,
          type: e.type,
          name: e.name,
          epistemicClass: e.epistemicClass,
          visibility: e.visibility,
          sourceProjects: e.sourceProjects,
          reviewStatus: e.reviewStatus,
        })),
        relationships: result.relationships.map((r) => ({
          id: r.id,
          type: r.type,
          fromId: r.fromId,
          toId: r.toId,
          epistemicClass: r.epistemicClass,
        })),
        evidence: result.evidence.map((e) => ({
          id: e.id,
          confidence: e.provenance.confidence,
          epistemicClass: e.provenance.epistemicClass,
          reviewStatus: e.provenance.reviewStatus,
          stale: e.stale,
          sourceUrl: e.provenance.sourceUrl,
          excerpt: e.provenance.evidenceExcerpt,
        })),
        candidatePatterns: result.candidatePatterns.map((p) => ({
          id: p.id,
          name: p.name,
          status: p.status,
          label: p.label,
          supportingProjectSlugs: p.supportingProjectSlugs,
          blockedByConflicts: p.blockedByConflicts,
          reviewStatus: p.reviewStatus,
          normalizationLogic: p.normalizationLogic,
        })),
      },
      null,
      2,
    ),
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
