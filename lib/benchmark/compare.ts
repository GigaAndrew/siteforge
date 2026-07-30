import type {
  BenchmarkDefinition,
  ScoreOutput,
} from "@/lib/benchmark/schemas";
import { ScoreOutputSchema } from "@/lib/benchmark/schemas";
import { getConceptById, loadConcepts } from "@/lib/normalization/registry";

export type PeerComparisonResult = {
  cohortLabel: string;
  limitedCohort: boolean;
  projects: string[];
  benchmarkId: string;
  benchmarkVersion: string;
  conceptComparisons: ScoreOutput[];
  dimensionComparisons: ScoreOutput[];
  gaps: Array<{
    conceptId: string;
    stronger: string;
    weaker: string;
    delta: number;
    inconclusive: boolean;
    note: string;
  }>;
  strongestSupported: string;
  weakestSupported: string;
  warnings: string[];
  generatedAt: string;
};

export function compareBenchmarkPeers(
  def: BenchmarkDefinition,
  companyScores: ScoreOutput[],
  dimensionScoresBySlug: Record<string, ScoreOutput[]>,
  conceptScoresBySlug: Record<string, ScoreOutput[]>,
): PeerComparisonResult {
  const slugs = companyScores.map((c) => c.projectSlug!).filter(Boolean);
  const limited = slugs.length < 3;
  const warnings: string[] = [
    "Candidate patterns are not used as accepted peer criteria.",
  ];
  if (limited) {
    warnings.push(
      `Limited peer comparison / validation cohort (n=${slugs.length}). Not a statistically representative industry benchmark.`,
    );
  }

  const concepts = loadConcepts();
  const conceptComparisons: ScoreOutput[] = [];
  const gaps: PeerComparisonResult["gaps"] = [];

  for (const conceptId of def.canonical_concepts) {
    const scores = slugs.map((slug) => {
      const list = conceptScoresBySlug[slug] ?? [];
      return list.find((s) => s.canonicalConceptId === conceptId);
    });
    const known = scores.filter((s) => s && s.rawScore != null) as ScoreOutput[];
    const unknowns = scores.filter(
      (s) => !s || s.exclusions.includes("unknown_not_scored_as_absent"),
    );
    const concept = getConceptById(conceptId, concepts);
    const values = known.map((s) => s.rawScore!);
    const median =
      values.length === 0
        ? null
        : values.slice().sort((a, b) => a - b)[
            Math.floor((values.length - 1) / 2)
          ]!;

    conceptComparisons.push(
      ScoreOutputSchema.parse({
        level: "peer_comparison",
        id: `peer:concept:${conceptId}`,
        label: concept?.canonical_name ?? conceptId,
        canonicalConceptId: conceptId,
        rawScore: median,
        weightedScore: median,
        confidence: known.length
          ? known.reduce((a, s) => a + s.confidence, 0) / known.length
          : 0.3,
        evidenceCoverage: known.length / Math.max(1, slugs.length),
        completeness: known.length / Math.max(1, slugs.length),
        uncertainty: 1 - known.length / Math.max(1, slugs.length),
        exclusions: unknowns.length ? ["unknown_data_in_cohort"] : [],
        caveats: [
          ...(unknowns.length
            ? [`${unknowns.length} company(ies) unknown for this concept`]
            : []),
          ...(limited ? ["Limited cohort — do not generalize"] : []),
        ],
        benchmarkId: def.id,
        benchmarkVersion: def.version,
        eligible: known.length >= 2,
        calculationTrace: [
          `known=${known.length}`,
          `median=${median ?? "n/a"}`,
          `range=${values.length ? `${Math.min(...values)}-${Math.max(...values)}` : "n/a"}`,
        ],
      }),
    );

    if (known.length === 2) {
      const [a, b] = known;
      const delta = Math.abs(a!.rawScore! - b!.rawScore!);
      const inconclusive =
        delta < 5 ||
        Math.abs(a!.confidence - b!.confidence) > 0.35 ||
        a!.confidence < 0.5 ||
        b!.confidence < 0.5;
      const stronger =
        a!.rawScore! >= b!.rawScore! ? a!.projectSlug! : b!.projectSlug!;
      const weaker =
        stronger === a!.projectSlug ? b!.projectSlug! : a!.projectSlug!;
      gaps.push({
        conceptId,
        stronger,
        weaker,
        delta,
        inconclusive,
        note: inconclusive
          ? "Tied or inconclusive given confidence/coverage"
          : `Relative gap of ${delta.toFixed(1)} points (cohort-limited)`,
      });
    }
  }

  const dimensionComparisons: ScoreOutput[] = [];
  for (const dim of def.dimensions) {
    const scores = slugs
      .map((slug) =>
        (dimensionScoresBySlug[slug] ?? []).find((d) => d.dimensionId === dim.id),
      )
      .filter((s): s is ScoreOutput => Boolean(s && s.rawScore != null));
    const values = scores.map((s) => s.rawScore!);
    const median =
      values.length === 0
        ? null
        : values.slice().sort((a, b) => a - b)[
            Math.floor((values.length - 1) / 2)
          ]!;
    dimensionComparisons.push(
      ScoreOutputSchema.parse({
        level: "peer_comparison",
        id: `peer:dim:${dim.id}`,
        label: dim.name,
        dimensionId: dim.id,
        rawScore: median,
        weightedScore: median,
        confidence: scores.length
          ? scores.reduce((a, s) => a + s.confidence, 0) / scores.length
          : 0.3,
        evidenceCoverage: scores.length / Math.max(1, slugs.length),
        completeness: scores.length / Math.max(1, slugs.length),
        uncertainty: 1 - scores.length / Math.max(1, slugs.length),
        exclusions: [],
        caveats: limited
          ? ["Limited peer comparison — not industry-representative"]
          : [],
        benchmarkId: def.id,
        benchmarkVersion: def.version,
        eligible: scores.length >= 2,
        calculationTrace: [`median=${median ?? "n/a"}`],
      }),
    );
  }

  const conclusive = gaps.filter((g) => !g.inconclusive).sort((a, b) => b.delta - a.delta);
  const strongestSupported = conclusive[0]
    ? `${conclusive[0].stronger} leads on ${conclusive[0].conceptId} (Δ=${conclusive[0].delta.toFixed(1)})`
    : "No conclusive concept-level advantage in this limited cohort";
  const weakestSupported = conclusive.length
    ? `${conclusive[conclusive.length - 1]!.weaker} trails on ${conclusive[conclusive.length - 1]!.conceptId}`
    : "Insufficient conclusive gaps";

  return {
    cohortLabel: limited
      ? "Limited peer comparison / validation cohort"
      : "Peer comparison cohort",
    limitedCohort: limited,
    projects: slugs,
    benchmarkId: def.id,
    benchmarkVersion: def.version,
    conceptComparisons,
    dimensionComparisons,
    gaps,
    strongestSupported,
    weakestSupported,
    warnings,
    generatedAt: new Date().toISOString(),
  };
}
