import { createHash } from "node:crypto";
import type { EntityType, RelationshipType } from "@/lib/schemas/knowledge";

export function normalizeKey(input: string): string {
  return input
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 160);
}

export function stableHash(parts: string[]): string {
  return createHash("sha256").update(parts.join("|")).digest("hex").slice(0, 16);
}

/** Deterministic entity ID. Project-scoped types include projectSlug. */
export function entityId(
  type: EntityType,
  normalizedKey: string,
  scope: { projectSlug?: string; global?: boolean } = {},
): string {
  const scopePart = scope.global
    ? "global"
    : scope.projectSlug
      ? `project:${scope.projectSlug}`
      : "global";
  return `ent_${type}_${stableHash([type, normalizedKey, scopePart])}`;
}

export function relationshipId(
  type: RelationshipType,
  fromId: string,
  toId: string,
  projectSlug?: string,
): string {
  return `rel_${type}_${stableHash([type, fromId, toId, projectSlug ?? "global"])}`;
}

export function evidenceId(
  projectSlug: string,
  sourceUrl: string | undefined,
  excerptOrRef: string,
): string {
  return `ev_${stableHash([projectSlug, sourceUrl ?? "", excerptOrRef])}`;
}

export function conflictId(parts: string[]): string {
  return `conflict_${stableHash(parts)}`;
}

export function candidatePatternId(normalizedObservationKey: string): string {
  return `cpat_${stableHash(["CandidatePattern", normalizedObservationKey])}`;
}

export function observationKey(parts: {
  category: string;
  signal: string;
  polarity?: string;
}): string {
  return normalizeKey(
    [parts.category, parts.signal, parts.polarity ?? "present"].join(":"),
  );
}

export function fileContentHash(content: string): string {
  return createHash("sha256").update(content).digest("hex").slice(0, 16);
}
