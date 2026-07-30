import fs from "node:fs";
import { extractProjectKnowledge } from "@/lib/knowledge/extract";
import {
  buildIndex,
  markProjectEvidenceStale,
  mergeSliceIntoStore,
  refreshCandidatePatterns,
} from "@/lib/knowledge/merge";
import {
  ensureKnowledgeSkeleton,
  ensureProjectKnowledgeDir,
  projectKnowledgeDir,
  writeJson,
} from "@/lib/knowledge/paths";
import { loadStore, persistStore, rebuildStoreFromScratch } from "@/lib/knowledge/store";
import { ProjectKnowledgeSliceSchema } from "@/lib/schemas/knowledge";
import { fileExists, projectPath } from "@/lib/project";
import { writeProjectStatus } from "@/lib/status";
import { appendFileSync, readFileSync, existsSync } from "node:fs";

export type IngestOptions = {
  slug: string;
  dryRun?: boolean;
  rebuild?: boolean;
  force?: boolean;
};

export type IngestResult = {
  dryRun: boolean;
  projectSlug: string;
  skipped: boolean;
  skipReason?: string;
  entityCount: number;
  relationshipCount: number;
  evidenceCount: number;
  conflictCount: number;
  candidatePatternsCreated: number;
  candidatePatternsBlocked: number;
  staleMarked: number;
  slicePath?: string;
};

function priorHashes(slug: string): Record<string, string> | null {
  const manifest = `${projectKnowledgeDir(slug)}/extract-manifest.json`;
  if (!existsSync(manifest)) return null;
  const raw = JSON.parse(readFileSync(manifest, "utf8")) as {
    sourceArtifactHashes?: Record<string, string>;
  };
  return raw.sourceArtifactHashes ?? null;
}

function hashesEqual(
  a: Record<string, string>,
  b: Record<string, string>,
): boolean {
  const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
  for (const k of keys) {
    if (a[k] !== b[k]) return false;
  }
  return true;
}

