import { registerCapability } from "@/forge-core/capabilities/registry";
import type {
  CapabilityContext,
  CapabilityHandler,
  CapabilityResult,
} from "@/forge-core/capabilities/types";
import { allArtifacts, hasArtifact } from "@/forge-core/capabilities/artifacts";
import { crawlProject } from "@/lib/crawler/crawl";
import { repairPageText } from "@/lib/crawler/repair";
import {
  needsTextRepair,
  normalizeExtractedText,
} from "@/lib/crawler/text-normalize";
import { captureScreenshots } from "@/lib/screenshots/capture";
import { ingestProjectKnowledge } from "@/lib/knowledge/ingest";
import { inspectKnowledge } from "@/lib/knowledge/inspect";
import {
  runAuditPipeline,
  runStrategyPipeline,
} from "@/lib/analyzer/pipeline";
import {
  projectPath,
  readJsonFile,
  updateProjectStage,
  writeJsonFile,
} from "@/lib/project";
import type { PageRecord } from "@/lib/schemas/crawl";
import {
  classifySourceReliability,
  DEFAULT_RELIABILITY_WEIGHTS,
} from "@/lib/reliability/scores";
import { runPlatformReports } from "@/scripts/generate-platform-reports";
import { generateThinPrototype } from "@/lib/prototype/thin";
import { generateThinPitch } from "@/lib/pitch/thin";
import { runThinBrowserQa } from "@/lib/qa/browser-thin";
import { loadApprovals } from "@/forge-core/state/persist";

function okResult(
  partial: Partial<CapabilityResult> & { artifacts: string[] },
): CapabilityResult {
  return {
    ok: true,
    qualityFindings: [],
    confidenceDelta: 0.05,
    qualityScore: 0.8,
    blockingIssues: [],
    suggestedInvalidations: [],
    metrics: {},
    ...partial,
  };
}

function failResult(message: string, blocking: string[] = [message]): CapabilityResult {
  return {
    ok: false,
    artifacts: [],
    qualityFindings: [
      { severity: "high", code: "capability_failed", message },
    ],
    confidenceDelta: 0,
    qualityScore: 0,
    blockingIssues: blocking,
    suggestedInvalidations: [],
    metrics: {},
    message,
  };
}

function pagesNeedRepair(slug: string): boolean {
  const pages =
    readJsonFile<PageRecord[]>(projectPath(slug, "source/pages.json")) ?? [];
  if (!pages.length) return true;
  return pages.some((p) => needsTextRepair(p.mainTextSummary));
}

function extractionHealth(slug: string): {
  total: number;
  good: number;
  bad: number;
  homepageOk: boolean;
} {
  const pages =
    readJsonFile<PageRecord[]>(projectPath(slug, "source/pages.json")) ?? [];
  let good = 0;
  for (const p of pages) {
    if (!needsTextRepair(p.mainTextSummary)) good += 1;
  }
  const home = pages.find((p) => {
    try {
      const pathName = new URL(p.url).pathname;
      return pathName === "/" || pathName === "";
    } catch {
      return false;
    }
  });
  const homepageOk = home
    ? normalizeExtractedText(home.mainTextSummary || "").ok
    : good > 0;
  return { total: pages.length, good, bad: pages.length - good, homepageOk };
}

function auditComplete(slug: string): boolean {
  return allArtifacts(slug, [
    "analysis/executive-audit.md",
    "analysis/technical-audit.md",
    "analysis/accessibility-audit.md",
    "analysis/seo-audit.md",
    "analysis/performance-audit.md",
  ]);
}

const crawl: CapabilityHandler = {
  descriptor: {
    name: "crawl.run",
    purpose: "Crawl approved hosts into source inventories",
    consumes: ["config.json"],
    produces: ["source/pages.json", "reports/crawl-health-report.md"],
    prerequisites: [],
    completionCriteria: ["source/pages.json present with >=1 page"],
    estimatedCost: 2,
    estimatedRuntimeMs: 120000,
    confidenceGain: 0.25,
    qualityGates: ["crawl_pages_present"],
    failureConditions: ["zero_pages"],
    retryPolicy: { maxRetries: 1, backoffMs: 2000 },
    humanApprovalRequirement: null,
    plannerWeight: 100,
  },
  isComplete: (ctx) => {
    const pages =
      readJsonFile<PageRecord[]>(projectPath(ctx.slug, "source/pages.json")) ??
      [];
    return pages.length > 0 && !ctx.force;
  },
  execute: async (ctx) => {
    const result = await crawlProject(ctx.slug);
    updateProjectStage(ctx.slug, "evidence_collected");
    return okResult({
      artifacts: ["source/pages.json", "reports/crawl-health-report.md"],
      confidenceDelta: 0.25,
      qualityScore: result.pagesCrawled > 0 ? 0.75 : 0.2,
      metrics: {
        pagesCrawled: result.pagesCrawled,
        errors: result.errors,
      },
      ok: result.pagesCrawled > 0,
      blockingIssues: result.pagesCrawled > 0 ? [] : ["zero_pages"],
    });
  },
};

