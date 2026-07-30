import { inspectKnowledge } from "@/lib/knowledge/inspect";
import { projectPath, readJsonFile } from "@/lib/project";
import type { PageRecord } from "@/lib/schemas/crawl";
import { needsTextRepair } from "@/lib/crawler/text-normalize";
import { getCapability } from "@/forge-core/capabilities/registry";
import type {
  NextAction,
  PlannerCandidate,
} from "@/forge-core/capabilities/types";
import { requiresHumanApproval, type RuntimePolicies } from "@/forge-core/policies/defaults";
import { checkBudgets } from "@/forge-core/budgets/track";
import { getLoop } from "@/forge-core/loops/definitions";
import type {
  ApprovalsFile,
  BudgetSnapshot,
  ExecutionGraph,
  ExecutionNode,
  RunState,
} from "@/forge-core/state/schemas";
import { loadApprovals } from "@/forge-core/state/persist";

function depsSatisfied(graph: ExecutionGraph, node: ExecutionNode): boolean {
  return node.dependencies.every((depId) => {
    const dep = graph.nodes.find((n) => n.id === depId);
    return dep?.status === "passed" || dep?.status === "skipped";
  });
}

function pagesNeedRepair(slug: string): boolean {
  const pages =
    readJsonFile<PageRecord[]>(projectPath(slug, "source/pages.json")) ?? [];
  if (!pages.length) return false;
  return pages.some((p) => needsTextRepair(p.mainTextSummary));
}

function detectSignals(slug: string, graph: ExecutionGraph): string[] {
  const signals: string[] = [];
  if (pagesNeedRepair(slug)) {
    signals.push("pages_need_repair", "low_text_quality");
  }
  try {
    const insp = inspectKnowledge({ slug });
    if (insp.issues.some((i) => i.category === "unsupported_facts")) {
      signals.push("unsupported_facts");
    }
  } catch {
    /* store may be empty early */
  }
  const auditCaps = [
    "audit.technical",
    "audit.accessibility",
    "audit.seo",
    "audit.performance",
    "audit.ux",
  ];
  if (
    graph.nodes.some(
      (n) =>
        auditCaps.includes(n.capability) &&
        n.status !== "passed" &&
        n.status !== "skipped",
    )
  ) {
    signals.push("missing_audit_artifacts");
  }
  const qa = readJsonFile<{ ok?: boolean }>(
    projectPath(slug, "qa/browser-qa.json"),
  );
  if (qa && qa.ok === false) signals.push("browser_qa_failed");

  const remaining = graph.nodes.filter(
    (n) => n.status !== "passed" && n.status !== "skipped",
  );
  if (remaining.length <= 3) signals.push("run_near_complete");

  return signals;
}

function activeLoops(
  run: RunState,
  signals: string[],
  policies: RuntimePolicies,
): string[] {
  // Rebuild from signals each tick — do not retain expired loops forever
  const loops = new Set<string>();
  for (const id of ["evidence", "audit", "strategy", "prototype", "learning"]) {
    const def = getLoop(id);
    if (!def) continue;
    if (!def.activateWhen.some((s) => signals.includes(s))) continue;
    const iters = run.loopIterations[id] ?? 0;
    if (iters < Math.min(def.maxIterations, policies.maxLoopIterations)) {
      loops.add(id);
    }
  }
  return [...loops];
}

function approvalStatus(
  approvals: ApprovalsFile | null,
  key: string | null,
): "pending" | "approved" | "rejected" | "n/a" | "invalidated" {
  if (!key) return "n/a";
  const d = approvals?.decisions.find((x) => x.key === key);
  if (!d) return "pending";
  if (d.invalidated) return "invalidated";
  return d.status;
}

