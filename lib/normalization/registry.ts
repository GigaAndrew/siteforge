import fs from "node:fs";
import {
  CanonicalConceptSchema,
  type CanonicalConcept,
} from "@/lib/normalization/schemas";
import { seedCanonicalConcepts } from "@/lib/normalization/seed-concepts";
import {
  ensureNormalizationDirs,
  normalizationPath,
} from "@/lib/normalization/paths";
import { normalizeKey } from "@/lib/knowledge/ids";
import { writeJson } from "@/lib/knowledge/paths";

export type AliasIndexEntry = {
  conceptId: string;
  alias: string;
  lexicalKey: string;
  source: "canonical_name" | "alias" | "company_specific";
  companySlug?: string;
};

export function conceptsFilePath(): string {
  return normalizationPath("concepts.json");
}

const SEED_VERSION = "1.0.1";

export function ensureConceptRegistry(opts?: {
  refreshSeed?: boolean;
}): CanonicalConcept[] {
  ensureNormalizationDirs();
  const path = conceptsFilePath();
  const versionPath = normalizationPath("seed-version.json");
  const currentVersion = fs.existsSync(versionPath)
    ? (JSON.parse(fs.readFileSync(versionPath, "utf8")) as { version?: string })
        .version
    : null;
  const needsRefresh =
    opts?.refreshSeed ||
    !fs.existsSync(path) ||
    currentVersion !== SEED_VERSION;

  if (needsRefresh) {
    const seeded = seedCanonicalConcepts();
    // Preserve manually reviewed / accepted custom concepts not in seed
    if (fs.existsSync(path)) {
      const existing = loadConcepts();
      const seedIds = new Set(seeded.map((c) => c.id));
      for (const c of existing) {
        if (!seedIds.has(c.id) && c.reviewed_by && c.reviewed_by !== "platform") {
          seeded.push(c);
        }
      }
    }
    writeJson(path, seeded);
    writeJson(versionPath, {
      version: SEED_VERSION,
      updatedAt: new Date().toISOString(),
    });
    rebuildAliasIndex(seeded);
    return seeded;
  }
  return loadConcepts();
}

export function loadConcepts(): CanonicalConcept[] {
  ensureNormalizationDirs();
  const path = conceptsFilePath();
  if (!fs.existsSync(path)) return ensureConceptRegistry();
  const raw = JSON.parse(fs.readFileSync(path, "utf8")) as unknown[];
  return raw
    .map((c) => CanonicalConceptSchema.safeParse(c))
    .filter((r) => r.success)
    .map((r) => r.data);
}

export function saveConcepts(concepts: CanonicalConcept[]): void {
  ensureNormalizationDirs();
  writeJson(conceptsFilePath(), concepts);
  rebuildAliasIndex(concepts);
}

export function rebuildAliasIndex(concepts?: CanonicalConcept[]): AliasIndexEntry[] {
  const list = concepts ?? loadConcepts();
  const entries: AliasIndexEntry[] = [];
  for (const c of list) {
    if (c.status === "deprecated") continue;
    entries.push({
      conceptId: c.id,
      alias: c.canonical_name,
      lexicalKey: normalizeKey(c.canonical_name),
      source: "canonical_name",
    });
    for (const a of c.aliases) {
      entries.push({
        conceptId: c.id,
        alias: a,
        lexicalKey: normalizeKey(a),
        source: "alias",
      });
    }
    for (const [company, aliases] of Object.entries(
      c.company_specific_aliases ?? {},
    )) {
      for (const a of aliases) {
        entries.push({
          conceptId: c.id,
          alias: a,
          lexicalKey: normalizeKey(a),
          source: "company_specific",
          companySlug: company,
        });
      }
    }
  }
  writeJson(normalizationPath("indexes", "alias-index.json"), {
    updatedAt: new Date().toISOString(),
    entries,
  });
  return entries;
}

export function getConceptById(
  id: string,
  concepts?: CanonicalConcept[],
): CanonicalConcept | undefined {
  return (concepts ?? loadConcepts()).find((c) => c.id === id);
}

export function upsertConcept(concept: CanonicalConcept): void {
  const concepts = loadConcepts();
  const idx = concepts.findIndex((c) => c.id === concept.id);
  if (idx === -1) concepts.push(concept);
  else concepts[idx] = { ...concept, updated_at: new Date().toISOString() };
  saveConcepts(concepts);
}