const extraction: CapabilityHandler = {
  descriptor: {
    name: "extraction.repair",
    purpose: "Repair/normalize page text when encoding quality is poor",
    consumes: ["source/pages.json"],
    produces: ["source/pages.json", "source/text-normalize-log.json"],
    prerequisites: ["crawl.run"],
    completionCriteria: ["page texts pass normalizeExtractedText"],
    estimatedCost: 1,
    estimatedRuntimeMs: 90000,
    confidenceGain: 0.15,
    qualityGates: ["text_normalize_ok"],
    failureConditions: ["pages_still_need_repair"],
    retryPolicy: {
      maxRetries: 1,
      backoffMs: 1000,
      alternateCapability: "crawl.run",
    },
    humanApprovalRequirement: null,
    plannerWeight: 95,
  },
  isComplete: (ctx) => {
    if (ctx.force) return false;
    if (!hasArtifact(ctx.slug, "source/pages.json")) return false;
    const h = extractionHealth(ctx.slug);
    return h.homepageOk && h.total > 0 && h.good / h.total >= 0.65;
  },
  execute: async (ctx) => {
    const before = extractionHealth(ctx.slug);
    if (before.homepageOk && before.good / Math.max(1, before.total) >= 0.65 && !ctx.force) {
      return okResult({
        artifacts: ["source/pages.json"],
        message: `Extraction acceptable (${before.good}/${before.total} pages)`,
        qualityScore: before.good / before.total,
        qualityFindings:
          before.bad > 0
            ? [
                {
                  severity: "medium",
                  code: "partial_text_quality",
                  message: `${before.bad} pages still need repair`,
                },
              ]
            : [],
      });
    }
    const result = await repairPageText(ctx.slug, { forceAll: !!ctx.force });
    const after = extractionHealth(ctx.slug);
    const ok =
      after.homepageOk && after.total > 0 && after.good / after.total >= 0.65;
    return {
      ok,
      artifacts: ["source/pages.json", "source/text-normalize-log.json"],
      qualityFindings:
        after.bad > 0
          ? [
              {
                severity: ok ? "medium" : "high",
                code: "pages_still_need_repair",
                message: `${after.bad}/${after.total} pages still need repair`,
              },
            ]
          : [],
      confidenceDelta: ok ? 0.12 : 0,
      qualityScore: after.total ? after.good / after.total : 0,
      blockingIssues: ok ? [] : ["pages_still_need_repair"],
      suggestedInvalidations: ok ? ["n_knowledge"] : [],
      metrics: {
        repaired: result.repaired,
        total: result.total,
        good: after.good,
        bad: after.bad,
      },
      message: ok
        ? `Extraction acceptable after repair (${after.good}/${after.total})`
        : `Extraction quality too low (${after.good}/${after.total})`,
    };
  },
};

const screenshots: CapabilityHandler = {
  descriptor: {
    name: "screenshots.capture",
    purpose: "Capture current-site screenshots",
    consumes: ["source/pages.json"],
    produces: ["screenshots/manifest.json"],
    prerequisites: ["crawl.run"],
    completionCriteria: ["screenshots/manifest.json"],
    estimatedCost: 1,
    estimatedRuntimeMs: 60000,
    confidenceGain: 0.05,
    qualityGates: [],
    failureConditions: [],
    retryPolicy: { maxRetries: 1, backoffMs: 1000 },
    humanApprovalRequirement: null,
    plannerWeight: 70,
  },
  isComplete: (ctx) =>
    hasArtifact(ctx.slug, "screenshots/manifest.json") && !ctx.force,
  execute: async (ctx) => {
    await captureScreenshots(ctx.slug);
    return okResult({
      artifacts: ["screenshots/manifest.json"],
      qualityScore: 0.7,
    });
  },
};