export function ingestProjectKnowledge(opts: IngestOptions): IngestResult {
  const { slug, dryRun = false, rebuild = false, force = false } = opts;

  if (!fileExists(slug, "data/company-profile.json")) {
    throw new Error(
      `Cannot ingest knowledge for ${slug}: missing Gate 1 inventories (data/company-profile.json)`,
    );
  }

  ensureKnowledgeSkeleton();
  ensureProjectKnowledgeDir(slug);

  if (rebuild && !dryRun) {
    rebuildStoreFromScratch();
  }

  const slice = extractProjectKnowledge(slug);
  const parsed = ProjectKnowledgeSliceSchema.parse(slice);

  const prev = priorHashes(slug);
  if (
    !force &&
    !rebuild &&
    prev &&
    hashesEqual(prev, parsed.sourceArtifactHashes)
  ) {
    return {
      dryRun,
      projectSlug: slug,
      skipped: true,
      skipReason: "Idempotent skip — source artifact hashes unchanged",
      entityCount: parsed.entities.length,
      relationshipCount: parsed.relationships.length,
      evidenceCount: parsed.evidence.length,
      conflictCount: parsed.conflicts.length,
      candidatePatternsCreated: 0,
      candidatePatternsBlocked: 0,
      staleMarked: 0,
    };
  }

  if (dryRun) {
    return {
      dryRun: true,
      projectSlug: slug,
      skipped: false,
      entityCount: parsed.entities.length,
      relationshipCount: parsed.relationships.length,
      evidenceCount: parsed.evidence.length,
      conflictCount: parsed.conflicts.length,
      candidatePatternsCreated: 0,
      candidatePatternsBlocked: 0,
      staleMarked: 0,
      slicePath: `${projectKnowledgeDir(slug)}/ (dry-run, not written)`,
    };
  }

  // Write project slice (source-project isolation)
  const dir = projectKnowledgeDir(slug);
  writeJson(`${dir}/entities.json`, parsed.entities);
  writeJson(`${dir}/relationships.json`, parsed.relationships);
  writeJson(`${dir}/evidence.json`, parsed.evidence);
  writeJson(`${dir}/conflicts.json`, parsed.conflicts);
  writeJson(`${dir}/extract-manifest.json`, {
    schemaVersion: parsed.schemaVersion,
    projectSlug: slug,
    extractedAt: parsed.extractedAt,
    sourceArtifactHashes: parsed.sourceArtifactHashes,
    counts: {
      entities: parsed.entities.length,
      relationships: parsed.relationships.length,
      evidence: parsed.evidence.length,
      conflicts: parsed.conflicts.length,
    },
  });

  const store = loadStore();
  if (force || rebuild) {
    // Replace this project's prior contribution (keeps other projects intact)
    for (const [id, ent] of [...store.entities.entries()]) {
      const onlyThis =
        ent.sourceProjects.length === 1 && ent.sourceProjects[0] === slug;
      if (onlyThis) store.entities.delete(id);
      else if (ent.sourceProjects.includes(slug)) {
        ent.sourceProjects = ent.sourceProjects.filter((p) => p !== slug);
        ent.updatedAt = new Date().toISOString();
      }
    }
    for (const [id, rel] of [...store.relationships.entries()]) {
      const onlyThis =
        rel.sourceProjects.length === 1 && rel.sourceProjects[0] === slug;
      if (onlyThis) store.relationships.delete(id);
    }
    for (const [id, ev] of [...store.evidence.entries()]) {
      if (ev.provenance.sourceProject === slug) store.evidence.delete(id);
    }
    for (const [id, c] of [...store.conflicts.entries()]) {
      const onlyThis =
        c.sourceProjects.length === 1 && c.sourceProjects[0] === slug;
      if (onlyThis) store.conflicts.delete(id);
    }
  }
  const mergeStats = mergeSliceIntoStore(store, parsed);
  const staleMarked = markProjectEvidenceStale(
    store,
    slug,
    new Set(parsed.evidence.map((e) => e.id)),
  );
  const patternStats = refreshCandidatePatterns(store);
  const index = buildIndex(store);
  persistStore(store, index);

  store.audit.push({
    id: `audit_ingest_${slug}_${Date.now()}`,
    at: new Date().toISOString(),
    action: rebuild ? "rebuilt" : "ingested",
    actor: "system",
    projectSlug: slug,
    reason: "Ingested project knowledge slice",
    details: { ...mergeStats, staleMarked, ...patternStats },
  });
  // Persist audit after append
  persistStore(store, index);

  writeJson(`${dir}/extract-manifest.json`, {
    schemaVersion: parsed.schemaVersion,
    projectSlug: slug,
    extractedAt: parsed.extractedAt,
    sourceArtifactHashes: parsed.sourceArtifactHashes,
    counts: {
      entities: parsed.entities.length,
      relationships: parsed.relationships.length,
      evidence: parsed.evidence.length,
      conflicts: parsed.conflicts.length,
    },
    mergedAt: new Date().toISOString(),
  });

  // Update project status (append note)
  const statusPath = projectPath(slug, "project-status.md");
  const note = `

### Session note — Forge Knowledge
- Ingested knowledge slice at ${parsed.extractedAt}
- entities=${parsed.entities.length} relationships=${parsed.relationships.length} evidence=${parsed.evidence.length}
- candidatePatternsCreated=${patternStats.created} blocked=${patternStats.blocked}
- Artifacts: projects/${slug}/knowledge/* + knowledge/ shared store
`;
  if (fs.existsSync(statusPath)) {
    appendFileSync(statusPath, note, "utf8");
  } else {
    writeProjectStatus(slug, {
      currentPhase: "knowledge_ingested",
      completedArtifacts: [`knowledge/extract-manifest.json`],
      blockers: [],
      openQuestions: [],
      qaFailures: [],
      requiredRevisions: [],
      approvedGates: [],
    });
  }

  return {
    dryRun: false,
    projectSlug: slug,
    skipped: false,
    entityCount: parsed.entities.length,
    relationshipCount: parsed.relationships.length,
    evidenceCount: parsed.evidence.length,
    conflictCount: parsed.conflicts.length + mergeStats.conflictsCreated,
    candidatePatternsCreated: patternStats.created,
    candidatePatternsBlocked: patternStats.blocked,
    staleMarked,
    slicePath: dir,
  };
}
