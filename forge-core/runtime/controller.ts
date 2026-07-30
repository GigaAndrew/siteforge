import {
  ensureCapabilitiesRegistered,
  getCapability,
} from "@/forge-core/capabilities/registry";
import { planNextAction } from "@/forge-core/planner/plan";
import { evaluateNodeGates } from "@/forge-core/gates/evaluate";
import {
  policiesForMode,
  type RuntimePolicies,
} from "@/forge-core/policies/defaults";
import { checkBudgets, recordInvocation } from "@/forge-core/budgets/track";
import { appendDecision, emit } from "@/forge-core/history/log";
import {
  withRuntimeLock,
  withRuntimeLockSync,
} from "@/forge-core/runtime/lock";
import { assertRunTransition } from "@/forge-core/state/transitions";
import { assertValidProjectSlug } from "@/lib/project";
import {
  digestArtifacts,
  getNode,
  invalidateApprovalsForNodes,
  invalidateDownstream,
  loadApprovals,
  loadBudgets,
  loadGraph,
  loadRunState,
  recoverStrandedRunningNodes,
  saveApprovals,
  saveBudgets,
  saveCheckpoint,
  saveGraph,
  saveRunState,
  updateNode,
} from "@/forge-core/state/persist";
import { seedExecution } from "@/forge-core/state/seed";
import type {
  ApprovalMode,
  ExecutionGraph,
  RunState,
} from "@/forge-core/state/schemas";

export type RunOptions = {
  slug: string;
  goal?: string;
  approvalMode?: ApprovalMode;
  maxTicks?: number;
  force?: boolean;
  reset?: boolean;
};

export type RunTickResult = {
  status: RunState["status"];
  action: string;
  nodeId: string | null;
  message: string;
  done: boolean;
};

function loadPolicies(run: RunState): RuntimePolicies {
  return policiesForMode(run.approvalMode);
}

function transitionRun(run: RunState, to: RunState["status"]): RunState {
  assertRunTransition(run.status, to);
  return { ...run, status: to };
}

export function initRun(
  opts: RunOptions,
): { graph: ExecutionGraph; run: RunState } {
  assertValidProjectSlug(opts.slug);
  if (opts.reset || !loadGraph(opts.slug) || !loadRunState(opts.slug)) {
    return seedExecution(opts.slug, {
      goal: opts.goal,
      approvalMode: opts.approvalMode ?? "mixed",
    });
  }
  let graph = loadGraph(opts.slug)!;
  graph = recoverStrandedRunningNodes(graph);
  saveGraph(graph);
  let run = loadRunState(opts.slug)!;
  if (opts.approvalMode && opts.approvalMode !== run.approvalMode) {
    run = { ...run, approvalMode: opts.approvalMode };
    saveRunState(run);
  }
  return { graph, run };
}