const knowledge: CapabilityHandler = {
  descriptor: {
    name: "knowledge.build",
    purpose: "Extract and ingest Forge Knowledge for the project",
    consumes: ["data/*", "source/pages.json"],
    produces: ["knowledge/extract-manifest.json"],
    prerequisites: ["extraction.repair"],
    completionCriteria: ["extract-manifest", "inspect critical/high = 0"],
    estimatedCost: 1,
    estimatedRuntimeMs: 15000,
    confidenceGain: 0.2,
    qualityGates: ["knowledge_integrity"],
    failureConditions: ["inspect_critical_or_high"],
    retryPolicy: { maxRetries: 1, backoffMs: 500 },
    humanApprovalRequirement: null,
    plannerWeight: 90,
  },
  isComplete: (ctx) => {
    if (ctx.force) return false;
    if (!hasArtifact(ctx.slug, "knowledge/extract-manifest.json")) return false;
    const insp = inspectKnowledge({ slug: ctx.slug });
    return insp.criticalCount === 0 && insp.highCount === 0;
  },
  execute: async (ctx) => {
    // Ensure inventories exist for extract
    if (!hasArtifact(ctx.slug, "data/company-profile.json")) {
      const { generateEvidenceArtifacts } = await import(
        "@/lib/analyzer/pipeline"
      );
      generateEvidenceArtifacts(ctx.slug);
    }
    const result = ingestProjectKnowledge({
      slug: ctx.slug,
      force: true,
    });
    const insp = inspectKnowledge({ slug: ctx.slug });
    const blocked =
      ctx.policies.knowledgeCriticalHighMustBeZero &&
      (insp.criticalCount > 0 || insp.highCount > 0);
    return {
      ok: !blocked && !result.skipped,
      artifacts: ["knowledge/extract-manifest.json"],
      qualityFindings: insp.issues.slice(0, 20).map((i) => ({
        severity: i.severity,
        code: i.category,
        message: i.message,
      })),
      confidenceDelta: blocked ? 0 : 0.2,
      qualityScore: blocked ? 0.4 : 0.85,
      blockingIssues: blocked
        ? [`inspect_critical=${insp.criticalCount},high=${insp.highCount}`]
        : [],
      suggestedInvalidations: [],
      metrics: {
        entities: result.entityCount,
        evidence: result.evidenceCount,
      },
    };
  },
};

const reliability: CapabilityHandler = {
  descriptor: {
    name: "reliability.score",
    purpose: "Score source reliability across crawled pages",
    consumes: ["source/pages.json"],
    produces: ["analysis/reliability-batch.json"],
    prerequisites: ["knowledge.build"],
    completionCriteria: ["reliability-batch.json"],
    estimatedCost: 0.2,
    estimatedRuntimeMs: 2000,
    confidenceGain: 0.08,
    qualityGates: [],
    failureConditions: [],
    retryPolicy: { maxRetries: 0, backoffMs: 0 },
    humanApprovalRequirement: null,
    plannerWeight: 60,
  },
  isComplete: (ctx) =>
    hasArtifact(ctx.slug, "analysis/reliability-batch.json") && !ctx.force,
  execute: async (ctx) => {
    const pages =
      readJsonFile<PageRecord[]>(projectPath(ctx.slug, "source/pages.json")) ??
      [];
    const rows = pages.map((p) => {
      const scored = classifySourceReliability({ url: p.url, title: p.title });
      return { url: p.url, ...scored };
    });
    const avg =
      rows.reduce((s, r) => s + r.reliabilityScore, 0) / Math.max(1, rows.length);
    writeJsonFile(projectPath(ctx.slug, "analysis/reliability-batch.json"), {
      generatedAt: new Date().toISOString(),
      average: avg,
      defaults: DEFAULT_RELIABILITY_WEIGHTS,
      rows: rows.slice(0, 500),
    });
    return okResult({
      artifacts: ["analysis/reliability-batch.json"],
      qualityScore: avg,
      confidenceDelta: 0.08,
      metrics: { averageReliability: avg, pages: rows.length },
    });
  },
};

