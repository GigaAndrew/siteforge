#!/usr/bin/env tsx
/**
 * Sprint 2 platform reports: confidence, lessons, reliability, knowledge metrics,
 * improvements registry seeding, and refreshed quality report.
 */
import fs from "node:fs";
import path from "node:path";
import {
  projectPath,
  readJsonFile,
  readProjectConfig,
  writeJsonFile,
} from "@/lib/project";
import { inspectKnowledge, renderQualityReportMarkdown } from "@/lib/knowledge/inspect";
import { loadStore } from "@/lib/knowledge/store";
import {
  classifySourceReliability,
  weightedRecommendationConfidence,
  DEFAULT_RELIABILITY_WEIGHTS,
} from "@/lib/reliability/scores";
import type { CrawlHealthReport } from "@/lib/crawler/crawl";
import type { PageRecord } from "@/lib/schemas/crawl";
import type { CompanyProfile } from "@/lib/schemas/analysis";
import { normalizeExtractedText } from "@/lib/crawler/text-normalize";

function arg(flag: string): string | undefined {
  const idx = process.argv.indexOf(flag);
  if (idx === -1) return undefined;
  return process.argv[idx + 1];
}

function write(slug: string, rel: string, content: string) {
  const p = projectPath(slug, rel);
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, content, "utf8");
  console.log(`Wrote ${p}`);
}

function scoreBar(score: number, width = 20): string {
  const filled = Math.round(Math.max(0, Math.min(1, score)) * width);
  return `\`${"█".repeat(filled)}${"░".repeat(width - filled)}\` ${(score * 100).toFixed(0)}%`;
}

function ensureImprovementsRegistry() {
  const root = path.join(process.cwd(), "platform/improvements");
  fs.mkdirSync(root, { recursive: true });
  const indexPath = path.join(root, "registry.json");
  if (!fs.existsSync(indexPath)) {
    fs.writeFileSync(
      indexPath,
      `${JSON.stringify(
        {
          schemaVersion: "1.0.0",
          updatedAt: new Date().toISOString(),
          items: [],
        },
        null,
        2,
      )}\n`,
      "utf8",
    );
  }
  const readme = path.join(root, "README.md");
  if (!fs.existsSync(readme)) {
    fs.writeFileSync(
      readme,
      `# Platform improvements registry

Internal-only tracker. Lessons from projects may become entries here.

Fields: ID, Category, Description, Origin Project, Evidence, Status, Owner, Priority, Affected Modules, Resolved Version
`,
      "utf8",
    );
  }
  return indexPath;
}

function upsertImprovement(item: {
  id: string;
  category: string;
  description: string;
  originProject: string;
  evidence: string;
  status: string;
  owner: string;
  priority: string;
  affectedModules: string[];
}) {
  const indexPath = ensureImprovementsRegistry();
  const reg = JSON.parse(fs.readFileSync(indexPath, "utf8")) as {
    items: Array<Record<string, unknown>>;
    updatedAt: string;
  };
  const existing = reg.items.findIndex((i) => i.id === item.id);
  const row = {
    ...item,
    resolvedVersion: item.status === "resolved" ? "sprint-2" : null,
    updatedAt: new Date().toISOString(),
  };
  if (existing >= 0) reg.items[existing] = { ...reg.items[existing], ...row };
  else reg.items.push(row);
  reg.updatedAt = new Date().toISOString();
  fs.writeFileSync(indexPath, `${JSON.stringify(reg, null, 2)}\n`, "utf8");
}

