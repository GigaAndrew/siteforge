import fs from "node:fs";
import { normalizeKey, stableHash } from "@/lib/knowledge/ids";
import { loadStore } from "@/lib/knowledge/store";
import { writeJson } from "@/lib/knowledge/paths";
import type { KnowledgeEntity } from "@/lib/schemas/knowledge";
import {
  AliasMappingSchema,
  DEFAULT_MAPPING_THRESHOLD,
  ProjectNormalizationStatusSchema,
  type AliasMapping,
  type ProjectNormalizationStatus,
} from "@/lib/normalization/schemas";
import {
  ensureConceptRegistry,
  loadConcepts,
  rebuildAliasIndex,
} from "@/lib/normalization/registry";
import {
  pickBestMapping,
  scoreEntityMappings,
  SKIP_TYPES,
} from "@/lib/normalization/match";
import {
  ensureProjectNormalizationDir,
  normalizationPath,
  projectNormalizationDir,
} from "@/lib/normalization/paths";
import { readProjectConfig } from "@/lib/project";

export type NormalizeOptions = {
  slug: string;
  dryRun?: boolean;
  rebuild?: boolean;
  threshold?: number;
};

export type NormalizeResult = {
  slug: string;
  dryRun: boolean;
  rebuild: boolean;
  status: ProjectNormalizationStatus;
  mappings: AliasMapping[];
  reviewQueue: AliasMapping[];
};

function mappingId(
  projectSlug: string,
  entityId: string,
  conceptId: string | null,
): string {
  return `nmap_${stableHash([projectSlug, entityId, conceptId ?? "unmapped"])}`;
}

function companyNameForSlug(slug: string): string {
  try {
    return readProjectConfig(slug).name;
  } catch {
    return slug;
  }
}

function projectEntities(slug: string): KnowledgeEntity[] {
  const store = loadStore();
  return [...store.entities.values()].filter((e) =>
    e.sourceProjects.includes(slug),
  );
}

function loadExistingMappings(slug: string): AliasMapping[] {
  const path = `${projectNormalizationDir(slug)}/mappings.json`;
  if (!fs.existsSync(path)) return [];
  const raw = JSON.parse(fs.readFileSync(path, "utf8")) as unknown[];
  return raw
    .map((m) => AliasMappingSchema.safeParse(m))
    .filter((r) => r.success)
    .map((r) => r.data);
}

function persistProjectMappings(slug: string, mappings: AliasMapping[]): void {
  ensureProjectNormalizationDir(slug);
  writeJson(`${projectNormalizationDir(slug)}/mappings.json`, mappings);
}

function persistGlobalProjectIndex(
  slug: string,
  mappings: AliasMapping[],
  status: ProjectNormalizationStatus,
): void {
  writeJson(normalizationPath("mappings", `${slug}.json`), mappings);
  writeJson(normalizationPath("indexes", `status-${slug}.json`), status);
}

function buildStatus(
  slug: string,
  mappings: AliasMapping[],
  entityCount: number,
  dryRun: boolean,
): ProjectNormalizationStatus {
  const mapped = mappings.filter((m) => m.canonicalConceptId && !m.belowThreshold);
  const ambiguous = mappings.filter((m) => m.reviewStatus === "ambiguous");
  const below = mappings.filter((m) => m.belowThreshold);
  const unmapped = mappings.filter(
    (m) => !m.canonicalConceptId || m.belowThreshold || m.reviewStatus === "ambiguous",
  );
  const avg =
    mapped.length === 0
      ? 0
      : mapped.reduce((s, m) => s + m.mappingConfidence, 0) / mapped.length;
  const conceptCoverage: Record<string, number> = {};
  for (const m of mapped) {
    if (!m.canonicalConceptId) continue;
    conceptCoverage[m.canonicalConceptId] =
      (conceptCoverage[m.canonicalConceptId] ?? 0) + 1;
  }
  return ProjectNormalizationStatusSchema.parse({
    schemaVersion: "1.0.0",
    projectSlug: slug,
    generatedAt: new Date().toISOString(),
    entityCount,
    mappedCount: mapped.length,
    unmappedCount: unmapped.length,
    ambiguousCount: ambiguous.length,
    belowThresholdCount: below.length,
    averageConfidence: Number(avg.toFixed(4)),
    conceptCoverage,
    dryRun,
  });
}

/**
 * Normalize company-level entities to canonical industry concepts.
 * Idempotent: deterministic mapping IDs; rebuild replaces project mappings.
 */