function makeAuditHandler(
  name: string,
  artifact: string,
  weight: number,
): CapabilityHandler {
  return {
    descriptor: {
      name,
      purpose: `Run audit facet producing ${artifact}`,
      consumes: ["source/pages.json"],
      produces: [artifact],
      prerequisites: ["crawl.run"],
      completionCriteria: [artifact],
      estimatedCost: 0.5,
      estimatedRuntimeMs: 5000,
      confidenceGain: 0.08,
      qualityGates: ["audit_artifact"],
      failureConditions: [],
      retryPolicy: { maxRetries: 1, backoffMs: 500 },
      humanApprovalRequirement: null,
      plannerWeight: weight,
    },
    isComplete: (ctx) => hasArtifact(ctx.slug, artifact) && !ctx.force,
    execute: async (ctx) => {
      if (!auditComplete(ctx.slug) || ctx.force) {
        runAuditPipeline(ctx.slug);
        updateProjectStage(ctx.slug, "audit_generated");
      }
      const ok = hasArtifact(ctx.slug, artifact);
      return ok
        ? okResult({ artifacts: [artifact], qualityScore: 0.8 })
        : failResult(`Missing ${artifact}`);
    },
  };
}

const strategy: CapabilityHandler = {
  descriptor: {
    name: "strategy.generate",
    purpose: "Generate strategy and art direction packages",
    consumes: ["analysis/*"],
    produces: ["design/design-tokens.json", "strategy/ux-strategy.md"],
    prerequisites: ["audit.technical"],
    completionCriteria: ["design tokens"],
    estimatedCost: 1,
    estimatedRuntimeMs: 8000,
    confidenceGain: 0.15,
    qualityGates: ["strategy_artifacts"],
    failureConditions: [],
    retryPolicy: { maxRetries: 1, backoffMs: 500 },
    humanApprovalRequirement: null,
    plannerWeight: 55,
  },
  isComplete: (ctx) =>
    hasArtifact(ctx.slug, "design/design-tokens.json") && !ctx.force,
  execute: async (ctx) => {
    runStrategyPipeline(ctx.slug);
    updateProjectStage(ctx.slug, "art_direction_ready");
    return hasArtifact(ctx.slug, "design/design-tokens.json")
      ? okResult({
          artifacts: [
            "design/design-tokens.json",
            "strategy/ux-strategy.md",
          ],
          qualityScore: 0.75,
        })
      : failResult("Strategy artifacts missing after generate");
  },
};

const approvalGate: CapabilityHandler = {
  descriptor: {
    name: "approval.gate",
    purpose: "Human approval checkpoint (no side effects)",
    consumes: [],
    produces: [],
    prerequisites: [],
    completionCriteria: ["approval decision approved"],
    estimatedCost: 0,
    estimatedRuntimeMs: 0,
    confidenceGain: 0,
    qualityGates: [],
    failureConditions: ["rejected"],
    retryPolicy: { maxRetries: 0, backoffMs: 0 },
    humanApprovalRequirement: "dynamic",
    plannerWeight: 40,
  },
  isComplete: (ctx) => {
    const key = ctx.node.approvalKey;
    if (!key) return true;
    if (!ctx.policies.pauseApprovalKeys.includes(key)) return true;
    const approvals = loadApprovals(ctx.slug);
    const d = approvals?.decisions.find((x) => x.key === key);
    return d?.status === "approved";
  },
  execute: async (ctx) => {
    const key = ctx.node.approvalKey;
    if (!key || !ctx.policies.pauseApprovalKeys.includes(key)) {
      return okResult({
        artifacts: [],
        message: "Auto-approved by policy",
        qualityScore: 1,
      });
    }
    const approvals = loadApprovals(ctx.slug);
    const d = approvals?.decisions.find((x) => x.key === key);
    if (d?.status === "approved") {
      return okResult({
        artifacts: [],
        message: `Approved: ${key}`,
        qualityScore: 1,
      });
    }
    if (d?.status === "rejected") {
      return failResult(`Approval rejected: ${key}`);
    }
    return {
      ok: false,
      artifacts: [],
      qualityFindings: [],
      confidenceDelta: 0,
      qualityScore: 0,
      blockingIssues: [`awaiting_approval:${key}`],
      suggestedInvalidations: [],
      metrics: {},
      message: `Waiting approval: ${key}`,
    };
  },
};