export function planNextAction(input: {
  slug: string;
  graph: ExecutionGraph;
  run: RunState;
  policies: RuntimePolicies;
  budgets: BudgetSnapshot;
}): { action: NextAction; candidates: PlannerCandidate[]; activeLoops: string[] } {
  const budget = checkBudgets(input.budgets);
  if (!budget.ok) {
    return {
      action: {
        kind: "pause",
        score: 0,
        rationale: `Budget exceeded: ${budget.reason}`,
        reason: budget.reason,
      },
      candidates: [],
      activeLoops: input.run.activeLoops,
    };
  }

  const signals = detectSignals(input.slug, input.graph);
  const loops = activeLoops(input.run, signals, input.policies);
  const approvals = loadApprovals(input.slug);

  // Terminal failure
  const failed = input.graph.nodes.find((n) => n.status === "failed");
  if (failed && failed.retries >= input.policies.maxRetriesPerNode) {
    return {
      action: {
        kind: "fail",
        score: 0,
        rationale: `Node ${failed.id} failed permanently: ${failed.lastError ?? "unknown"}`,
        reason: failed.lastError ?? "node_failed",
      },
      candidates: [],
      activeLoops: loops,
    };
  }

  const allDone = input.graph.nodes.every(
    (n) => n.status === "passed" || n.status === "skipped",
  );
  if (allDone) {
    return {
      action: {
        kind: "complete",
        score: 1,
        rationale: "All execution nodes passed or skipped",
      },
      candidates: [],
      activeLoops: loops,
    };
  }

  const candidates: PlannerCandidate[] = [];

  for (const node of input.graph.nodes) {
    if (
      node.status === "passed" ||
      node.status === "skipped" ||
      node.status === "running"
    ) {
      continue;
    }
    if (node.status === "failed" && node.retries >= input.policies.maxRetriesPerNode) {
      continue;
    }
    if (!depsSatisfied(input.graph, node)) continue;

    const cap = getCapability(node.capability);
    if (!cap) {
      // Surface unavailable capabilities instead of silent omission
      if (node.capability !== "approval.gate") {
        candidates.push({
          nodeId: node.id,
          capability: node.capability,
          score: -1,
          reason: "capability_unavailable",
          needsApproval: false,
          approvalKey: null,
        });
      }
      continue;
    }
    if (cap.descriptor.available === false) continue;

    // Rejected approval → terminal fail path
    if (
      node.approvalKey &&
      approvalStatus(approvals, node.approvalKey) === "rejected"
    ) {
      return {
        action: {
          kind: "fail",
          score: 0,
          rationale: `Approval rejected: ${node.approvalKey}`,
          reason: `rejected:${node.approvalKey}`,
        },
        candidates: [],
        activeLoops: loops,
      };
    }

    const ctx = {
      slug: input.slug,
      node,
      graph: input.graph,
      run: input.run,
      policies: input.policies,
      budgets: input.budgets,
    };

    let score = cap.descriptor.plannerWeight;
    // Boost nodes in active loops
    if (node.loopId && loops.includes(node.loopId)) score += 15;
    // Routing boosts
    if (signals.includes("pages_need_repair") && node.capability === "extraction.repair") {
      score += 40;
    }
    if (signals.includes("browser_qa_failed") && node.capability === "prototype.generate") {
      score += 25;
    }
    if (signals.includes("unsupported_facts") && node.capability === "knowledge.build") {
      score += 20;
    }
    // Prefer incomplete over already-complete
    if (cap.isComplete(ctx) && node.capability !== "approval.gate") {
      score += 5; // still schedule to stamp passed
    }

    const appr = approvalStatus(approvals, node.approvalKey);
    const needsApproval =
      !!node.approvalKey &&
      requiresHumanApproval(input.policies, node.approvalKey) &&
      appr !== "approved";

    candidates.push({
      nodeId: node.id,
      capability: node.capability,
      score,
      reason: `deps_met weight=${cap.descriptor.plannerWeight} loops=${node.loopId ?? "-"} signals=${signals.slice(0, 3).join(",")}`,
      needsApproval,
      approvalKey: node.approvalKey,
    });
  }

  // Drop unavailable markers from scoring unless nothing else is ready
  const actionable = candidates.filter((c) => c.score >= 0);
  const pool = actionable.length ? actionable : candidates;
  pool.sort((a, b) => b.score - a.score);
  // keep full candidate list for history but select from pool
  candidates.sort((a, b) => b.score - a.score);

  if (!pool.length) {
    const waiting = input.graph.nodes.find((n) => n.status === "waiting_approval");
    if (waiting?.approvalKey) {
      return {
        action: {
          kind: "await_approval",
          nodeId: waiting.id,
          approvalKey: waiting.approvalKey,
          score: 0,
          rationale: `Waiting for approval ${waiting.approvalKey}`,
        },
        candidates,
        activeLoops: loops,
      };
    }
    return {
      action: {
        kind: "pause",
        score: 0,
        rationale: "No ready candidates; graph blocked",
        reason: "no_ready_candidates",
      },
      candidates,
      activeLoops: loops,
    };
  }

  const best = pool[0]!;
  if (best.score < 0) {
    return {
      action: {
        kind: "pause",
        score: 0,
        rationale: `Required capability unavailable: ${best.capability}`,
        reason: `unavailable:${best.capability}`,
      },
      candidates,
      activeLoops: loops,
    };
  }
  if (best.needsApproval && best.approvalKey) {
    return {
      action: {
        kind: "await_approval",
        nodeId: best.nodeId,
        approvalKey: best.approvalKey,
        score: best.score,
        rationale: `Human approval required: ${best.approvalKey}. ${best.reason}`,
      },
      candidates,
      activeLoops: loops,
    };
  }

  return {
    action: {
      kind: "execute",
      nodeId: best.nodeId,
      capability: best.capability,
      score: best.score,
      rationale: `Next best action: ${best.capability} on ${best.nodeId}. ${best.reason}`,
    },
    candidates,
    activeLoops: loops,
  };
}
