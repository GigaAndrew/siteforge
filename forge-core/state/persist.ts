import fs from "node:fs";
import path from "node:path";
import {
  assertValidProjectSlug,
  projectPath,
  readJsonFile,
  writeJsonFile,
} from "@/lib/project";
import {
  ApprovalsFileSchema,
  BudgetSnapshotSchema,
  ExecutionGraphSchema,
  RunStateSchema,
  type ApprovalsFile,
  type BudgetSnapshot,
  type ExecutionGraph,
  type ExecutionNode,
  type RunState,
} from "@/forge-core/state/schemas";
import { assertValidGraph } from "@/forge-core/state/validate-graph";
import { createHash } from "node:crypto";

export function runtimeDir(slug: string): string {
  return projectPath(slug, "runtime");
}

export function ensureRuntimeDirs(slug: string): void {
  assertValidProjectSlug(slug);
  for (const sub of ["history", "checkpoints"]) {
    fs.mkdirSync(path.join(runtimeDir(slug), sub), { recursive: true });
  }
}

function assertSlugMatch(fileSlug: string, expected: string): void {
  if (fileSlug !== expected) {
    throw new Error(
      `Runtime file slug mismatch: file=${fileSlug} expected=${expected}`,
    );
  }
}

export function loadGraph(slug: string): ExecutionGraph | null {
  assertValidProjectSlug(slug);
  const raw = readJsonFile<unknown>(
    projectPath(slug, "runtime/execution-graph.json"),
  );
  if (!raw) return null;
  const graph = ExecutionGraphSchema.parse(raw);
  assertSlugMatch(graph.projectSlug, slug);
  return graph;
}

export function saveGraph(graph: ExecutionGraph): void {
  ensureRuntimeDirs(graph.projectSlug);
  assertValidGraph(graph);
  const next = {
    ...graph,
    revision: (graph.revision ?? 0) + 1,
    updatedAt: new Date().toISOString(),
  };
  writeJsonFile(
    projectPath(graph.projectSlug, "runtime/execution-graph.json"),
    ExecutionGraphSchema.parse(next),
  );
}

export function loadRunState(slug: string): RunState | null {
  assertValidProjectSlug(slug);
  const raw = readJsonFile<unknown>(projectPath(slug, "runtime/run-state.json"));
  if (!raw) return null;
  const state = RunStateSchema.parse(raw);
  assertSlugMatch(state.projectSlug, slug);
  return state;
}

export function saveRunState(state: RunState): void {
  ensureRuntimeDirs(state.projectSlug);
  const next = { ...state, updatedAt: new Date().toISOString() };
  writeJsonFile(
    projectPath(state.projectSlug, "runtime/run-state.json"),
    RunStateSchema.parse(next),
  );
}

export function loadBudgets(slug: string): BudgetSnapshot | null {
  assertValidProjectSlug(slug);
  const raw = readJsonFile<unknown>(projectPath(slug, "runtime/budgets.json"));
  if (!raw) return null;
  return BudgetSnapshotSchema.parse(raw);
}

export function saveBudgets(slug: string, budgets: BudgetSnapshot): void {
  ensureRuntimeDirs(slug);
  writeJsonFile(
    projectPath(slug, "runtime/budgets.json"),
    BudgetSnapshotSchema.parse(budgets),
  );
}

export function loadApprovals(slug: string): ApprovalsFile | null {
  assertValidProjectSlug(slug);
  const raw = readJsonFile<unknown>(
    projectPath(slug, "runtime/approvals.json"),
  );
  if (!raw) return null;
  const file = ApprovalsFileSchema.parse(raw);
  assertSlugMatch(file.projectSlug, slug);
  return file;
}

export function saveApprovals(file: ApprovalsFile): void {
  ensureRuntimeDirs(file.projectSlug);
  const next = { ...file, updatedAt: new Date().toISOString() };
  writeJsonFile(
    projectPath(file.projectSlug, "runtime/approvals.json"),
    ApprovalsFileSchema.parse(next),
  );
}