const prototype: CapabilityHandler = {
  descriptor: {
    name: "prototype.generate",
    version: "0.1.0-thin",
    demoOnly: true,
    purpose: "Thin prototype package for runtime demo",
    consumes: ["design/design-tokens.json"],
    produces: ["prototype/manifest.json"],
    prerequisites: ["strategy.generate"],
    completionCriteria: ["prototype/manifest.json"],
    estimatedCost: 0.5,
    estimatedRuntimeMs: 2000,
    confidenceGain: 0.1,
    qualityGates: ["prototype_manifest"],
    failureConditions: [],
    retryPolicy: { maxRetries: 1, backoffMs: 200 },
    humanApprovalRequirement: null,
    plannerWeight: 35,
  },
  isComplete: (ctx) =>
    hasArtifact(ctx.slug, "prototype/manifest.json") && !ctx.force,
  execute: async (ctx) => {
    const result = generateThinPrototype(ctx.slug);
    if (result.ok) updateProjectStage(ctx.slug, "design_system_ready");
    return {
      ok: result.ok,
      artifacts: result.ok
        ? ["prototype/manifest.json", "prototype/STATUS.md"]
        : [],
      qualityFindings: result.ok
        ? []
        : [
            {
              severity: "high",
              code: "prototype_failed",
              message: result.message,
            },
          ],
      confidenceDelta: result.ok ? 0.1 : 0,
      qualityScore: result.qualityScore,
      blockingIssues: result.ok ? [] : [result.message],
      suggestedInvalidations: [],
      metrics: { routes: result.routes.length },
      message: result.message,
    };
  },
};

const browserQa: CapabilityHandler = {
  descriptor: {
    name: "qa.browser",
    version: "0.1.0-thin",
    demoOnly: true,
    purpose: "Thin browser smoke + axe against prototype routes",
    consumes: ["prototype/manifest.json"],
    produces: ["qa/browser-qa.json"],
    prerequisites: ["prototype.generate"],
    completionCriteria: ["browser-qa ok"],
    estimatedCost: 1,
    estimatedRuntimeMs: 30000,
    confidenceGain: 0.1,
    qualityGates: ["browser_qa"],
    failureConditions: ["broken_routes"],
    retryPolicy: { maxRetries: 1, backoffMs: 1000 },
    humanApprovalRequirement: null,
    plannerWeight: 34,
  },
  isComplete: (ctx) => {
    if (ctx.force) return false;
    const qa = readJsonFile<{ ok?: boolean }>(
      projectPath(ctx.slug, "qa/browser-qa.json"),
    );
    return qa?.ok === true;
  },
  execute: async (ctx) => {
    const result = await runThinBrowserQa(ctx.slug);
    if (result.ok) updateProjectStage(ctx.slug, "qa_in_progress");
    return {
      ok: result.ok,
      artifacts: ["qa/browser-qa.json", "qa/browser-qa.md"],
      qualityFindings: result.broken.map((r) => ({
        severity: "high" as const,
        code: "broken_route",
        message: r,
      })),
      confidenceDelta: result.ok ? 0.1 : 0,
      qualityScore: result.qualityScore,
      blockingIssues: result.ok ? [] : result.broken,
      suggestedInvalidations: result.ok ? [] : ["n_prototype"],
      metrics: {
        routesChecked: result.routesChecked,
        violations: result.violations,
      },
      message: result.message,
    };
  },
};

const pitch: CapabilityHandler = {
  descriptor: {
    name: "pitch.generate",
    version: "0.1.0-thin",
    demoOnly: true,
    purpose: "Thin executive pitch package with evidence citations",
    consumes: ["knowledge", "prototype/manifest.json"],
    produces: ["reports/pitch/executive-pitch.md"],
    prerequisites: ["prototype.generate", "knowledge.build"],
    completionCriteria: ["pitch package", "evidence coverage"],
    estimatedCost: 0.5,
    estimatedRuntimeMs: 3000,
    confidenceGain: 0.1,
    qualityGates: ["pitch_evidence"],
    failureConditions: ["low_evidence_coverage"],
    retryPolicy: { maxRetries: 0, backoffMs: 0 },
    humanApprovalRequirement: null,
    plannerWeight: 25,
  },
  isComplete: (ctx) =>
    hasArtifact(ctx.slug, "reports/pitch/executive-pitch.md") && !ctx.force,
  execute: async (ctx) => {
    const result = generateThinPitch(ctx.slug);
    return {
      ok: result.ok,
      artifacts: result.artifacts,
      qualityFindings: result.ok
        ? []
        : [
            {
              severity: "medium",
              code: "low_evidence_coverage",
              message: result.message,
            },
          ],
      confidenceDelta: result.ok ? 0.1 : 0.02,
      qualityScore: result.qualityScore,
      blockingIssues: result.ok ? [] : ["low_evidence_coverage"],
      suggestedInvalidations: [],
      metrics: {
        recommendations: result.recommendationCount,
        withEvidence: result.withEvidence,
      },
      message: result.message,
    };
  },
};