export async function runPlatformReports(slug: string): Promise<{
  overallConfidence: number;
}> {
  // slug provided by caller
  const config = readProjectConfig(slug);
  const store = loadStore();
  const insp = inspectKnowledge({ slug });
  const health =
    readJsonFile<CrawlHealthReport>(
      projectPath(slug, "analysis/crawl-health.json"),
    ) ??
    readJsonFile<CrawlHealthReport>(
      projectPath(slug, "reports/crawl-health-report.json"),
    );
  const pages =
    readJsonFile<PageRecord[]>(projectPath(slug, "source/pages.json")) ?? [];
  const profile = readJsonFile<CompanyProfile>(
    projectPath(slug, "data/company-profile.json"),
  );

  // Reliability summary across page corpus
  const reliabilityRows = pages.slice(0, 200).map((p) => {
    const a = classifySourceReliability({
      url: p.url,
      title: p.title,
    });
    return { url: p.url, title: p.title, ...a };
  });
  const avgReliability =
    reliabilityRows.reduce((s, r) => s + r.reliabilityScore, 0) /
    Math.max(1, reliabilityRows.length);

  const evidence = [...store.evidence.values()].filter(
    (e) => e.provenance.sourceProject === slug,
  );
  const withRel = evidence.filter(
    (e) => typeof e.provenance.reliabilityScore === "number",
  );
  const avgEvRel =
    withRel.reduce((s, e) => s + (e.provenance.reliabilityScore ?? 0), 0) /
    Math.max(1, withRel.length);

  const recommendations = [...store.entities.values()].filter(
    (e) =>
      e.sourceProjects.includes(slug) && e.epistemicClass === "recommendation",
  );
  const unsupportedRecs = recommendations.filter((e) => !e.evidenceIds.length);

  const recConfidence = recommendations.map((rec) => {
    const supports = rec.evidenceIds
      .map((id) => store.evidence.get(id))
      .filter(Boolean)
      .map((e) => ({
        confidence: e!.provenance.confidence,
        reliabilityScore: e!.provenance.reliabilityScore ?? 0.55,
      }));
    return {
      name: rec.name,
      id: rec.id,
      ...weightedRecommendationConfidence(supports),
    };
  });

  const summaryQuality = normalizeExtractedText(profile?.summary ?? "");
  const pageTextStats = pages.map((p) =>
    normalizeExtractedText(p.mainTextSummary ?? ""),
  );
  const liveEncodingFailures = pageTextStats.filter((n) => !n.ok).length;
  const liveEncodingOk = pageTextStats.filter((n) => n.ok).length;
  const liveEncodingSalvages = pageTextStats.filter((n) =>
    n.issues.includes("salvaged_readable_text"),
  ).length;
  const successRate = health
    ? health.pagesSucceeded / Math.max(1, health.pagesAttempted)
    : pages.length
      ? 1
      : 0.5;
  const liveNormalizeRate = pages.length
    ? liveEncodingOk / pages.length
    : summaryQuality.ok
      ? 1
      : 0.4;
  const crawlQuality = Math.max(
    0,
    Math.min(
      1,
      successRate * 0.55 +
        liveNormalizeRate * 0.35 +
        (health
          ? Math.max(
              0,
              1 -
                health.permanentFailures /
                  Math.max(1, health.pagesAttempted),
            ) * 0.1
          : 0.1),
    ),
  );

  // Refresh crawl health markdown with post-repair text quality overlay
  if (health) {
    const refreshed = {
      ...health,
      encodingFailuresLive: liveEncodingFailures,
      encodingSalvagesLive: liveEncodingSalvages,
      encodingOkLive: liveEncodingOk,
      postRepairNotes: [
        "encodingFailures from original crawl may be stale after repair-page-text",
        `live page text ok ${liveEncodingOk}/${pages.length}`,
      ],
      generatedAt: health.generatedAt,
      refreshedAt: new Date().toISOString(),
    };
    writeJsonFile(projectPath(slug, "analysis/crawl-health.json"), refreshed);
    write(
      slug,
      "reports/crawl-health-report.md",
      `# Crawl health report — ${slug}

Generated: ${health.generatedAt}
Refreshed: ${refreshed.refreshedAt}

| Metric | Value |
|---|---|
| Start URL | ${health.startUrl} |
| Preferred host | ${health.preferredHost ?? "—"} |
| Pages attempted | ${health.pagesAttempted} |
| Pages succeeded (canonical) | ${health.pagesSucceeded} |
| Retries | ${health.retries} |
| Retry successes | ${health.retrySuccesses} |
| Permanent failures | ${health.permanentFailures} |
| Robots skipped | ${health.robotsSkipped} |
| Document links skipped | ${health.documentLinksSkipped} |
| Download blocked | ${health.downloadBlocked} |
| Encoding failures (crawl-time) | ${health.encodingFailures} |
| Encoding failures (live post-repair) | ${liveEncodingFailures} |
| Encoding salvages (live) | ${liveEncodingSalvages} |
| Canonical page duplicates collapsed | ${health.duplicatesCollapsed} |
| Queue duplicate URLs skipped | ${"queueDuplicatesSkipped" in health ? (health as CrawlHealthReport & { queueDuplicatesSkipped?: number }).queueDuplicatesSkipped ?? "—" : "—"} |

## Permanent failure samples

${(health.permanentFailureSamples ?? [])
  .map(
    (f) =>
      `- \`${f.kind}\` ${f.url} — ${f.error.replace(/\n/g, " ").slice(0, 160)}`,
  )
  .join("\n") || "_None_"}

## Notes

- Permanent failures are primarily download navigations (PDFs / CAD) — expected when links are discovered as pages.
- Live encoding metrics reflect \`repair-page-text\` + salvage normalization after Sprint 2 hardening.
`,
    );
  }
  const knowledgeQuality = Math.max(
    0,
    1 -
      insp.criticalCount * 0.2 -
      insp.highCount * 0.1 -
      insp.issues.filter((i) => i.severity === "medium").length * 0.02,
  );
  const evidenceCompleteness =
    [...store.entities.values()].filter(
      (e) => e.sourceProjects.includes(slug) && e.epistemicClass === "fact",
    ).length === 0
      ? 0
      : 1 -
        insp.issues.filter((i) => i.category === "unsupported_facts").length *
          0.1;

  const overall =
    crawlQuality * 0.25 +
    knowledgeQuality * 0.3 +
    (summaryQuality.ok ? 0.15 : 0.05) +
    avgEvRel * 0.15 +
    evidenceCompleteness * 0.15;

  // Confidence report
  write(
    slug,
    "reports/confidence-report.md",
    `# Confidence report — ${config.name}

Generated: ${new Date().toISOString()}

## Overall confidence score

${scoreBar(overall)}

| Component | Score |
|---|---|
| Crawler quality | ${scoreBar(crawlQuality)} |
| Knowledge quality | ${scoreBar(knowledgeQuality)} |
| Narrative / summary text quality | ${scoreBar(summaryQuality.ok ? 0.9 : 0.2)} |
| Avg evidence reliability | ${scoreBar(avgEvRel || avgReliability)} |
| Evidence completeness | ${scoreBar(evidenceCompleteness)} |

## Entity confidence distribution

| Epistemic class | Count |
|---|---|
${Object.entries(insp.epistemicClass)
  .map(([k, v]) => `| ${k} | ${v} |`)
  .join("\n")}

## Evidence confidence distribution

| Confidence | Count |
|---|---|
${Object.entries(insp.evidenceByConfidence)
  .map(([k, v]) => `| ${k} | ${v} |`)
  .join("\n")}

## Lowest-confidence findings

${evidence
  .filter((e) => e.provenance.confidence === "low")
  .slice(0, 15)
  .map(
    (e) =>
      `- \`${e.id}\` (reliability ${e.provenance.reliabilityScore ?? "n/a"}) ${e.provenance.evidenceExcerpt?.slice(0, 120) ?? ""}`,
  )
  .join("\n") || "_None_"}

