import { randomUUID } from "node:crypto";
import type { ApprovalMode } from "@/forge-core/state/schemas";
import type {
  ApprovalsFile,
  ExecutionGraph,
  ExecutionNode,
  RunState,
} from "@/forge-core/state/schemas";
import { policiesForMode } from "@/forge-core/policies/defaults";
import { createBudgets } from "@/forge-core/budgets/track";
import {
  ensureRuntimeDirs,
  saveApprovals,
  saveBudgets,
  saveGraph,
  saveRunState,
} from "@/forge-core/state/persist";

const DEFAULT_GOAL =
  "Produce a consulting-quality digital transformation assessment, interactive prototype, and executive pitch.";

type SeedNode = {
  id: string;
  type: string;
  capability: string;
  dependencies: string[];
  approvalKey?: string | null;
  loopId?: string | null;
};

/** Consulting goal template. Planner selects order; deps only constrain readiness. */
const TEMPLATE: SeedNode[] = [
  { id: "n_crawl", type: "Crawl", capability: "crawl.run", dependencies: [] },
  {
    id: "n_extract",
    type: "Extraction",
    capability: "extraction.repair",
    dependencies: ["n_crawl"],
    loopId: "evidence",
  },
  {
    id: "n_screenshots",
    type: "Screenshots",
    capability: "screenshots.capture",
    dependencies: ["n_crawl"],
  },
  {
    id: "n_knowledge",
    type: "KnowledgeBuild",
    capability: "knowledge.build",
    dependencies: ["n_extract"],
  },
  {
    id: "n_normalize",
    type: "Normalization",
    capability: "normalization.run",
    dependencies: ["n_knowledge"],
  },
  {
    id: "n_benchmark",
    type: "Benchmark",
    capability: "benchmark.run",
    dependencies: ["n_normalize"],
  },
  {
    id: "n_reliability",
    type: "Reliability",
    capability: "reliability.score",
    dependencies: ["n_knowledge"],
  },
  {
    id: "n_audit_tech",
    type: "Audit",
    capability: "audit.technical",
    dependencies: ["n_crawl", "n_screenshots"],
    loopId: "audit",
  },
  {
    id: "n_audit_a11y",
    type: "Audit",
    capability: "audit.accessibility",
    dependencies: ["n_crawl"],
    loopId: "audit",
  },
  {
    id: "n_audit_seo",
    type: "Audit",
    capability: "audit.seo",
    dependencies: ["n_crawl"],
    loopId: "audit",
  },
  {
    id: "n_audit_perf",
    type: "Audit",
    capability: "audit.performance",
    dependencies: ["n_crawl"],
    loopId: "audit",
  },
  {
    id: "n_audit_ux",
    type: "Audit",
    capability: "audit.ux",
    dependencies: ["n_audit_tech"],
    loopId: "audit",
  },
  {
    id: "n_strategy",
    type: "Strategy",
    capability: "strategy.generate",
    dependencies: [
      "n_audit_tech",
      "n_audit_a11y",
      "n_audit_seo",
      "n_audit_perf",
      "n_audit_ux",
      "n_knowledge",
    ],
    loopId: "strategy",
  },
  {
    id: "n_strategy_accept",
    type: "Approval",
    capability: "approval.gate",
    dependencies: ["n_strategy"],
    approvalKey: "strategy.accept",
  },
  {
    id: "n_prototype",
    type: "Prototype",
    capability: "prototype.generate",
    dependencies: ["n_strategy_accept"],
    loopId: "prototype",
  },
  {
    id: "n_browser_qa",
    type: "BrowserQA",
    capability: "qa.browser",
    dependencies: ["n_prototype"],
    loopId: "prototype",
  },
  {
    id: "n_prototype_approve",
    type: "Approval",
    capability: "approval.gate",
    dependencies: ["n_browser_qa"],
    approvalKey: "prototype.approve",
  },
  {
    id: "n_pitch",
    type: "Pitch",
    capability: "pitch.generate",
    dependencies: ["n_prototype_approve", "n_reliability"],
  },
  {
    id: "n_pitch_approve",
    type: "Approval",
    capability: "approval.gate",
    dependencies: ["n_pitch"],
    approvalKey: "pitch.approve",
  },
  {
    id: "n_reports",
    type: "Reports",
    capability: "reports.confidence",
    dependencies: ["n_knowledge", "n_reliability"],
  },
  {
    id: "n_lessons",
    type: "Lessons",
    capability: "lessons.derive",
    dependencies: ["n_pitch_approve", "n_reports"],
    loopId: "learning",
  },
  {
    id: "n_improvements",
    type: "PlatformImprovements",
    capability: "platform.improvements",
    dependencies: ["n_lessons"],
    loopId: "learning",
  },
];

function toNode(seed: SeedNode): ExecutionNode {
  return {
    id: seed.id,
    type: seed.type,
    capability: seed.capability,
    inputs: {},
    outputs: [],
    dependencies: seed.dependencies,
    status: "pending",
    confidence: 0,
    qualityScore: 0,
    startedAt: null,
    completedAt: null,
    runtimeMs: 0,
    cost: 0,
    retries: 0,
    blockingIssues: [],
    nextActions: [],
    loopId: seed.loopId ?? null,
    approvalKey: seed.approvalKey ?? null,
    lastError: null,
  };
}

export function seedExecution(
  slug: string,
  opts: { goal?: string; approvalMode?: ApprovalMode } = {},
): { graph: ExecutionGraph; run: RunState } {
  ensureRuntimeDirs(slug);
  const now = new Date().toISOString();
  const approvalMode = opts.approvalMode ?? "mixed";
  const policies = policiesForMode(approvalMode);
  const goal = opts.goal ?? DEFAULT_GOAL;
  const runId = randomUUID();

  const graph: ExecutionGraph = {
    schemaVersion: "1.0.0",
    projectSlug: slug,
    goal,
    createdAt: now,
    updatedAt: now,
    revision: 0,
    nodes: TEMPLATE.map(toNode),
  };

  const run: RunState = {
    schemaVersion: "1.0.0",
    projectSlug: slug,
    runId,
    status: "idle",
    approvalMode,
    goal,
    currentNodeId: null,
    activeLoops: [],
    loopIterations: {},
    pauseReason: null,
    lastPlannerRationale: null,
    lastDecisionAt: null,
    createdAt: now,
    updatedAt: now,
  };

  const approvals: ApprovalsFile = {
    schemaVersion: "1.0.0",
    projectSlug: slug,
    updatedAt: now,
    decisions: policies.pauseApprovalKeys.map((key) => ({
      key,
      status: "pending" as const,
      actor: null,
      reason: null,
      decidedAt: null,
      nodeId: TEMPLATE.find((t) => t.approvalKey === key)?.id ?? null,
      graphRevision: null,
      artifactDigest: null,
      invalidated: false,
      invalidatedReason: null,
    })),
  };

  saveGraph(graph);
  saveRunState(run);
  saveBudgets(slug, createBudgets(policies));
  saveApprovals(approvals);

  return { graph, run };
}