export function normalizeProject(opts: NormalizeOptions): NormalizeResult {
  const {
    slug,
    dryRun = false,
    rebuild = false,
    threshold = DEFAULT_MAPPING_THRESHOLD,
  } = opts;

  ensureConceptRegistry();
  const concepts = loadConcepts();
  const aliasIndex = rebuildAliasIndex(concepts);
  const entities = projectEntities(slug);
  const company = companyNameForSlug(slug);
  const ts = new Date().toISOString();

  const prior = rebuild ? [] : loadExistingMappings(slug);
  const priorByEntity = new Map(
    prior.filter((m) => m.reviewStatus === "confirmed" || m.reviewStatus === "rejected").map((m) => [m.sourceEntityId ?? "", m]),
  );

  const mappings: AliasMapping[] = [];

  for (const ent of entities) {
    if (SKIP_TYPES.has(ent.type)) continue;

    const manual = priorByEntity.get(ent.id);
    if (manual && !rebuild) {
      // Preserve human decisions across non-rebuild runs
      mappings.push({
        ...manual,
        updatedAt: ts,
        originalLabel: ent.name,
        lexicalKey: normalizeKey(ent.name),
      });
      continue;
    }
    if (manual?.reviewStatus === "rejected" && !rebuild) {
      mappings.push({ ...manual, updatedAt: ts });
      continue;
    }

    const candidates = scoreEntityMappings(ent, slug, concepts, aliasIndex);
    if (!candidates.length) {
      mappings.push(
        AliasMappingSchema.parse({
          id: mappingId(slug, ent.id, null),
          schemaVersion: "1.0.0",
          sourceCompany: company,
          sourceProject: slug,
          sourceEntityId: ent.id,
          originalLabel: ent.name,
          lexicalKey: normalizeKey(ent.name),
          canonicalConceptId: null,
          mappingConfidence: 0,
          mappingMethod: "semantic",
          evidenceIds: [...ent.evidenceIds],
          reviewStatus: "unreviewed",
          ambiguityNotes: "No registry-backed candidate (alias/structural/semantic)",
          version: "1.0.0",
          createdAt:
            prior.find((p) => p.sourceEntityId === ent.id)?.createdAt ?? ts,
          updatedAt: ts,
          belowThreshold: true,
        }),
      );
      continue;
    }

    const pick = pickBestMapping(candidates, threshold);
    const best = pick.best ?? candidates[0]!;
    const conceptId =
      pick.ambiguous || pick.belowThreshold
        ? null
        : (pick.best?.conceptId ?? null);

    const mapping: AliasMapping = {
      id: mappingId(slug, ent.id, conceptId ?? best.conceptId),
      schemaVersion: "1.0.0",
      sourceCompany: company,
      sourceProject: slug,
      sourceEntityId: ent.id,
      originalLabel: ent.name,
      lexicalKey: normalizeKey(ent.name),
      canonicalConceptId: conceptId,
      mappingConfidence: best.confidence,
      mappingMethod: best.method,
      evidenceIds: [...ent.evidenceIds],
      reviewStatus: pick.ambiguous ? "ambiguous" : "unreviewed",
      ambiguityNotes:
        pick.ambiguityNotes ||
        (pick.belowThreshold
          ? `Best candidate ${best.canonicalName} below threshold (${best.confidence.toFixed(2)} < ${threshold})`
          : ""),
      version: "1.0.0",
      createdAt: prior.find((p) => p.sourceEntityId === ent.id)?.createdAt ?? ts,
      updatedAt: ts,
      belowThreshold: pick.belowThreshold || pick.ambiguous,
    };
    mappings.push(AliasMappingSchema.parse(mapping));
  }

  const status = buildStatus(slug, mappings, entities.length, dryRun);

  if (!dryRun) {
    persistProjectMappings(slug, mappings);
    persistGlobalProjectIndex(slug, mappings, status);
    writeJson(`${projectNormalizationDir(slug)}/status.json`, status);
  }

  const reviewQueue = mappings.filter(
    (m) =>
      m.reviewStatus === "ambiguous" ||
      m.belowThreshold ||
      !m.canonicalConceptId,
  );

  return { slug, dryRun, rebuild, status, mappings, reviewQueue };
}

export function normalizationStatus(slug: string): ProjectNormalizationStatus {
  const path = `${projectNormalizationDir(slug)}/status.json`;
  if (fs.existsSync(path)) {
    return ProjectNormalizationStatusSchema.parse(
      JSON.parse(fs.readFileSync(path, "utf8")),
    );
  }
  const result = normalizeProject({ slug, dryRun: true });
  return result.status;
}

export function normalizationReviewQueue(slug: string): {
  slug: string;
  count: number;
  items: AliasMapping[];
} {
  const mappings = loadExistingMappings(slug);
  if (!mappings.length) {
    const result = normalizeProject({ slug, dryRun: true });
    return {
      slug,
      count: result.reviewQueue.length,
      items: result.reviewQueue,
    };
  }
  const items = mappings.filter(
    (m) =>
      m.reviewStatus === "ambiguous" ||
      (m.belowThreshold && m.mappingConfidence > 0) ||
      (m.reviewStatus === "unreviewed" && m.mappingConfidence > 0 && !m.canonicalConceptId),
  );
  return { slug, count: items.length, items };
}

export function confirmMapping(
  slug: string,
  mappingIdValue: string,
  conceptId: string,
  reviewer = "human",
): AliasMapping {
  const mappings = loadExistingMappings(slug);
  const idx = mappings.findIndex((m) => m.id === mappingIdValue);
  if (idx === -1) throw new Error(`Mapping not found: ${mappingIdValue}`);
  const ts = new Date().toISOString();
  const next: AliasMapping = {
    ...mappings[idx]!,
    canonicalConceptId: conceptId,
    mappingMethod: "manually_reviewed",
    mappingConfidence: Math.max(mappings[idx]!.mappingConfidence, 0.95),
    reviewStatus: "confirmed",
    belowThreshold: false,
    ambiguityNotes: `Confirmed by ${reviewer}`,
    updatedAt: ts,
  };
  mappings[idx] = next;
  persistProjectMappings(slug, mappings);
  const status = buildStatus(slug, mappings, projectEntities(slug).length, false);
  persistGlobalProjectIndex(slug, mappings, status);
  writeJson(`${projectNormalizationDir(slug)}/status.json`, status);
  return next;
}

export function loadProjectMappings(slug: string): AliasMapping[] {
  return loadExistingMappings(slug);
}