async function runTickUnlocked(
  slug: string,
  opts: { force?: boolean } = {},
): Promise<RunTickResult> {
  await ensureCapabilitiesRegistered();
  let graph = loadGraph(slug);
  let run = loadRunState(slug);
  if (!graph || !run) {
    throw new Error(`No runtime state for ${slug}. Call siteforge run first.`);
  }
  let budgets = loadBudgets(slug);
  if (!budgets) throw new Error("Missing budgets.json");

  graph = recoverStrandedRunningNodes(graph);

  if (run.status === "cancelled") {
    return {
      status: run.status,
      action: "cancelled",
      nodeId: null,
      message: "Run cancelled",
      done: true,
    };
  }
  if (run.status === "completed") {
    return {
      status: run.status,
      action: "complete",
      nodeId: null,
      message: "Already completed",
      done: true,
    };
  }

  const policies = loadPolicies(run);
  if (run.status !== "running") {
    run = transitionRun(run, "running");
  }
  run = { ...run, pauseReason: null };
  saveRunState(run);
  saveGraph(graph);

  const planned = planNextAction({ slug, graph, run, policies, budgets });
  run = {
    ...run,
    activeLoops: planned.activeLoops,
    lastPlannerRationale: planned.action.rationale,
    lastDecisionAt: new Date().toISOString(),
  };

  appendDecision(slug, {
    at: new Date().toISOString(),
    runId: run.runId,
    action: planned.action.kind,
    nodeId:
      planned.action.kind === "execute" ||
      planned.action.kind === "await_approval"
        ? planned.action.nodeId
        : null,
    capability:
      planned.action.kind === "execute" ? planned.action.capability : null,
    score: planned.action.score,
    rationale: planned.action.rationale,
    candidates: planned.candidates.map((c) => ({
      nodeId: c.nodeId,
      capability: c.capability,
      score: c.score,
      reason: c.reason,
    })),
  });

  if (planned.action.kind === "complete") {
    run = transitionRun(
      { ...run, currentNodeId: null, pauseReason: null },
      "completed",
    );
    saveRunState(run);
    emit(slug, run.runId, "complete", planned.action.rationale);
    return {
      status: "completed",
      action: "complete",
      nodeId: null,
      message: planned.action.rationale,
      done: true,
    };
  }

  if (planned.action.kind === "fail") {
    run = {
      ...transitionRun(run, "failed"),
      pauseReason: planned.action.reason,
    };
    saveRunState(run);
    emit(slug, run.runId, "fail", planned.action.rationale);
    return {
      status: "failed",
      action: "fail",
      nodeId: null,
      message: planned.action.rationale,
      done: true,
    };
  }

  if (planned.action.kind === "pause") {
    run = {
      ...transitionRun(run, "paused"),
      pauseReason: planned.action.reason,
    };
    saveRunState(run);
    emit(slug, run.runId, "pause", planned.action.rationale);
    return {
      status: "paused",
      action: "pause",
      nodeId: null,
      message: planned.action.rationale,
      done: true,
    };
  }

  if (planned.action.kind === "await_approval") {
    graph = updateNode(graph, planned.action.nodeId, {
      status: "waiting_approval",
    });
    saveGraph(graph);
    run = {
      ...transitionRun(run, "waiting_approval"),
      currentNodeId: planned.action.nodeId,
      pauseReason: `awaiting:${planned.action.approvalKey}`,
    };
    saveRunState(run);
    emit(slug, run.runId, "await_approval", planned.action.rationale, {
      nodeId: planned.action.nodeId,
    });
    return {
      status: "waiting_approval",
      action: "await_approval",
      nodeId: planned.action.nodeId,
      message: planned.action.rationale,
      done: true,
    };
  }

  const nodeId = planned.action.nodeId;
  const capabilityName = planned.action.capability;
  const cap = getCapability(capabilityName);
  if (!cap || cap.descriptor.available === false) {
    graph = updateNode(graph, nodeId, {
      status: "failed",
      lastError: `Unavailable capability ${capabilityName}`,
    });
    saveGraph(graph);
    run = {
      ...transitionRun(run, "paused"),
      pauseReason: `unavailable:${capabilityName}`,
    };
    saveRunState(run);
    return {
      status: "paused",
      action: "fail",
      nodeId,
      message: `Unavailable capability ${capabilityName}`,
      done: true,
    };
  }

  const node = getNode(graph, nodeId)!;
  const budgetCheck = checkBudgets(budgets);
  if (!budgetCheck.ok) {
    run = {
      ...transitionRun(run, "paused"),
      pauseReason: budgetCheck.reason,
    };
    saveRunState(run);
    return {
      status: "paused",
      action: "pause",
      nodeId,
      message: budgetCheck.reason,
      done: true,
    };
  }

  graph = updateNode(graph, nodeId, {
    status: "running",
    startedAt: new Date().toISOString(),
  });
  saveGraph(graph);
  run = { ...run, currentNodeId: nodeId, status: "running" };
  saveRunState(run);
  emit(slug, run.runId, "execute_start", `Executing ${capabilityName}`, {
    nodeId,
  });

  const started = Date.now();
  const ctx = {
    slug,
    node: getNode(graph, nodeId)!,
    graph,
    run,
    policies,
    budgets,
    force: opts.force,
  };

  let result;
  try {
    result =
      cap.isComplete(ctx) && capabilityName !== "approval.gate"
        ? {
            ok: true,
            artifacts: cap.descriptor.produces,
            qualityFindings: [],
            confidenceDelta: 0.01,
            qualityScore: Math.min(node.qualityScore || 0.8, 0.85),
            blockingIssues: [],
            suggestedInvalidations: [],
            metrics: { skippedExecute: true },
            message: "Already complete — stamped passed",
          }
        : await cap.execute(ctx);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const runtimeMs = Date.now() - started;
    budgets = recordInvocation(budgets, {
      runtimeMs,
      playwright: ["crawl.run", "extraction.repair", "qa.browser", "screenshots.capture"].includes(
        capabilityName,
      ),
    });
    saveBudgets(slug, budgets);
    const retries = node.retries + 1;
    const max = Math.min(
      policies.maxRetriesPerNode,
      cap.descriptor.retryPolicy.maxRetries,
    );
    if (retries <= max) {
      graph = updateNode(graph, nodeId, {
        status: "pending",
        retries,
        lastError: message.slice(0, 500),
        runtimeMs,
      });
      saveGraph(graph);
      emit(slug, run.runId, "retry", `Exception retry ${retries}/${max}`, {
        nodeId,
      });
      return {
        status: "running",
        action: "retry",
        nodeId,
        message: `Retrying after exception: ${message}`,
        done: false,
      };
    }
    graph = updateNode(graph, nodeId, {
      status: "failed",
      retries,
      lastError: message.slice(0, 500),
      runtimeMs,
    });
    saveGraph(graph);
    run = {
      ...transitionRun(run, "paused"),
      pauseReason: `node_exception:${nodeId}`,
    };
    saveRunState(run);
    emit(slug, run.runId, "execute_fail", message.slice(0, 500), { nodeId });
    return {
      status: "paused",
      action: "fail_node",
      nodeId,
      message,
      done: true,
    };
  }

  if (
    capabilityName === "approval.gate" &&
    result.blockingIssues.some((b) => b.startsWith("awaiting_approval:"))
  ) {
    graph = updateNode(graph, nodeId, {
      status: "waiting_approval",
      runtimeMs: Date.now() - started,
    });
    saveGraph(graph);
    run = {
      ...transitionRun(run, "waiting_approval"),
      pauseReason: result.blockingIssues[0] ?? "awaiting_approval",
    };
    saveRunState(run);
    return {
      status: "waiting_approval",
      action: "await_approval",
      nodeId,
      message: result.message ?? "Waiting approval",
      done: true,
    };
  }

  const runtimeMs = Date.now() - started;
  budgets = recordInvocation(budgets, {
    runtimeMs,
    playwright: ["crawl.run", "extraction.repair", "qa.browser", "screenshots.capture"].includes(
      capabilityName,
    ),
  });
  saveBudgets(slug, budgets);

  if (result.ok) {
    const gates = evaluateNodeGates(slug, node, policies);
    if (!gates.passed && capabilityName !== "approval.gate") {
      result = {
        ...result,
        ok: false,
        blockingIssues: [...result.blockingIssues, ...gates.issues],
        message: `Quality gates failed: ${gates.issues.join("; ")}`,
      };
    } else {
      // Gate score is a ceiling, not a floor — prevent inflation
      const qualityScore = Math.min(result.qualityScore, gates.score);
      graph = updateNode(graph, nodeId, {
        status: "passed",
        completedAt: new Date().toISOString(),
        runtimeMs,
        confidence: Math.min(1, node.confidence + result.confidenceDelta),
        qualityScore,
        outputs: result.artifacts,
        blockingIssues: [],
        lastError: null,
      });
      // Count loop cycles only on re-execution after failure/invalidation
      if (
        node.loopId &&
        (node.retries > 0 ||
          node.blockingIssues.some((b) => b.startsWith("invalidated:")))
      ) {
        run = {
          ...run,
          loopIterations: {
            ...run.loopIterations,
            [node.loopId]: (run.loopIterations[node.loopId] ?? 0) + 1,
          },
        };
      }
      saveGraph(graph);
      const saved = loadGraph(slug)!;
      saveCheckpoint(slug, getNode(graph, nodeId)!, {
        runId: run.runId,
        graphRevision: saved.revision,
      });
      emit(slug, run.runId, "execute_pass", result.message ?? "passed", {
        nodeId,
        data: {
          artifacts: result.artifacts,
          demoOnly: !!cap.descriptor.demoOnly,
          qualityScore,
        },
      });
      saveRunState(run);
      return {
        status: "running",
        action: "execute",
        nodeId,
        message: result.message ?? `Passed ${capabilityName}`,
        done: false,
      };
    }
  }

  const retries = node.retries + 1;
  const max = Math.min(
    policies.maxRetriesPerNode,
    cap.descriptor.retryPolicy.maxRetries,
  );
  if (retries <= max) {
    graph = updateNode(graph, nodeId, {
      status: "pending",
      retries,
      lastError: result.message ?? "failed",
      runtimeMs,
      blockingIssues: result.blockingIssues,
    });
    saveGraph(graph);
    emit(slug, run.runId, "retry", `Retry ${retries}/${max}`, { nodeId });
    return {
      status: "running",
      action: "retry",
      nodeId,
      message: `Retrying ${capabilityName}: ${result.message}`,
      done: false,
    };
  }

  graph = updateNode(graph, nodeId, {
    status: "failed",
    retries,
    lastError: result.message ?? "failed",
    runtimeMs,
    blockingIssues: result.blockingIssues,
  });
  saveGraph(graph);
  run = {
    ...transitionRun(run, "paused"),
    pauseReason: `node_failed:${nodeId}`,
  };
  saveRunState(run);
  emit(slug, run.runId, "execute_fail", result.message ?? "failed", { nodeId });
  return {
    status: "paused",
    action: "fail_node",
    nodeId,
    message: result.message ?? `Failed ${capabilityName}`,
    done: true,
  };
}