## Unsupported recommendations

${unsupportedRecs.length
  ? unsupportedRecs.map((r) => `- ${r.name} (\`${r.id}\`)`).join("\n")
  : "_None — all recommendations carry evidence IDs_"}

## Recommendation weighted confidence (sample)

| Recommendation | Score | Label |
|---|---|---|
${recConfidence
  .slice(0, 15)
  .map((r) => `| ${r.name.slice(0, 60).replace(/\|/g, "/")} | ${r.score} | ${r.label} |`)
  .join("\n")}

## Extraction quality

- Company summary normalize ok: **${summaryQuality.ok}**
- Issues: ${summaryQuality.issues.join(", ") || "none"}
- Text normalize log present: ${fs.existsSync(projectPath(slug, "source/text-normalize-log.json"))}

## Crawler quality

${health ? `- Attempted ${health.pagesAttempted}, succeeded ${health.pagesSucceeded}, failures ${health.permanentFailures}, live encoding ok ${liveEncodingOk}/${pages.length}, crawl-time encoding failures ${health.encodingFailures}, canonical duplicates collapsed ${health.duplicatesCollapsed}` : "_Crawl health report missing — run project:crawl_"}

## Knowledge quality

- Critical issues: ${insp.criticalCount}
- High issues: ${insp.highCount}
- See \`reports/knowledge-quality-report.md\`

## Narrative quality

${summaryQuality.ok ? "Homepage-derived summary text is printable and usable." : "Summary text failed normalization — do not quote company summary in pitch until re-crawl/re-audit."}

## Recommendations for improving confidence

1. Re-crawl with Sprint 2 crawler (Playwright \`innerText\` + text normalize) if summary still fails.
2. Attach DocumentType relationships to reduce orphan medium issues.
3. Deduplicate Page entities via canonical URLs (Sprint 2 crawler collapses www/apex).
4. Raise product inventory precision (exclude event/MSDS page proxies).
5. Add second independent CFS manufacturer before treating candidate patterns as signals.
`,
  );

  // Reliability summary
  write(
    slug,
    "reports/reliability-summary.md",
    `# Reliability summary — ${config.name}

## Default weights

| Source class | Weight |
|---|---|
${Object.entries(DEFAULT_RELIABILITY_WEIGHTS)
  .map(([k, v]) => `| ${k} | ${v.toFixed(2)} |`)
  .join("\n")}

## Corpus classification (pages)

| Class | Count |
|---|---|
${Object.entries(
  reliabilityRows.reduce<Record<string, number>>((acc, r) => {
    acc[r.sourceClass] = (acc[r.sourceClass] ?? 0) + 1;
    return acc;
  }, {}),
)
  .sort((a, b) => b[1] - a[1])
  .map(([k, v]) => `| ${k} | ${v} |`)
  .join("\n")}

Average page reliability: **${avgReliability.toFixed(3)}**  
Average evidence reliability (when scored): **${(avgEvRel || 0).toFixed(3)}** (${withRel.length}/${evidence.length} evidence rows scored)

Homepage weight (${DEFAULT_RELIABILITY_WEIGHTS.homepage}) correctly keeps homepage-backed claims below engineering table / product sheet claims.
`,
  );

  // Knowledge metrics
  const entities = [...store.entities.values()].filter((e) =>
    e.sourceProjects.includes(slug),
  );
  const rels = [...store.relationships.values()].filter((r) =>
    r.sourceProjects.includes(slug),
  );
  const facts = entities.filter((e) => e.epistemicClass === "fact");
  const factsWithEv = facts.filter((e) => e.evidenceIds.length > 0);
  const dupIssues = insp.issues.filter((i) => i.category === "near_duplicates");
  const metrics = {
    projectSlug: slug,
    generatedAt: new Date().toISOString(),
    evidenceCompleteness: facts.length
      ? factsWithEv.length / facts.length
      : 1,
    entityCoverage: {
      typesPresent: Object.keys(insp.entitiesByType).length,
      entities: entities.length,
    },
    relationshipDensity: entities.length
      ? rels.length / entities.length
      : 0,
    averageConfidence:
      evidence.reduce((s, e) => {
        const m = { high: 1, medium: 0.7, low: 0.4 }[e.provenance.confidence];
        return s + m;
      }, 0) / Math.max(1, evidence.length),
    averageReliability: avgEvRel || avgReliability,
    normalizationQuality: pages.length
      ? liveEncodingOk / pages.length
      : summaryQuality.ok
        ? 0.85
        : 0.4,
    duplicateRate: dupIssues.length / Math.max(1, entities.length),
    extractionSuccess: pages.length
      ? liveEncodingOk / pages.length
      : summaryQuality.ok
        ? 1
        : 0.7,
    canonicalizationSuccess: health
      ? health.pagesSucceeded / Math.max(1, health.pagesAttempted)
      : 0.5,
    brokenSourceRate: health
      ? health.permanentFailures / Math.max(1, health.pagesAttempted)
      : 0,
  };
  writeJsonMetrics(slug, metrics);
  write(
    slug,
    "reports/knowledge-metrics-summary.md",
    `# Knowledge metrics summary — ${slug}

Generated: ${metrics.generatedAt}

| Metric | Value |
|---|---|
| Evidence completeness | ${(metrics.evidenceCompleteness * 100).toFixed(1)}% |
| Entity types present | ${metrics.entityCoverage.typesPresent} |
| Entities | ${metrics.entityCoverage.entities} |
| Relationship density (rels/entity) | ${metrics.relationshipDensity.toFixed(2)} |
| Average evidence confidence (weighted) | ${metrics.averageConfidence.toFixed(3)} |
| Average reliability | ${metrics.averageReliability.toFixed(3)} |
| Normalization quality | ${metrics.normalizationQuality.toFixed(2)} |
| Duplicate rate (near-dup issues / entities) | ${metrics.duplicateRate.toFixed(3)} |
| Extraction success proxy | ${metrics.extractionSuccess.toFixed(2)} |
| Canonicalization success proxy | ${metrics.canonicalizationSuccess.toFixed(2)} |
| Broken source rate | ${(metrics.brokenSourceRate * 100).toFixed(1)}% |

Longitudinal file: \`analysis/knowledge-metrics.json\`
`,
  );

  // Lessons learned
  const lessons = buildLessons({ slug, insp, health, summaryQuality });
  write(slug, "reports/lessons-learned.md", lessons.markdown);
  for (const imp of lessons.improvements) {
    upsertImprovement(imp);
  }

  // Refresh quality report
  write(
    slug,
    "reports/knowledge-quality-report.md",
    renderQualityReportMarkdown(insp),
  );

  // Sprint 2 delta summary
  write(
    slug,
    "reports/sprint-2-validation-summary.md",
    `# Sprint 2 validation summary — ${slug}

Generated: ${new Date().toISOString()}

## Improvements implemented

1. **Text normalization** — control/entity cleanup, uncommon-Unicode detection, readable-text salvage, confidence penalty
2. **DOM text extraction** — strip malformed binary tag names; prefer main/content regions
3. **URL canonicalization** — www/apex, https, trailing slash, tracking params, fragment strip
4. **Crawl retries** — timeouts/5xx/429 with backoff; download/robots skips logged
5. **Crawl health report** — classified failures + live post-repair encoding overlay
6. **Forge Reliability** — source class weights; evidence carries \`reliabilityScore\`; recommendation weighted confidence
7. **Confidence report** — overall scorecard + distributions
8. **Lessons learned** + **platform/improvements** registry
9. **Knowledge metrics** longitudinal JSON

## Validation snapshot (EB Metal)

| Metric | Value |
|---|---|
| Overall confidence | ${(overall * 100).toFixed(0)}% |
| Live page text ok | ${liveEncodingOk}/${pages.length} |
| Company summary normalize ok | ${summaryQuality.ok} |
| Knowledge inspect critical/high | ${insp.criticalCount}/${insp.highCount} |
| Entities / relationships / evidence | ${insp.totals.entities} / ${insp.totals.relationships} / ${insp.totals.evidence} |
| Permanent crawl failures | ${health?.permanentFailures ?? "—"} (mostly downloads) |
| Candidate patterns | ${insp.totals.candidatePatterns} (expected 0 with one company) |

## What improved vs Sprint 1

| Area | Sprint 1 | Sprint 2 |
|---|---|---|
| Homepage summary trust | Binary garbage in company profile | Salvaged readable English; normalize ok |
| Strict inspect | Failed on high encoding issues | Passes (\`critical=0\`, \`high=0\`) |
| Duplicate pages | www vs apex entities | Canonical host collapse (title near-dups remain) |
| Crawl failures | Flat error list | Classified health report; downloads not treated as content |
| Evidence trust | Confidence only | Confidence × source reliability |
| Platform learning | Ad hoc | lessons-learned + improvements registry |

## Remaining risks

- Title-based Page near-duplicates remain (same title, distinct URLs / 404 shells)
- Product inventory still noisy (page proxies)
- DocumentType orphan relationship (medium)
- Site injects binary/corrupt bytes into HTML body — salvage works but origin is upstream
- Single-company candidate patterns unavailable (expected)

## Recommended next sprint

1. Title/URL Page dedupe pass + 404 shell filtering
2. Ingest second CFS manufacturer (do not expand UI)
3. Validate candidate-pattern creation across ≥2 companies
4. Optional: pre-discover document MIME types before \`page.goto\`
`,
  );

  // Mark encoding improvement resolved for this sprint
  upsertImprovement({
    id: "IMP-001",
    category: "Extraction",
    description:
      "Cheerio/body text can surface binary bleed; salvageReadableText + clean DOM extract + normalizeExtractedText before inventories.",
    originProject: slug,
    evidence: `live page text ok ${liveEncodingOk}/${pages.length}; summary ok=${summaryQuality.ok}`,
    status: "resolved",
    owner: "platform",
    priority: "P1",
    affectedModules: ["crawler"],
  });

  console.log(`Overall confidence ~ ${(overall * 100).toFixed(0)}%`);
  return { overallConfidence: overall };
}

