import fs from "node:fs";
import type {
  CandidatePattern,
  EvidenceRecord,
  KnowledgeEntity,
  KnowledgeIndex,
  KnowledgeRelationship,
} from "@/lib/schemas/knowledge";
import { loadStore } from "@/lib/knowledge/store";
import { normalizeKey } from "@/lib/knowledge/ids";
import { knowledgePath } from "@/lib/knowledge/paths";

export type QueryOptions = {
  company?: string;
  industry?: string;
  entityType?: string;
  relationshipType?: string;
  evidenceStatus?: string;
  candidatePatterns?: boolean;
  project?: string;
  limit?: number;
};

export type QueryResult = {
  entities: KnowledgeEntity[];
  relationships: KnowledgeRelationship[];
  evidence: EvidenceRecord[];
  candidatePatterns: CandidatePattern[];
  meta: {
    matchedEntityIds: number;
    indexUpdatedAt?: string;
  };
};

function readIndex(): KnowledgeIndex | null {
  const p = knowledgePath("indexes", "main.json");
  if (!fs.existsSync(p)) return null;
  return JSON.parse(fs.readFileSync(p, "utf8")) as KnowledgeIndex;
}

export function queryKnowledge(opts: QueryOptions): QueryResult {
  const store = loadStore();
  const indexObj = readIndex();
  const limit = opts.limit ?? 50;
  let entityIds = new Set<string>();

  if (opts.candidatePatterns) {
    return {
      entities: [],
      relationships: [],
      evidence: [],
      candidatePatterns: [...store.candidatePatterns.values()].slice(0, limit),
      meta: {
        matchedEntityIds: 0,
        indexUpdatedAt: indexObj?.updatedAt,
      },
    };
  }

  if (opts.company) {
    const key = normalizeKey(opts.company);
    const fromIndex =
      indexObj?.byCompany[key] ?? indexObj?.byCompany[opts.company] ?? [];
    const fromProject = indexObj?.byProject[opts.company] ?? [];
    for (const id of [...fromIndex, ...fromProject]) entityIds.add(id);
    if (entityIds.size === 0) {
      for (const e of store.entities.values()) {
        if (
          e.type === "Company" &&
          (e.normalizedKey.includes(key) ||
            e.sourceProjects.includes(opts.company))
        ) {
          entityIds.add(e.id);
        }
        if (e.sourceProjects.includes(opts.company)) entityIds.add(e.id);
      }
    }
  }

  if (opts.industry) {
    const key = normalizeKey(opts.industry);
    const ids = indexObj?.byIndustry[key] ?? [];
    for (const id of ids) entityIds.add(id);
    if (ids.length === 0) {
      for (const e of store.entities.values()) {
        if (e.type === "Industry" && e.normalizedKey.includes(key)) {
          entityIds.add(e.id);
        }
        if (
          typeof e.properties.industry === "string" &&
          normalizeKey(String(e.properties.industry)).includes(key)
        ) {
          entityIds.add(e.id);
        }
      }
    }
    for (const rel of store.relationships.values()) {
      if (
        rel.type === "COMPANY_OPERATES_IN_INDUSTRY" &&
        entityIds.has(rel.toId)
      ) {
        entityIds.add(rel.fromId);
      }
    }
  }

  if (opts.entityType) {
    const ids = indexObj?.byEntityType[opts.entityType] ?? [];
    if (entityIds.size === 0) {
      for (const id of ids) entityIds.add(id);
      if (ids.length === 0) {
        for (const e of store.entities.values()) {
          if (e.type === opts.entityType) entityIds.add(e.id);
        }
      }
    } else {
      const typeSet = new Set(
        ids.length
          ? ids
          : [...store.entities.values()]
              .filter((e) => e.type === opts.entityType)
              .map((e) => e.id),
      );
      entityIds = new Set([...entityIds].filter((id) => typeSet.has(id)));
    }
  }

  if (opts.project) {
    const ids = indexObj?.byProject[opts.project] ?? [];
    if (entityIds.size === 0) {
      for (const id of ids) entityIds.add(id);
    } else {
      entityIds = new Set([...entityIds].filter((id) => ids.includes(id)));
    }
  }

  let relationships = [...store.relationships.values()];
  if (opts.relationshipType) {
    relationships = relationships.filter(
      (r) => r.type === opts.relationshipType,
    );
    if (entityIds.size === 0) {
      for (const r of relationships) {
        entityIds.add(r.fromId);
        entityIds.add(r.toId);
      }
    }
  }

  const hasFilter = Boolean(
    opts.company ||
      opts.industry ||
      opts.entityType ||
      opts.project ||
      opts.relationshipType ||
      opts.evidenceStatus,
  );

  let entities =
    entityIds.size > 0
      ? [...entityIds]
          .map((id) => store.entities.get(id))
          .filter((e): e is KnowledgeEntity => Boolean(e))
      : hasFilter
        ? []
        : [...store.entities.values()];

  entities = entities.slice(0, limit);
  const entIdSet = new Set(entities.map((e) => e.id));

  relationships = relationships
    .filter(
      (r) =>
        !hasFilter ||
        entIdSet.has(r.fromId) ||
        entIdSet.has(r.toId) ||
        Boolean(opts.relationshipType),
    )
    .slice(0, limit);

  let evidence = [...store.evidence.values()];
  if (opts.evidenceStatus) {
    evidence = evidence.filter((e) =>
      opts.evidenceStatus === "stale"
        ? e.stale
        : e.provenance.reviewStatus === opts.evidenceStatus,
    );
  } else if (entIdSet.size) {
    evidence = evidence.filter((e) =>
      e.relatedEntityIds.some((id) => entIdSet.has(id)),
    );
  }
  evidence = evidence.slice(0, limit);

  return {
    entities,
    relationships,
    evidence,
    candidatePatterns: [],
    meta: {
      matchedEntityIds: entities.length,
      indexUpdatedAt: indexObj?.updatedAt,
    },
  };
}
