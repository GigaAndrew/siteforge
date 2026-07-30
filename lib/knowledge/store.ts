import fs from "node:fs";
import {
  emptyStore,
  type KnowledgeStoreState,
} from "@/lib/knowledge/merge";

export type { KnowledgeStoreState };
import {
  ensureKnowledgeSkeleton,
  knowledgePath,
  readJsonArray,
  writeJson,
  writeJsonl,
} from "@/lib/knowledge/paths";
import type {
  CandidatePattern,
  ConflictRecord,
  EvidenceRecord,
  KnowledgeEntity,
  KnowledgeIndex,
  KnowledgeRelationship,
  PromotionAuditEntry,
} from "@/lib/schemas/knowledge";
import {
  KnowledgeEntitySchema,
  KnowledgeRelationshipSchema,
  EvidenceRecordSchema,
  ConflictRecordSchema,
  CandidatePatternSchema,
  KnowledgeIndexSchema,
  PromotionAuditEntrySchema,
} from "@/lib/schemas/knowledge";

export function loadStore(): KnowledgeStoreState {
  ensureKnowledgeSkeleton();
  const store = emptyStore();

  for (const ent of readJsonArray<KnowledgeEntity>(
    knowledgePath("entities", "all.json"),
  )) {
    const parsed = KnowledgeEntitySchema.safeParse(ent);
    if (parsed.success) store.entities.set(parsed.data.id, parsed.data);
  }
  for (const rel of readJsonArray<KnowledgeRelationship>(
    knowledgePath("relationships", "all.json"),
  )) {
    const parsed = KnowledgeRelationshipSchema.safeParse(rel);
    if (parsed.success) store.relationships.set(parsed.data.id, parsed.data);
  }
  for (const ev of readJsonArray<EvidenceRecord>(
    knowledgePath("evidence", "all.json"),
  )) {
    const parsed = EvidenceRecordSchema.safeParse(ev);
    if (parsed.success) store.evidence.set(parsed.data.id, parsed.data);
  }
  for (const c of readJsonArray<ConflictRecord>(
    knowledgePath("conflicts", "all.json"),
  )) {
    const parsed = ConflictRecordSchema.safeParse(c);
    if (parsed.success) store.conflicts.set(parsed.data.id, parsed.data);
  }
  for (const p of readJsonArray<CandidatePattern>(
    knowledgePath("patterns", "candidates.json"),
  )) {
    const parsed = CandidatePatternSchema.safeParse(p);
    if (parsed.success) store.candidatePatterns.set(parsed.data.id, parsed.data);
  }
  store.audit = readJsonArray<PromotionAuditEntry>(
    knowledgePath("audit", "promotion-log.json"),
  )
    .map((a) => PromotionAuditEntrySchema.safeParse(a))
    .filter((r) => r.success)
    .map((r) => r.data);

  return store;
}

export function persistStore(
  store: KnowledgeStoreState,
  index: KnowledgeIndex,
): void {
  ensureKnowledgeSkeleton();
  const entities = [...store.entities.values()];
  const relationships = [...store.relationships.values()];
  const evidence = [...store.evidence.values()];
  const conflicts = [...store.conflicts.values()];
  const patterns = [...store.candidatePatterns.values()];

  writeJson(knowledgePath("entities", "all.json"), entities);
  writeJson(knowledgePath("relationships", "all.json"), relationships);
  writeJson(knowledgePath("evidence", "all.json"), evidence);
  writeJson(knowledgePath("conflicts", "all.json"), conflicts);
  writeJson(knowledgePath("patterns", "candidates.json"), patterns);
  writeJson(knowledgePath("audit", "promotion-log.json"), store.audit);
  writeJson(
    knowledgePath("indexes", "main.json"),
    KnowledgeIndexSchema.parse(index),
  );

  // Typed entity shards for later UI / migration
  const byType = new Map<string, KnowledgeEntity[]>();
  for (const e of entities) {
    const list = byType.get(e.type) ?? [];
    list.push(e);
    byType.set(e.type, list);
  }
  for (const [type, list] of byType) {
    writeJson(knowledgePath("entities", `${type}.json`), list);
  }

  const byRel = new Map<string, KnowledgeRelationship[]>();
  for (const r of relationships) {
    const list = byRel.get(r.type) ?? [];
    list.push(r);
    byRel.set(r.type, list);
  }
  for (const [type, list] of byRel) {
    writeJson(knowledgePath("relationships", `${type}.json`), list);
  }

  // JSONL exports for graph DB import
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  writeJsonl(knowledgePath("exports", `entities-${stamp}.jsonl`), entities);
  writeJsonl(
    knowledgePath("exports", `relationships-${stamp}.jsonl`),
    relationships,
  );
  writeJsonl(knowledgePath("exports", `evidence-${stamp}.jsonl`), evidence);
  writeJson(knowledgePath("exports", `snapshot-${stamp}.json`), {
    exportedAt: new Date().toISOString(),
    schemaVersion: index.schemaVersion,
    counts: {
      entities: entities.length,
      relationships: relationships.length,
      evidence: evidence.length,
      conflicts: conflicts.length,
      candidatePatterns: patterns.length,
    },
    index,
  });

  // Keep a stable "latest" export pointer
  writeJson(knowledgePath("exports", "latest.json"), {
    exportedAt: new Date().toISOString(),
    schemaVersion: index.schemaVersion,
    files: {
      entities: "entities/all.json",
      relationships: "relationships/all.json",
      evidence: "evidence/all.json",
      patterns: "patterns/candidates.json",
      index: "indexes/main.json",
    },
    counts: {
      entities: entities.length,
      relationships: relationships.length,
      evidence: evidence.length,
      conflicts: conflicts.length,
      candidatePatterns: patterns.length,
    },
  });
}

export function rebuildStoreFromScratch(): void {
  ensureKnowledgeSkeleton();
  for (const rel of [
    "entities",
    "relationships",
    "evidence",
    "conflicts",
    "patterns",
    "indexes",
  ]) {
    const dir = knowledgePath(rel);
    if (!fs.existsSync(dir)) continue;
    for (const f of fs.readdirSync(dir)) {
      if (f === ".gitkeep") continue;
      fs.unlinkSync(knowledgePath(rel, f));
    }
  }
  // Preserve audit log by design
}
