import fs from "node:fs";
import path from "node:path";
import { loadBenchmarkDefinition } from "@/lib/benchmark/definitions";
import { projectBenchmarkDir } from "@/lib/benchmark/paths";
import type {
  BenchmarkObservation,
  BenchmarkRecommendation,
  CompanyBenchmarkStatus,
  ScoreOutput,
} from "@/lib/benchmark/schemas";
import type { PeerComparisonResult } from "@/lib/benchmark/compare";
import { isSyntheticFixture } from "@/lib/benchmark/observe";
import { writeJsonFile } from "@/lib/project";

function mdEscape(s: string): string {
  return s.replace(/\|/g, "\\|");
}

export function renderCompanyBenchmarkReport(slug: string, benchmarkId?: string): string {
  const def = loadBenchmarkDefinition(benchmarkId ?? "cfs-digital-capability");
  const dir = projectBenchmarkDir(slug, def.id, def.version);
  if (!fs.existsSync(`${dir}/status.json`)) {
    throw new Error(`No benchmark outputs for ${slug}. Run benchmark-run first.`);
  }
  const status = JSON.parse(
    fs.readFileSync(`${dir}/status.json`, "utf8"),
  ) as CompanyBenchmarkStatus;
  const dims = JSON.parse(
    fs.readFileSync(`${dir}/dimension-scores.json`, "utf8"),
  ) as ScoreOutput[];
  const concepts = JSON.parse(
    fs.readFileSync(`${dir}/concept-scores.json`, "utf8"),
  ) as ScoreOutput[];
  const company = JSON.parse(
    fs.readFileSync(`${dir}/company-score.json`, "utf8"),
  ) as ScoreOutput;
  const recommendations = JSON.parse(
    fs.readFileSync(`${dir}/recommendations.json`, "utf8"),
  ) as BenchmarkRecommendation[];
  const observations = JSON.parse(
    fs.readFileSync(`${dir}/observations.json`, "utf8"),
  ) as BenchmarkObservation[];

  const lines: string[] = [];
  lines.push(`# Benchmark Report — ${status.companyName} (\`${slug}\`)`);
  lines.push("");
  lines.push(`- Benchmark: **${def.name}** (\`${def.id}\`) v${def.version}`);
  lines.push(`- Status: ${def.status} — ${def.notes}`);
  lines.push(`- Generated: ${status.generatedAt}`);
  lines.push(`- Run ID: \`${status.runId}\``);
  lines.push(`- Input digest: \`${status.inputDigest}\``);
  if (status.syntheticFixture) {
    lines.push(
      "- **SYNTHETIC FIXTURE:** This project is not live market evidence. Treat scores as validation-only.",
    );
  }
  lines.push("");
  lines.push("## Overall");
  lines.push("");
  if (company.eligible && company.rawScore != null) {
    lines.push(
      `| Metric | Value |\n|---|---|\n| Performance (weighted eligible dims) | ${company.rawScore.toFixed(1)} |\n| Confidence | ${(company.confidence * 100).toFixed(1)}% |\n| Evidence coverage | ${(company.evidenceCoverage * 100).toFixed(1)}% |\n| Uncertainty | ${(company.uncertainty * 100).toFixed(1)}% |`,
    );
  } else {
    lines.push(
      "**Overall score suppressed** — eligibility/evidence thresholds not met (avoids false precision).",
    );
    lines.push("");
    lines.push(`Coverage: ${(company.evidenceCoverage * 100).toFixed(1)}%; confidence: ${(company.confidence * 100).toFixed(1)}%`);
  }
  for (const c of company.caveats) lines.push(`- Caveat: ${c}`);
  for (const e of company.exclusions) lines.push(`- Exclusion: ${e}`);
  lines.push("");
  lines.push("### Calculation trace");
  for (const t of company.calculationTrace) lines.push(`- \`${t}\``);
  lines.push("");
  lines.push("## Dimension scores");
  lines.push("");
  lines.push("| Dimension | Raw | Weighted | Confidence | Coverage | Eligible |");
  lines.push("|---|---:|---:|---:|---:|---|");
  for (const d of dims) {
    lines.push(
      `| ${mdEscape(d.label)} | ${d.rawScore?.toFixed(1) ?? "—"} | ${d.weightedScore?.toFixed(2) ?? "—"} | ${(d.confidence * 100).toFixed(0)}% | ${(d.evidenceCoverage * 100).toFixed(0)}% | ${d.eligible ? "yes" : "no"} |`,
    );
  }
  lines.push("");
  lines.push("## Concept scores (capability presence)");
  lines.push("");
  lines.push("| Concept | Score | Confidence | State notes |");
  lines.push("|---|---:|---:|---|");
  for (const c of concepts) {
    lines.push(
      `| ${mdEscape(c.label)} | ${c.rawScore?.toFixed(1) ?? "—"} | ${(c.confidence * 100).toFixed(0)}% | ${c.caveats.join("; ") || c.exclusions.join(", ") || "—"} |`,
    );
  }
  lines.push("");
  lines.push("## Observation summary");
  lines.push("");
  lines.push(
    `| present | partial | absent | unknown | ambiguous | conflicts |`,
  );
  lines.push("|---:|---:|---:|---:|---:|---:|");
  lines.push(
    `| ${status.presentCount} | ${status.partialCount} | ${status.absentCount} | ${status.unknownCount} | ${status.ambiguousCount} | ${status.conflictCount} |`,
  );
  lines.push("");
  lines.push(
    `Total observations: ${observations.length}. Unknown is never converted to absent.`,
  );
  lines.push("");
  lines.push("## Recommendations");
  lines.push("");
  if (!recommendations.length) {
    lines.push("_No recommendations generated._");
  } else {
    for (const r of recommendations) {
      lines.push(`### ${r.kind} — ${r.canonicalConceptId}`);
      lines.push(`- Gap: ${r.observedGap}`);
      lines.push(`- Action: ${r.recommendedAction}`);
      lines.push(`- Confidence: ${(r.confidence * 100).toFixed(0)}%`);
      lines.push(`- Impact: ${r.expectedImpact}`);
      lines.push(`- Limitations: ${r.limitations.join("; ")}`);
      lines.push("");
    }
  }
  lines.push("## Unresolved review");
  lines.push("");
  lines.push("- Publication requires `benchmark.definition.review`, `benchmark.observation.review`, `benchmark.publish`.");
  lines.push("- Candidate patterns remain unapproved and are excluded from criteria.");
  lines.push("");
  return `${lines.join("\n")}\n`;
}

