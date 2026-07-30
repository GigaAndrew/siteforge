import { createHash } from "node:crypto";
import { loadStore } from "@/lib/knowledge/store";
import { loadProjectMappings } from "@/lib/normalization/engine";
import { getConceptById, loadConcepts } from "@/lib/normalization/registry";
import { readProjectConfig } from "@/lib/project";
import type {
  BenchmarkDefinition,
  BenchmarkObservation,
  DimensionId,
  ObservedState,
} from "@/lib/benchmark/schemas";
import { BenchmarkObservationSchema } from "@/lib/benchmark/schemas";

function obsId(parts: string[]): string {
  return `bobs_${createHash("sha256").update(parts.join("|")).digest("hex").slice(0, 16)}`;
}

function isSyntheticFixture(slug: string): boolean {
  try {
    const cfg = readProjectConfig(slug);
    const notes = cfg.notes.toLowerCase();
    // .example hosts are always fixtures
    if (cfg.websiteUrl.includes(".example")) return true;
    // "Not synthetic" must win over a naive substring/word match on "synthetic"
    if (/\bnot\s+synthetic\b/.test(notes)) return false;
    return /\bsynthetic\b/.test(notes) || /\bfixture\b/.test(notes);
  } catch {
    return false;
  }
}

function companyName(slug: string): string {
  try {
    return readProjectConfig(slug).name;
  } catch {
    return slug;
  }
}

function mappingConfidenceToObsConfidence(
  mappingConf: number,
  floors: { high: number; medium: number },
): number {
  if (mappingConf >= floors.high) return Math.min(0.95, mappingConf);
  if (mappingConf >= floors.medium) return Math.min(0.85, mappingConf);
  return Math.max(0.35, mappingConf * 0.9);
}

/**
 * Generate benchmark observations from normalization mappings + KG evidence.
 * Does not mutate company knowledge. unknown ≠ absent.
 */
export function generateObservations(
  slug: string,
  def: BenchmarkDefinition,
): BenchmarkObservation[] {
  const store = loadStore();
  const concepts = loadConcepts();
  const mappings = loadProjectMappings(slug).filter(
    (m) => m.reviewStatus !== "rejected",
  );
  const ts = new Date().toISOString();
  const company = companyName(slug);
  const synthetic = isSyntheticFixture(slug);
  const out: BenchmarkObservation[] = [];

  const bestByConcept = new Map<string, (typeof mappings)[0]>();
  for (const m of mappings) {
    if (!m.canonicalConceptId) continue;
    const prev = bestByConcept.get(m.canonicalConceptId);
    if (!prev || m.mappingConfidence > prev.mappingConfidence) {
      bestByConcept.set(m.canonicalConceptId, m);
    }
  }

  for (const conceptId of def.canonical_concepts) {
    const concept = getConceptById(conceptId, concepts);
    const mapping = bestByConcept.get(conceptId);

    for (const dim of def.dimensions) {
      if (
        dim.applicableConcepts.length &&
        !dim.applicableConcepts.includes(conceptId)
      ) {
        continue;
      }

      let observedState: ObservedState = "unknown";
      let rawValue: number | string | null = null;
      let normalizedValue: number | null = null;
      let confidence = 0.4;
      let evidenceIds: string[] = [];
      let conflictIds: string[] = [];
      let ambiguity = "";
      let sourceEntityId: string | null = null;
      let notes = "";

      if (!mapping) {
        observedState = "unknown";
        rawValue = null;
        normalizedValue = null;
        confidence = 0.35;
        notes =
          "No successful normalization mapping for this concept — unknown, not absent";
      } else if (mapping.reviewStatus === "ambiguous" || mapping.belowThreshold) {
        observedState = "ambiguous";
        rawValue = mapping.mappingConfidence;
        normalizedValue = null;
        confidence = Math.min(0.5, mapping.mappingConfidence);
        ambiguity = mapping.ambiguityNotes || "Ambiguous or below-threshold mapping";
        sourceEntityId = mapping.sourceEntityId;
        evidenceIds = [...mapping.evidenceIds];
        notes = "Mapping not accepted for scoring performance";
      } else if (mapping.canonicalConceptId && !mapping.belowThreshold) {
        sourceEntityId = mapping.sourceEntityId;
        evidenceIds = [...mapping.evidenceIds];
        const entity = mapping.sourceEntityId
          ? store.entities.get(mapping.sourceEntityId)
          : undefined;
        if (entity) conflictIds = [...entity.conflictIds];

        let stale = false;
        for (const eid of evidenceIds) {
          const ev = store.evidence.get(eid);
          if (ev?.stale) stale = true;
        }

        const hasEvidence = evidenceIds.length > 0;
        if (
          def.evidence_requirements.requireEvidenceForPresent &&
          !hasEvidence
        ) {
          observedState = "unknown";
          notes = "Mapping exists but required evidence missing — unknown";
          confidence = 0.4;
        } else {
          // Gap/opportunity signals are partial at best for engineering utility
          const isGapSignal = conceptId === "canon_calculator-opportunity";
          if (isGapSignal) {
            observedState = "partial";
            normalizedValue = 0.25;
            rawValue = "gap_signal";
            notes = "Opportunity/gap signal — not a confirmed capability";
          } else if (mapping.mappingConfidence >= 0.85) {
            observedState = "present";
            normalizedValue = 1;
            rawValue = mapping.mappingConfidence;
          } else {
            observedState = "partial";
            normalizedValue = 0.55;
            rawValue = mapping.mappingConfidence;
          }
          confidence = mappingConfidenceToObsConfidence(
            mapping.mappingConfidence,
            {
              high: def.confidence_rules.highMappingFloor,
              medium: def.confidence_rules.mediumMappingFloor,
            },
          );
          if (stale && !def.evidence_requirements.allowStaleEvidence) {
            confidence = Math.max(
              0.2,
              confidence - def.confidence_rules.stalePenalty,
            );
            notes = `${notes}; stale evidence penalty applied`.trim();
          }
          if (conflictIds.length) {
            const blocking = conflictIds.some(
              (id) => store.conflicts.get(id)?.blocksPatternPromotion,
            );
            if (blocking) {
              confidence = Math.max(
                0.15,
                confidence - def.confidence_rules.conflictPenalty,
              );
              ambiguity = "Blocking conflicts on source entity";
            }
          }
        }
      }

      if (synthetic) {
        notes = notes
          ? `${notes}; SYNTHETIC FIXTURE — not live market evidence`
          : "SYNTHETIC FIXTURE — not live market evidence";
        confidence = Math.min(confidence, 0.7);
      }

      out.push(
        BenchmarkObservationSchema.parse({
          id: obsId([
            slug,
            def.id,
            def.version,
            conceptId,
            dim.id,
            observedState,
          ]),
          schemaVersion: "1.0.0",
          projectSlug: slug,
          companyName: company,
          benchmarkId: def.id,
          benchmarkVersion: def.version,
          canonicalConceptId: conceptId,
          sourceEntityId,
          dimensionId: dim.id as DimensionId,
          observedState,
          rawValue,
          normalizedValue,
          confidence,
          evidenceIds,
          provenance: {
            mappingId: mapping?.id ?? null,
            mappingMethod: mapping?.mappingMethod ?? null,
            conceptName: concept?.canonical_name ?? conceptId,
            syntheticFixture: synthetic,
          },
          conflictIds,
          ambiguity,
          evaluator: "benchmark.observe.v1",
          method: "mapping_evidence",
          generatedAt: ts,
          notes,
        }),
      );
    }
  }

  return out;
}

export { isSyntheticFixture, companyName };
