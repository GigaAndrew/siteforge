import type {
  BenchmarkDefinition,
  BenchmarkObservation,
  ScoreOutput,
} from "@/lib/benchmark/schemas";
import { ScoreOutputSchema } from "@/lib/benchmark/schemas";
import { getConceptById, loadConcepts } from "@/lib/normalization/registry";

function mean(nums: number[]): number {
  if (!nums.length) return 0;
  return nums.reduce((a, b) => a + b, 0) / nums.length;
}

function scoreId(parts: string[]): string {
  return parts.join(":");
}

export type ScoreBundle = {
  conceptScores: ScoreOutput[];
  dimensionScores: ScoreOutput[];
  companyScore: ScoreOutput;
};

/**
 * Deterministic scoring. Performance and confidence remain separate.
 * unknown does not become absent. Overall suppressed when ineligible.
 */
export function scoreObservations(
  slug: string,
  def: BenchmarkDefinition,
  observations: BenchmarkObservation[],
): ScoreBundle {
  const concepts = loadConcepts();
  const conceptScores: ScoreOutput[] = [];
  const dimensionScores: ScoreOutput[] = [];

  // --- Concept scores (across capability_presence primary) ---
  for (const conceptId of def.canonical_concepts) {
    const related = observations.filter(
      (o) =>
        o.canonicalConceptId === conceptId &&
        o.dimensionId === "capability_presence",
    );
    const o = related[0];
    const concept = getConceptById(conceptId, concepts);
    const trace: string[] = [];
    let raw: number | null = null;
    let eligible = false;
    const exclusions: string[] = [];
    const caveats: string[] = [];

    if (!o) {
      exclusions.push("no_observation");
      caveats.push("No observation generated");
    } else if (o.observedState === "unknown") {
      exclusions.push("unknown_not_scored_as_absent");
      caveats.push("Unknown — insufficient evidence; not treated as absent");
      trace.push("state=unknown → performance null, confidence retained");
    } else if (o.observedState === "ambiguous") {
      exclusions.push("ambiguous");
      caveats.push(o.ambiguity || "Ambiguous mapping");
      trace.push("state=ambiguous → performance null");
    } else if (o.observedState === "not_applicable") {
      exclusions.push("not_applicable");
    } else if (o.normalizedValue != null) {
      raw = o.normalizedValue * 100;
      eligible = true;
      trace.push(
        `state=${o.observedState} normalized=${o.normalizedValue} → raw=${raw}`,
      );
    }

    const conf = o ? o.confidence : 0;
    const coverage = o && o.evidenceIds.length ? 1 : 0;
    conceptScores.push(
      ScoreOutputSchema.parse({
        level: "canonical_concept",
        id: scoreId(["concept", slug, conceptId]),
        label: concept?.canonical_name ?? conceptId,
        projectSlug: slug,
        canonicalConceptId: conceptId,
        rawScore: raw,
        weightedScore: raw,
        confidence: conf,
        evidenceCoverage: coverage,
        completeness: eligible ? 1 : 0,
        uncertainty: 1 - conf,
        exclusions,
        caveats,
        benchmarkId: def.id,
        benchmarkVersion: def.version,
        eligible,
        calculationTrace: trace,
      }),
    );
  }

  // --- Dimension scores ---
  for (const dim of def.dimensions) {
    const dimObs = observations.filter((o) => o.dimensionId === dim.id);
    const scored = dimObs.filter(
      (o) =>
        o.normalizedValue != null &&
        (o.observedState === "present" ||
          o.observedState === "partial" ||
          o.observedState === "absent"),
    );
    const unknowns = dimObs.filter((o) => o.observedState === "unknown");
    const ambiguous = dimObs.filter((o) => o.observedState === "ambiguous");
    const exclusions: string[] = [];
    const caveats: string[] = [];
    const trace: string[] = [];

    // Special engineering_utility: gap signal alone should not inflate
    let values = scored.map((o) => o.normalizedValue as number);
    if (dim.id === "engineering_utility") {
      const tools = scored.filter(
        (o) =>
          o.canonicalConceptId === "canon_engineering-calculator" ||
          o.canonicalConceptId === "canon_limiting-height-tool" ||
          o.canonicalConceptId === "canon_engineering-table",
      );
      const gaps = scored.filter(
        (o) => o.canonicalConceptId === "canon_calculator-opportunity",
      );
      if (tools.length) {
        values = tools.map((o) => o.normalizedValue as number);
        trace.push(`engineering_utility uses tool concepts n=${tools.length}`);
      } else if (gaps.length) {
        values = [0.2];
        caveats.push(
          "Only calculator opportunity/gap signal present — low engineering utility",
        );
        trace.push("engineering_utility gap-only → 0.2");
      }
    }

    if (dim.id === "evidence_quality") {
      const withEv = dimObs.filter(
        (o) =>
          o.observedState === "present" || o.observedState === "partial",
      );
      const good = withEv.filter(
        (o) => o.evidenceIds.length > 0 && o.conflictIds.length === 0,
      );
      values = withEv.length ? [good.length / withEv.length] : [];
      trace.push(
        `evidence_quality good=${good.length}/${withEv.length || 0}`,
      );
    }

    if (dim.id === "evidence_recency") {
      const withEv = dimObs.filter((o) => o.evidenceIds.length > 0);
      // Stale penalty encoded in confidence/notes; use confidence proxy
      values = withEv.length
        ? [mean(withEv.map((o) => (o.notes.includes("stale") ? 0.4 : 0.95)))]
        : [];
      if (!withEv.length) caveats.push("No evidence for recency assessment");
    }

    if (dim.id === "cross_channel_consistency") {
      const total = dimObs.filter((o) => o.observedState !== "not_applicable");
      const bad = total.filter(
        (o) =>
          o.observedState === "ambiguous" || o.conflictIds.length > 0,
      );
      values = total.length ? [1 - bad.length / total.length] : [];
      trace.push(`consistency bad=${bad.length}/${total.length || 0}`);
    }

    const coverage =
      dimObs.length === 0
        ? 0
        : (dimObs.length - unknowns.length) / dimObs.length;
    const conf = dimObs.length ? mean(dimObs.map((o) => o.confidence)) : 0;

    let raw: number | null = null;
    let eligible = false;
    if (!values.length) {
      if (unknowns.length && !scored.length) {
        exclusions.push("insufficient_known_observations");
        caveats.push(
          "Dimension lacks known observations — score suppressed (unknown ≠ absent)",
        );
        trace.push("no scorable values; unknowns present");
      } else {
        exclusions.push("no_scorable_observations");
      }
    } else {
      raw = mean(values) * 100;
      eligible = true;
      trace.push(`mean(normalized)=${mean(values).toFixed(4)} → raw=${raw.toFixed(2)}`);
    }

    if (ambiguous.length) {
      caveats.push(`${ambiguous.length} ambiguous observation(s)`);
      // Cap confidence when ambiguous
    }
    if (coverage < 0.25 && dim.missingEvidenceBehavior === "cap_confidence") {
      caveats.push("Low evidence coverage — confidence capped");
    }

    const weight = def.weights[dim.id] ?? dim.weight;
    const weighted = raw != null ? raw * weight : null;
    if (raw != null) {
      trace.push(`weight=${weight} → weighted=${weighted?.toFixed(2)}`);
    }

    dimensionScores.push(
      ScoreOutputSchema.parse({
        level: "dimension",
        id: scoreId(["dim", slug, dim.id]),
        label: dim.name,
        projectSlug: slug,
        dimensionId: dim.id,
        rawScore: raw,
        weightedScore: weighted,
        confidence:
          coverage < 0.25 && dim.missingEvidenceBehavior === "cap_confidence"
            ? Math.min(conf, 0.55)
            : conf,
        evidenceCoverage: coverage,
        completeness: coverage,
        uncertainty: 1 - conf,
        exclusions,
        caveats,
        benchmarkId: def.id,
        benchmarkVersion: def.version,
        eligible,
        calculationTrace: trace,
      }),
    );
  }

  // --- Company aggregate ---
  const eligibleDims = dimensionScores.filter((d) => d.eligible && d.rawScore != null);
  const mappedConcepts = conceptScores.filter((c) => c.eligible).length;
  const evidenceCoverage = mean(dimensionScores.map((d) => d.evidenceCoverage));
  const overallConf = eligibleDims.length
    ? mean(eligibleDims.map((d) => d.confidence))
    : mean(dimensionScores.map((d) => d.confidence));

  const exclusions: string[] = [];
  const caveats: string[] = [];
  const trace: string[] = [];

  const requiredOk = def.eligibility_rules.requiredDimensions.every((rid) =>
    eligibleDims.some((d) => d.dimensionId === rid),
  );
  const eligible =
    mappedConcepts >= def.eligibility_rules.minMappedConcepts &&
    evidenceCoverage >= def.eligibility_rules.minEvidenceCoverage &&
    eligibleDims.length >= def.eligibility_rules.minEligibleDimensions &&
    requiredOk &&
    evidenceCoverage >= def.missing_data_policy.suppressOverallBelowCoverage;

  if (!eligible) {
    exclusions.push("eligibility_threshold_not_met");
    if (mappedConcepts < def.eligibility_rules.minMappedConcepts) {
      caveats.push(
        `Mapped concepts ${mappedConcepts} < min ${def.eligibility_rules.minMappedConcepts}`,
      );
    }
    if (evidenceCoverage < def.eligibility_rules.minEvidenceCoverage) {
      caveats.push(
        `Evidence coverage ${evidenceCoverage.toFixed(2)} below threshold — overall suppressed to avoid false precision`,
      );
    }
    if (!requiredOk) {
      caveats.push("Required dimensions not eligible");
    }
    trace.push("overall suppressed");
  }

  let overallRaw: number | null = null;
  let overallWeighted: number | null = null;
  if (eligible) {
    const weightSum = eligibleDims.reduce(
      (s, d) => s + (def.weights[d.dimensionId!] ?? 0),
      0,
    );
    overallWeighted = eligibleDims.reduce((s, d) => {
      const w = def.weights[d.dimensionId!] ?? 0;
      return s + (d.rawScore! * w) / (weightSum || 1);
    }, 0);
    // Renormalize eligible weights
    overallRaw = overallWeighted;
    trace.push(
      `eligibleDims=${eligibleDims.length} weightSum=${weightSum.toFixed(3)} overall=${overallRaw.toFixed(2)}`,
    );
    caveats.push(
      "Overall score is weighted across eligible dimensions only; see component scores",
    );
  }

  if (def.evidence_requirements.excludeCandidatePatterns) {
    caveats.push(
      "Candidate patterns excluded from benchmark criteria (remain unapproved)",
    );
  }

  const companyScore = ScoreOutputSchema.parse({
    level: "company",
    id: scoreId(["company", slug, def.id, def.version]),
    label: slug,
    projectSlug: slug,
    rawScore: overallRaw,
    weightedScore: overallWeighted,
    confidence: overallConf,
    evidenceCoverage,
    completeness: evidenceCoverage,
    uncertainty: 1 - overallConf,
    exclusions,
    caveats,
    benchmarkId: def.id,
    benchmarkVersion: def.version,
    eligible,
    calculationTrace: trace,
  });

  return { conceptScores, dimensionScores, companyScore };
}