export function renderPeerComparisonReport(
  peer: PeerComparisonResult,
): string {
  const lines: string[] = [];
  lines.push("# Benchmark Peer Comparison");
  lines.push("");
  lines.push(`- Cohort: **${peer.cohortLabel}**`);
  lines.push(`- Projects: ${peer.projects.map((p) => `\`${p}\``).join(", ")}`);
  lines.push(`- Benchmark: \`${peer.benchmarkId}\` v${peer.benchmarkVersion}`);
  lines.push(`- Generated: ${peer.generatedAt}`);
  const syntheticPeers = peer.projects.filter((p) => isSyntheticFixture(p));
  if (syntheticPeers.length) {
    lines.push(
      `- **Note:** Synthetic fixture project(s) in cohort: ${syntheticPeers.map((p) => `\`${p}\``).join(", ")} — not live market evidence.`,
    );
  }
  lines.push("");
  for (const w of peer.warnings) lines.push(`- Warning: ${w}`);
  lines.push("");
  lines.push(`- Strongest-supported conclusion: ${peer.strongestSupported}`);
  lines.push(`- Weakest-supported conclusion: ${peer.weakestSupported}`);
  lines.push("");
  lines.push("## Dimension cohort medians");
  lines.push("");
  lines.push("| Dimension | Median | Eligible |");
  lines.push("|---|---:|---|");
  for (const d of peer.dimensionComparisons) {
    lines.push(
      `| ${mdEscape(d.label)} | ${d.rawScore?.toFixed(1) ?? "—"} | ${d.eligible ? "yes" : "no"} |`,
    );
  }
  lines.push("");
  lines.push("## Concept gaps");
  lines.push("");
  lines.push("| Concept | Stronger | Weaker | Δ | Inconclusive |");
  lines.push("|---|---|---|---:|---|");
  for (const g of peer.gaps) {
    lines.push(
      `| ${g.conceptId} | ${g.stronger} | ${g.weaker} | ${g.delta.toFixed(1)} | ${g.inconclusive ? "yes" : "no"} |`,
    );
  }
  lines.push("");
  return `${lines.join("\n")}\n`;
}

export function writeBenchmarkReports(opts: {
  slugs: string[];
  peer: PeerComparisonResult | null;
  benchmarkId?: string;
}): string[] {
  const written: string[] = [];
  const root = process.cwd();
  const reportsDir = path.join(root, "reports");
  fs.mkdirSync(reportsDir, { recursive: true });

  const def = loadBenchmarkDefinition(opts.benchmarkId ?? "cfs-digital-capability");
  const frameworkPath = path.join(reportsDir, "benchmark-framework.md");
  fs.writeFileSync(
    frameworkPath,
    `# Benchmark Framework