export async function runTick(
  slug: string,
  opts: { force?: boolean } = {},
): Promise<RunTickResult> {
  assertValidProjectSlug(slug);
  return withRuntimeLock(slug, () => runTickUnlocked(slug, opts));
}

export async function runUntilPause(opts: RunOptions): Promise<{
  status: RunState["status"];
  ticks: number;
  message: string;
}> {
  assertValidProjectSlug(opts.slug);
  return withRuntimeLock(opts.slug, async () => {
    initRun(opts);
    const maxTicks = opts.maxTicks ?? 40;
    let ticks = 0;
    let last: RunTickResult = {
      status: "idle",
      action: "init",
      nodeId: null,
      message: "init",
      done: false,
    };

    while (ticks < maxTicks) {
      last = await runTickUnlocked(opts.slug, { force: opts.force });
      ticks += 1;
      if (last.done) break;
    }

    if (!last.done && ticks >= maxTicks) {
      const run = loadRunState(opts.slug)!;
      saveRunState({
        ...run,
        status: "paused",
        pauseReason: "max_ticks_reached",
      });
      return {
        status: "paused",
        ticks,
        message: `Paused after ${maxTicks} ticks (safety bound)`,
      };
    }

    return { status: last.status, ticks, message: last.message };
  });
}

export function pauseRun(slug: string, reason = "user_pause"): void {
  assertValidProjectSlug(slug);
  withRuntimeLockSync(slug, () => {
    const run = loadRunState(slug);
    if (!run) throw new Error("No run state");
    if (run.status === "completed" || run.status === "cancelled") {
      throw new Error(`Cannot pause run in status ${run.status}`);
    }
    saveRunState({
      ...transitionRun(run, "paused"),
      pauseReason: reason,
    });
    emit(slug, run.runId, "pause", reason);
  });
}