const reports: CapabilityHandler = {
  descriptor: {
    name: "reports.confidence",
    purpose: "Generate confidence and knowledge metric reports",
    consumes: ["knowledge"],
    produces: ["reports/confidence-report.md"],
    prerequisites: ["knowledge.build"],
    completionCriteria: ["confidence-report.md"],
    estimatedCost: 0.3,
    estimatedRuntimeMs: 5000,
    confidenceGain: 0.05,
    qualityGates: [],
    failureConditions: [],
    retryPolicy: { maxRetries: 0, backoffMs: 0 },
    humanApprovalRequirement: null,
    plannerWeight: 30,
  },
  isComplete: (ctx) =>
    hasArtifact(ctx.slug, "reports/confidence-report.md") && !ctx.force,
  execute: async (ctx) => {
    const { overallConfidence } = await runPlatformReports(ctx.slug);
    return okResult({
      artifacts: [
        "reports/confidence-report.md",
        "reports/knowledge-metrics-summary.md",
      ],
      qualityScore: overallConfidence,
      metrics: { overallConfidence },
    });
  },
};

const lessons: CapabilityHandler = {
  descriptor: {
    name: "lessons.derive",
    purpose: "Ensure lessons-learned report exists",
    consumes: ["reports/confidence-report.md"],
    produces: ["reports/lessons-learned.md"],
    prerequisites: ["reports.confidence"],
    completionCriteria: ["lessons-learned.md"],
    estimatedCost: 0.2,
    estimatedRuntimeMs: 3000,
    confidenceGain: 0.05,
    qualityGates: ["lessons_present"],
    failureConditions: [],
    retryPolicy: { maxRetries: 0, backoffMs: 0 },
    humanApprovalRequirement: null,
    plannerWeight: 20,
  },
  isComplete: (ctx) =>
    hasArtifact(ctx.slug, "reports/lessons-learned.md") && !ctx.force,
  execute: async (ctx) => {
    if (!hasArtifact(ctx.slug, "reports/lessons-learned.md")) {
      await runPlatformReports(ctx.slug);
    }
    return hasArtifact(ctx.slug, "reports/lessons-learned.md")
      ? okResult({
          artifacts: ["reports/lessons-learned.md"],
          qualityScore: 0.8,
        })
      : failResult("lessons-learned.md missing");
  },
};

const improvements: CapabilityHandler = {
  descriptor: {
    name: "platform.improvements",
    purpose: "Ensure platform improvements registry updated",
    consumes: ["reports/lessons-learned.md"],
    produces: ["platform/improvements/registry.json"],
    prerequisites: ["lessons.derive"],
    completionCriteria: ["registry has items"],
    estimatedCost: 0.1,
    estimatedRuntimeMs: 1000,
    confidenceGain: 0.02,
    qualityGates: ["improvements_present"],
    failureConditions: [],
    retryPolicy: { maxRetries: 0, backoffMs: 0 },
    humanApprovalRequirement: null,
    plannerWeight: 10,
  },
  isComplete: (ctx) => {
    const global = readJsonFile<{ items?: unknown[] }>(
      `${process.cwd()}/platform/improvements/registry.json`,
    );
    return (global?.items?.length ?? 0) > 0 && !ctx.force;
  },
  execute: async (ctx) => {
    await runPlatformReports(ctx.slug);
    const global = readJsonFile<{ items?: unknown[] }>(
      `${process.cwd()}/platform/improvements/registry.json`,
    );
    const count = global?.items?.length ?? 0;
    if (count > 0) updateProjectStage(ctx.slug, "complete");
    return count > 0
      ? okResult({
          artifacts: ["platform/improvements/registry.json"],
          qualityScore: 0.85,
          metrics: { items: count },
        })
      : failResult("No platform improvements registered");
  },
};

export function registerAllCapabilities(): void {
  const all = [
    crawl,
    extraction,
    screenshots,
    knowledge,
    reliability,
    makeAuditHandler("audit.technical", "analysis/technical-audit.md", 80),
    makeAuditHandler(
      "audit.accessibility",
      "analysis/accessibility-audit.md",
      78,
    ),
    makeAuditHandler("audit.seo", "analysis/seo-audit.md", 76),
    makeAuditHandler("audit.performance", "analysis/performance-audit.md", 74),
    makeAuditHandler("audit.ux", "analysis/executive-audit.md", 72),
    strategy,
    approvalGate,
    prototype,
    browserQa,
    pitch,
    reports,
    lessons,
    improvements,
  ];
  for (const h of all) registerCapability(h);
}