## Definition

- **ID:** \`${def.id}\`
- **Name:** ${def.name}
- **Version:** ${def.version}
- **Status:** ${def.status}
- **Industry:** ${def.industry}

${def.description}

## Scope

${def.scope}

## Dimensions

| ID | Name | Weight |
|---|---|---:|
${def.dimensions.map((d) => `| ${d.id} | ${d.name} | ${d.weight} |`).join("\n")}

## Eligibility

- minMappedConcepts: ${def.eligibility_rules.minMappedConcepts}
- minEvidenceCoverage: ${def.eligibility_rules.minEvidenceCoverage}
- minEligibleDimensions: ${def.eligibility_rules.minEligibleDimensions}
- requiredDimensions: ${def.eligibility_rules.requiredDimensions.join(", ")}

## Missing-data policy

- unknownIsNotAbsent: true
- fabricateScores: false
- suppressOverallBelowCoverage: ${def.missing_data_policy.suppressOverallBelowCoverage}

## Notes

${def.notes}

Candidate patterns are **excluded** from scoring criteria until explicitly approved.
`,
    "utf8",
  );
  written.push(frameworkPath);

  for (const slug of opts.slugs) {
    const body = renderCompanyBenchmarkReport(slug, def.id);
    const rootReport = path.join(reportsDir, `benchmark-${slug}.md`);
    fs.writeFileSync(rootReport, body, "utf8");
    written.push(rootReport);
    const projectReport = path.join(
      root,
      "projects",
      slug,
      "reports",
      "benchmark-report.md",
    );
    fs.mkdirSync(path.dirname(projectReport), { recursive: true });
    fs.writeFileSync(projectReport, body, "utf8");
    written.push(projectReport);
  }

  if (opts.peer) {
    const peerPath = path.join(reportsDir, "benchmark-peer-comparison.md");
    fs.writeFileSync(peerPath, renderPeerComparisonReport(opts.peer), "utf8");
    written.push(peerPath);
  }

  // Evidence gaps rollup
  const gapLines = [
    "# Benchmark Evidence Gaps",
    "",
    `Benchmark: \`${def.id}\` v${def.version}`,
    "",
  ];
  for (const slug of opts.slugs) {
    const dir = projectBenchmarkDir(slug, def.id, def.version);
    const obs = JSON.parse(
      fs.readFileSync(`${dir}/observations.json`, "utf8"),
    ) as BenchmarkObservation[];
    const unknowns = obs.filter((o) => o.observedState === "unknown");
    const amb = obs.filter((o) => o.observedState === "ambiguous");
    gapLines.push(`## ${slug}`);
    gapLines.push(`- Unknown observations: ${unknowns.length}`);
    gapLines.push(`- Ambiguous observations: ${amb.length}`);
    const uniqUnknown = [...new Set(unknowns.map((o) => o.canonicalConceptId))];
    for (const c of uniqUnknown.slice(0, 30)) {
      gapLines.push(`- unknown: ${c}`);
    }
    gapLines.push("");
  }
  const gapsPath = path.join(reportsDir, "benchmark-evidence-gaps.md");
  fs.writeFileSync(gapsPath, `${gapLines.join("\n")}\n`, "utf8");
  written.push(gapsPath);

  writeJsonFile(path.join(reportsDir, "benchmark-run-index.json"), {
    benchmarkId: def.id,
    version: def.version,
    slugs: opts.slugs,
    written,
    generatedAt: new Date().toISOString(),
  });

  return written;
}