export async function resumeRun(
  slug: string,
  opts: { maxTicks?: number } = {},
): Promise<{ status: RunState["status"]; ticks: number; message: string }> {
  assertValidProjectSlug(slug);
  return withRuntimeLock(slug, async () => {
    const run = loadRunState(slug);
    if (!run) throw new Error("No run state");
    if (run.status === "cancelled") throw new Error("Run cancelled");
    if (run.status === "completed") {
      return {
        status: "completed",
        ticks: 0,
        message: "Already completed",
      };
    }
    let graph = loadGraph(slug);
    if (graph) {
      graph = recoverStrandedRunningNodes(graph);
      saveGraph(graph);
    }
    saveRunState({
      ...run,
      status: "running",
      pauseReason: null,
    });
    emit(slug, run.runId, "resume", "Resuming run");

    const maxTicks = opts.maxTicks ?? 40;
    let ticks = 0;
    let last: RunTickResult = {
      status: "idle",
      action: "init",
      nodeId: null,
      message: "init",
      done: false,
    };
    while (ticks < maxTicks) {
      last = await runTickUnlocked(slug, {});
      ticks += 1;
      if (last.done) break;
    }
    if (!last.done && ticks >= maxTicks) {
      const r = loadRunState(slug)!;
      saveRunState({
        ...r,
        status: "paused",
        pauseReason: "max_ticks_reached",
      });
      return {
        status: "paused",
        ticks,
        message: `Paused after ${maxTicks} ticks (safety bound)`,
      };
    }
    return { status: last.status, ticks, message: last.message };
  });
}