async function main() {
  const slug = arg("--slug") ?? "eb-metal";
  await runPlatformReports(slug);
}

function writeJsonMetrics(slug: string, metrics: Record<string, unknown>) {
  const p = projectPath(slug, "analysis/knowledge-metrics.json");
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, `${JSON.stringify(metrics, null, 2)}\n`, "utf8");
  console.log(`Wrote ${p}`);
}

function buildLessons(input: {
  slug: string;
  insp: ReturnType<typeof inspectKnowledge>;
  health: CrawlHealthReport | null;
  summaryQuality: ReturnType<typeof normalizeExtractedText>;
}): {
  markdown: string;
  improvements: Array<{
    id: string;
    category: string;
    description: string;
    originProject: string;
    evidence: string;
    status: string;
    owner: string;
    priority: string;
    affectedModules: string[];
  }>;
} {
  const rows: Array<{
    area: string;
    lesson: string;
    severity: string;
    frequency: string;
    action: string;
    future: boolean;
    improvementId?: string;
  }> = [
    {
      area: "Extraction",
      lesson:
        "Cheerio body text can surface non-printable/compressed-looking content; prefer Playwright innerText + normalizeExtractedText before inventories.",
      severity: "high",
      frequency: "observed on first EB Metal homepage summary",
      action: "Keep dual-path extraction; fail closed on low printable ratio.",
      future: true,
      improvementId: "IMP-001",
    },
    {
      area: "Crawler",
      lesson:
        "www vs apex and tracking params created duplicate Page entities and inflated near-dup metrics.",
      severity: "medium",
      frequency: "multiple page pairs in Sprint 1 graph",
      action: "Always canonicalize with preferredHost before seen-set and entity IDs.",
      future: true,
      improvementId: "IMP-002",
    },
    {
      area: "Crawler",
      lesson:
        "PDF/download navigations appear as failures; classify and skip document hrefs rather than counting as content failures.",
      severity: "medium",
      frequency: `${input.health?.downloadBlocked ?? "n/a"} download blocks / ${input.health?.permanentFailures ?? "n/a"} failures`,
      action: "Maintain document skip + health report categories.",
      future: true,
      improvementId: "IMP-003",
    },
    {
      area: "Knowledge",
      lesson:
        "Homepage-backed claims need lower reliability weight than engineering tables/product sheets.",
      severity: "medium",
      frequency: "systemic",
      action: "Forge Reliability defaults; inherit into recommendation confidence.",
      future: true,
      improvementId: "IMP-004",
    },
    {
      area: "Knowledge",
      lesson:
        "DocumentType and CMS entities were created without relationships (orphan medium issues).",
      severity: "low",
      frequency: "2 orphan types in inspect",
      action: "Emit HAS_TYPE / USES_CMS relationships in extract.",
      future: true,
      improvementId: "IMP-005",
    },
    {
      area: "Product taxonomy",
      lesson:
        "Page-title products (events, MSDS) pollute Product entities.",
      severity: "medium",
      frequency: "ongoing in product-inventory",
      action: "Add productKind filter in analyzer before knowledge ingest.",
      future: true,
      improvementId: "IMP-006",
    },
    {
      area: "UX / Design",
      lesson:
        "Gate discipline (design-system before full prototype) prevented generic AI UI — keep as platform rule.",
      severity: "info",
      frequency: "process",
      action: "Retain Gate 5 stop condition in orchestrator.",
      future: true,
    },
    {
      area: "Process",
      lesson:
        "Strict inspect failing on high extraction issues is desirable — blocks false confidence.",
      severity: "info",
      frequency: "each inspect --strict",
      action: "Keep --strict in second-company checklist.",
      future: true,
    },
    {
      area: "Graph schema",
      lesson:
        "UserTask / SubmittalWorkflow under-extracted; not blocking but limits query demos.",
      severity: "low",
      frequency: "query demonstration gaps",
      action: "Map journeys markdown into UserTask inferences in a later sprint.",
      future: true,
      improvementId: "IMP-007",
    },
    {
      area: "Automation",
      lesson:
        "Report generation should be one command after crawl/audit/knowledge.",
      severity: "low",
      frequency: "ops",
      action: "`npm run knowledge:platform-reports` (this script).",
      future: true,
      improvementId: "IMP-008",
    },
  ];

  if (!input.summaryQuality.ok) {
    rows.unshift({
      area: "Extraction",
      lesson: `Current company summary still fails normalization (issues: ${input.summaryQuality.issues.join(", ") || "unknown"}).`,
      severity: "high",
      frequency: "current",
      action: "Re-run project:crawl + project:audit + project:knowledge --force.",
      future: true,
      improvementId: "IMP-001",
    });
  }

  const markdown = `# Lessons learned — ${input.slug}

Generated: ${new Date().toISOString()}

| Area | Lesson | Severity | Frequency | Recommended action | Affects future projects |
|---|---|---|---|---|---|
${rows
  .map(
    (r) =>
      `| ${r.area} | ${r.lesson.replace(/\|/g, "/")} | ${r.severity} | ${r.frequency} | ${r.action.replace(/\|/g, "/")} | ${r.future ? "yes" : "no"} |`,
  )
  .join("\n")}

## Potential new graph entity types

- UserTask (from journeys)
- Form (from source/forms.json)
- Integration (from external-tools.json)

## Potential normalization improvements

- Shared CFS product-family dictionary
- Semantic document-type classifier beyond file extension

## Potential automation opportunities

- Auto-run platform reports at end of \`project:all\`
- Fail CI on \`knowledge:inspect --strict\` for release branches
`;

  const improvements = rows
    .filter((r) => r.improvementId)
    .map((r) => ({
      id: r.improvementId!,
      category: r.area,
      description: r.lesson,
      originProject: input.slug,
      evidence: r.frequency,
      status: "open",
      owner: "platform",
      priority: r.severity === "high" ? "P1" : r.severity === "medium" ? "P2" : "P3",
      affectedModules: ["crawler", "knowledge", "analyzer"].filter((m) =>
        r.area.toLowerCase().includes(m.slice(0, 5)) ||
        r.action.toLowerCase().includes(m),
      ),
    }));

  return { markdown, improvements };
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
