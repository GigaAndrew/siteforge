import { createHash } from "node:crypto";
import type {
  BenchmarkDefinition,
  BenchmarkObservation,
  BenchmarkRecommendation,
  ScoreOutput,
} from "@/lib/benchmark/schemas";
import { BenchmarkRecommendationSchema } from "@/lib/benchmark/schemas";
import { getConceptById, loadConcepts } from "@/lib/normalization/registry";
import type { PeerComparisonResult } from "@/lib/benchmark/compare";

function rid(parts: string[]): string {
  return `brec_${createHash("sha256").update(parts.join("|")).digest("hex").slice(0, 14)}`;
}

/**
 * Evidence-backed recommendations. Never recommend solely because a peer has a feature.
 */
export function generateRecommendations(
  slug: string,
  companyName: string,
  def: BenchmarkDefinition,
  observations: BenchmarkObservation[],
  conceptScores: ScoreOutput[],
  peer?: PeerComparisonResult | null,
): BenchmarkRecommendation[] {
  const concepts = loadConcepts();
  const ts = new Date().toISOString();
  const out: BenchmarkRecommendation[] = [];

  for (const cs of conceptScores) {
    const conceptId = cs.canonicalConceptId!;
    const concept = getConceptById(conceptId, concepts);
    const obs = observations.find(
      (o) =>
        o.canonicalConceptId === conceptId &&
        o.dimensionId === "capability_presence",
    );
    if (!obs) continue;

    if (obs.observedState === "unknown") {
      out.push(
        BenchmarkRecommendationSchema.parse({
          id: rid([slug, conceptId, "evidence_gap"]),
          projectSlug: slug,
          companyName,
          canonicalConceptId: conceptId,
          dimensionId: "capability_presence",
          kind: "evidence_gap",
          observedGap: `Unknown status for ${concept?.canonical_name ?? conceptId}`,
          evidenceIds: obs.evidenceIds,
          confidence: obs.confidence,
          expectedImpact:
            "Cannot judge capability quality until evidence is collected",
          recommendedAction:
            "Capture or map authoritative page/document evidence for this concept, then re-run normalization and benchmark",
          priorityRationale: "Unknown blocks safe conclusions",
          dependencies: ["normalization mapping", "source evidence"],
          limitations: [
            "Do not treat unknown as confirmed absence",
            "Peer presence alone is not a recommendation trigger",
          ],
          benchmarkId: def.id,
          benchmarkVersion: def.version,
          generatedAt: ts,
        }),
      );
      continue;
    }

    if (obs.observedState === "ambiguous") {
      out.push(
        BenchmarkRecommendationSchema.parse({
          id: rid([slug, conceptId, "likely_gap"]),
          projectSlug: slug,
          companyName,
          canonicalConceptId: conceptId,
          dimensionId: "capability_presence",
          kind: "likely_gap",
          observedGap: `Ambiguous mapping for ${concept?.canonical_name ?? conceptId}`,
          evidenceIds: obs.evidenceIds,
          confidence: obs.confidence,
          expectedImpact: "Unresolved ambiguity reduces benchmark confidence",
          recommendedAction:
            "Human-confirm or reject the normalization mapping, then rebuild benchmark",
          priorityRationale: "Ambiguity blocks publication-quality scores",
          dependencies: ["normalization-confirm"],
          limitations: [obs.ambiguity || "Ambiguous mapping"],
          benchmarkId: def.id,
          benchmarkVersion: def.version,
          generatedAt: ts,
        }),
      );
    }

    // Confirmed weak partial on high-weight engineering concepts
    if (
      obs.observedState === "partial" &&
      (conceptId === "canon_engineering-calculator" ||
        conceptId === "canon_submittal-workflow" ||
        conceptId === "canon_document-center")
    ) {
      out.push(
        BenchmarkRecommendationSchema.parse({
          id: rid([slug, conceptId, "optimization"]),
          projectSlug: slug,
          companyName,
          canonicalConceptId: conceptId,
          dimensionId: "engineering_utility",
          kind: "optimization_opportunity",
          observedGap: `Partial evidence for ${concept?.canonical_name ?? conceptId}`,
          evidenceIds: obs.evidenceIds,
          confidence: obs.confidence,
          expectedImpact:
            "Stronger first-class UX for this capability improves engineering utility and discoverability",
          recommendedAction:
            "Strengthen on-site implementation and re-evidence the capability (not peer-copy)",
          priorityRationale: "Core digital capability with only partial evidence",
          dependencies: [],
          limitations: [
            "Recommendation grounded in this company's evidence weakness, not peer feature parity alone",
          ],
          benchmarkId: def.id,
          benchmarkVersion: def.version,
          generatedAt: ts,
        }),
      );
    }
  }

  // Peer-relative advantage: only when conclusive AND this company is stronger with evidence
  if (peer) {
    for (const g of peer.gaps) {
      if (g.inconclusive) continue;
      if (g.stronger !== slug) continue;
      if (g.delta < 20) continue;
      const obs = observations.find(
        (o) =>
          o.canonicalConceptId === g.conceptId &&
          o.dimensionId === "capability_presence" &&
          (o.observedState === "present" || o.observedState === "partial"),
      );
      if (!obs || !obs.evidenceIds.length) continue;
      out.push(
        BenchmarkRecommendationSchema.parse({
          id: rid([slug, g.conceptId, "advantage"]),
          projectSlug: slug,
          companyName,
          canonicalConceptId: g.conceptId,
          dimensionId: "capability_presence",
          kind: "peer_relative_advantage",
          observedGap: `Relative strength vs limited cohort (Δ=${g.delta.toFixed(1)})`,
          evidenceIds: obs.evidenceIds,
          confidence: Math.min(obs.confidence, 0.75),
          expectedImpact: "Potential differentiator within this validation cohort",
          recommendedAction:
            "Preserve and document this capability; do not over-generalize beyond cohort",
          priorityRationale: "Evidence-backed relative strength in limited cohort",
          dependencies: [],
          limitations: [
            peer.cohortLabel,
            "Not proof of market leadership",
            "Synthetic peers further limit external validity",
          ],
          benchmarkId: def.id,
          benchmarkVersion: def.version,
          generatedAt: ts,
        }),
      );
    }

    // Confirmed gap vs peer only if this company unknown/absent-like AND peer present with evidence
    // We never recommend solely because peer has feature — require own evidence weakness
    for (const g of peer.gaps) {
      if (g.inconclusive || g.weaker !== slug) continue;
      const own = observations.find(
        (o) =>
          o.canonicalConceptId === g.conceptId &&
          o.dimensionId === "capability_presence",
      );
      if (!own) continue;
      if (own.observedState === "unknown") {
        // already covered as evidence_gap
        continue;
      }
      if (own.observedState === "partial" && g.delta >= 25) {
        out.push(
          BenchmarkRecommendationSchema.parse({
            id: rid([slug, g.conceptId, "confirmed_gap"]),
            projectSlug: slug,
            companyName,
            canonicalConceptId: g.conceptId,
            dimensionId: "capability_presence",
            kind: "confirmed_gap",
            observedGap: `Weaker evidenced implementation vs cohort peer (Δ=${g.delta.toFixed(1)}); own state=${own.observedState}`,
            evidenceIds: own.evidenceIds,
            confidence: Math.min(own.confidence, 0.7),
            expectedImpact:
              "Users may struggle to complete related engineering/document tasks",
            recommendedAction:
              "Improve this company's own evidenced capability — peer parity is context, not the requirement",
            priorityRationale:
              "Gap supported by this company's weak/partial evidence plus conclusive cohort delta",
            dependencies: [],
            limitations: [
              peer.cohortLabel,
              "Do not copy peer UX blindly",
              "Synthetic fixture peers are not market proof",
            ],
            benchmarkId: def.id,
            benchmarkVersion: def.version,
            generatedAt: ts,
          }),
        );
      }
    }
  }

  return out;
}