export function cancelRun(slug: string): void {
  assertValidProjectSlug(slug);
  withRuntimeLockSync(slug, () => {
    const run = loadRunState(slug);
    if (!run) throw new Error("No run state");
    if (run.status === "completed") {
      throw new Error("Cannot cancel a completed run");
    }
    saveRunState({
      ...transitionRun(run, "cancelled"),
      pauseReason: "user_cancel",
    });
    emit(slug, run.runId, "cancel", "Cancelled by user");
  });
}

export function approve(
  slug: string,
  key: string,
  opts: { actor?: string; reason?: string } = {},
): void {
  assertValidProjectSlug(slug);
  withRuntimeLockSync(slug, () => {
    const file = loadApprovals(slug);
    const graph = loadGraph(slug);
    const run = loadRunState(slug);
    if (!file || !graph || !run) throw new Error("Missing runtime state");
    if (run.status === "completed" || run.status === "cancelled") {
      throw new Error(`Cannot approve while run is ${run.status}`);
    }

    const node = graph.nodes.find((n) => n.approvalKey === key);
    if (!node) throw new Error(`Unknown approval key: ${key}`);
    if (
      node.status !== "waiting_approval" &&
      node.status !== "pending" &&
      node.status !== "ready"
    ) {
      throw new Error(
        `Approval ${key} not reachable (node ${node.id} status=${node.status})`,
      );
    }
    // Require upstream deps passed
    for (const dep of node.dependencies) {
      const d = getNode(graph, dep);
      if (d?.status !== "passed" && d?.status !== "skipped") {
        throw new Error(
          `Cannot approve ${key}: dependency ${dep} is ${d?.status ?? "missing"}`,
        );
      }
    }

    const upstream = node.dependencies
      .map((id) => getNode(graph, id))
      .filter(Boolean);
    const artifactPaths = upstream.flatMap((n) => n!.outputs);
    const artifactDigest = artifactPaths.length
      ? digestArtifacts(slug, artifactPaths)
      : null;

    const decisions = file.decisions.map((d) =>
      d.key === key
        ? {
            ...d,
            status: "approved" as const,
            actor: opts.actor ?? "operator",
            reason: opts.reason ?? "approved",
            decidedAt: new Date().toISOString(),
            nodeId: node.id,
            graphRevision: graph.revision,
            artifactDigest,
            invalidated: false,
            invalidatedReason: null,
          }
        : d,
    );
    if (!decisions.some((d) => d.key === key)) {
      throw new Error(`Approval key not in policy set: ${key}`);
    }
    saveApprovals({ ...file, decisions });

    if (node.status === "waiting_approval") {
      saveGraph(updateNode(graph, node.id, { status: "pending" }));
    }
    emit(slug, run.runId, "approve", `Approved ${key}`, {
      data: { key, graphRevision: graph.revision, artifactDigest },
    });
    saveRunState({
      ...run,
      status: "paused",
      pauseReason: null,
    });
  });
}