export function saveCheckpoint(
  slug: string,
  node: ExecutionNode,
  meta: { runId: string; graphRevision: number },
): void {
  ensureRuntimeDirs(slug);
  writeJsonFile(projectPath(slug, "runtime/checkpoints", `${node.id}.json`), {
    schemaVersion: "1.0.0",
    runId: meta.runId,
    graphRevision: meta.graphRevision,
    savedAt: new Date().toISOString(),
    node,
  });
}

export function getNode(
  graph: ExecutionGraph,
  id: string,
): ExecutionNode | undefined {
  return graph.nodes.find((n) => n.id === id);
}

export function updateNode(
  graph: ExecutionGraph,
  id: string,
  patch: Partial<ExecutionNode>,
): ExecutionGraph {
  if (!graph.nodes.some((n) => n.id === id)) {
    throw new Error(`Unknown node id: ${id}`);
  }
  return {
    ...graph,
    updatedAt: new Date().toISOString(),
    nodes: graph.nodes.map((n) => (n.id === id ? { ...n, ...patch } : n)),
  };
}

function clearExecutionFields(n: ExecutionNode): ExecutionNode {
  return {
    ...n,
    outputs: [],
    confidence: 0,
    qualityScore: 0,
    startedAt: null,
    completedAt: null,
    runtimeMs: 0,
    cost: 0,
    retries: 0,
    blockingIssues: [],
    nextActions: [],
    lastError: null,
  };
}

export function invalidateDownstream(
  graph: ExecutionGraph,
  nodeId: string,
): ExecutionGraph {
  if (!graph.nodes.some((n) => n.id === nodeId)) {
    throw new Error(`Unknown node id: ${nodeId}`);
  }
  const invalidated = new Set<string>([nodeId]);
  let changed = true;
  while (changed) {
    changed = false;
    for (const n of graph.nodes) {
      if (invalidated.has(n.id)) continue;
      if (n.dependencies.some((d) => invalidated.has(d))) {
        invalidated.add(n.id);
        changed = true;
      }
    }
  }
  return {
    ...graph,
    updatedAt: new Date().toISOString(),
    nodes: graph.nodes.map((n) => {
      if (!invalidated.has(n.id)) return n;
      if (n.id === nodeId) {
        return {
          ...clearExecutionFields(n),
          status: "pending" as const,
        };
      }
      return {
        ...clearExecutionFields(n),
        status: "invalidated" as const,
        blockingIssues: [`invalidated:upstream:${nodeId}`],
      };
    }),
  };
}

/** Revoke approvals that depend on invalidated nodes or stale graph revisions. */
export function invalidateApprovalsForNodes(
  approvals: ApprovalsFile,
  nodeIds: string[],
  reason: string,
): ApprovalsFile {
  const set = new Set(nodeIds);
  return {
    ...approvals,
    decisions: approvals.decisions.map((d) => {
      if (d.nodeId && set.has(d.nodeId) && d.status === "approved") {
        return {
          ...d,
          status: "pending" as const,
          invalidated: true,
          invalidatedReason: reason,
          decidedAt: null,
          actor: null,
          reason: null,
          graphRevision: null,
          artifactDigest: null,
        };
      }
      return d;
    }),
  };
}

export function digestArtifacts(slug: string, relPaths: string[]): string {
  const h = createHash("sha256");
  for (const rel of relPaths) {
    const p = projectPath(slug, rel);
    h.update(rel);
    if (fs.existsSync(p)) {
      h.update(fs.readFileSync(p));
    } else {
      h.update("missing");
    }
  }
  return h.digest("hex").slice(0, 16);
}

/** Recover nodes left in running after a crash. */
export function recoverStrandedRunningNodes(
  graph: ExecutionGraph,
): ExecutionGraph {
  return {
    ...graph,
    nodes: graph.nodes.map((n) =>
      n.status === "running"
        ? {
            ...n,
            status: "pending" as const,
            lastError: n.lastError ?? "recovered_from_stranded_running",
            blockingIssues: [
              ...n.blockingIssues.filter((b) => b !== "stranded_running"),
              "stranded_running",
            ],
          }
        : n,
    ),
  };
}
