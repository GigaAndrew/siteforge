import type { ExecutionGraph } from "@/forge-core/state/schemas";

export type GraphValidationIssue = {
  severity: "critical" | "high";
  code: string;
  message: string;
};

/** Detect duplicate IDs, missing deps, and cycles. */
export function validateExecutionGraph(
  graph: ExecutionGraph,
): GraphValidationIssue[] {
  const issues: GraphValidationIssue[] = [];
  const ids = new Set<string>();
  for (const n of graph.nodes) {
    if (ids.has(n.id)) {
      issues.push({
        severity: "critical",
        code: "duplicate_node_id",
        message: `Duplicate node id ${n.id}`,
      });
    }
    ids.add(n.id);
  }
  for (const n of graph.nodes) {
    for (const d of n.dependencies) {
      if (!ids.has(d)) {
        issues.push({
          severity: "high",
          code: "missing_dependency",
          message: `Node ${n.id} depends on missing ${d}`,
        });
      }
      if (d === n.id) {
        issues.push({
          severity: "critical",
          code: "self_dependency",
          message: `Node ${n.id} depends on itself`,
        });
      }
    }
  }

  // Cycle detection (DFS)
  const visiting = new Set<string>();
  const visited = new Set<string>();
  const byId = new Map(graph.nodes.map((n) => [n.id, n]));

  function dfs(id: string, stack: string[]): void {
    if (visited.has(id)) return;
    if (visiting.has(id)) {
      issues.push({
        severity: "critical",
        code: "dependency_cycle",
        message: `Cycle detected: ${[...stack, id].join(" → ")}`,
      });
      return;
    }
    visiting.add(id);
    const node = byId.get(id);
    for (const d of node?.dependencies ?? []) {
      if (byId.has(d)) dfs(d, [...stack, id]);
    }
    visiting.delete(id);
    visited.add(id);
  }

  for (const n of graph.nodes) dfs(n.id, []);
  return issues;
}

export function assertValidGraph(graph: ExecutionGraph): void {
  const issues = validateExecutionGraph(graph);
  const blocking = issues.filter(
    (i) => i.severity === "critical" || i.severity === "high",
  );
  if (blocking.length) {
    throw new Error(
      `Invalid execution graph: ${blocking.map((i) => i.message).join("; ")}`,
    );
  }
}