export function reject(
  slug: string,
  key: string,
  opts: { actor?: string; reason?: string } = {},
): void {
  assertValidProjectSlug(slug);
  withRuntimeLockSync(slug, () => {
    const file = loadApprovals(slug);
    const graph = loadGraph(slug);
    const run = loadRunState(slug);
    if (!file || !graph || !run) throw new Error("Missing runtime state");
    if (!file.decisions.some((d) => d.key === key)) {
      throw new Error(`Unknown approval key: ${key}`);
    }
    const decisions = file.decisions.map((d) =>
      d.key === key
        ? {
            ...d,
            status: "rejected" as const,
            actor: opts.actor ?? "operator",
            reason: opts.reason ?? "rejected",
            decidedAt: new Date().toISOString(),
            invalidated: false,
          }
        : d,
    );
    saveApprovals({ ...file, decisions });

    const node = graph.nodes.find((n) => n.approvalKey === key);
    if (node) {
      // Fail the gate and invalidate its immediate upstream for revision
      let g = updateNode(graph, node.id, {
        status: "failed",
        lastError: `rejected:${key}`,
      });
      for (const dep of node.dependencies) {
        g = invalidateDownstream(g, dep);
      }
      saveGraph(g);
      const approvals = invalidateApprovalsForNodes(
        { ...file, decisions },
        [node.id, ...node.dependencies],
        `rejected:${key}`,
      );
      saveApprovals(approvals);
    }
    emit(slug, run.runId, "reject", `Rejected ${key}`, { data: { key } });
    saveRunState({
      ...run,
      status: "paused",
      pauseReason: `rejected:${key}`,
    });
  });
}

export function resetNode(slug: string, nodeId: string): void {
  assertValidProjectSlug(slug);
  withRuntimeLockSync(slug, () => {
    let graph = loadGraph(slug);
    if (!graph) throw new Error("No graph");
    const before = new Set(
      graph.nodes
        .filter(
          (n) =>
            n.id === nodeId ||
            n.status === "invalidated" ||
            n.dependencies.includes(nodeId),
        )
        .map((n) => n.id),
    );
    graph = invalidateDownstream(graph, nodeId);
    const invalidatedIds = graph.nodes
      .filter(
        (n) =>
          n.status === "invalidated" ||
          n.id === nodeId ||
          before.has(n.id),
      )
      .map((n) => n.id);
    saveGraph(graph);
    const approvals = loadApprovals(slug);
    if (approvals) {
      saveApprovals(
        invalidateApprovalsForNodes(
          approvals,
          invalidatedIds,
          `reset:${nodeId}`,
        ),
      );
    }
    const run = loadRunState(slug);
    if (run) {
      if (run.status === "completed") {
        saveRunState({
          ...run,
          status: "paused",
          pauseReason: null,
        });
      } else {
        emit(slug, run.runId, "reset_node", `Reset ${nodeId}`, { nodeId });
        saveRunState({
          ...run,
          status: "paused",
          pauseReason: null,
        });
      }
    }
  });
}

export function getStatus(slug: string) {
  assertValidProjectSlug(slug);
  return {
    run: loadRunState(slug),
    graph: loadGraph(slug),
    budgets: loadBudgets(slug),
    approvals: loadApprovals(slug),
  };
}
