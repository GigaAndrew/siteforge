import type { NodeStatus, RunStatus } from "@/forge-core/state/schemas";

const NODE_TRANSITIONS: Record<NodeStatus, NodeStatus[]> = {
  pending: ["ready", "running", "skipped", "waiting_approval", "invalidated"],
  ready: ["running", "skipped", "pending", "invalidated"],
  running: [
    "passed",
    "failed",
    "pending",
    "waiting_approval",
    "invalidated",
  ],
  waiting_approval: ["pending", "passed", "failed", "invalidated", "running"],
  passed: ["invalidated", "pending"],
  failed: ["pending", "invalidated"],
  skipped: ["pending", "invalidated"],
  invalidated: ["pending"],
};

const RUN_TRANSITIONS: Record<RunStatus, RunStatus[]> = {
  idle: ["running", "cancelled"],
  running: [
    "paused",
    "waiting_approval",
    "completed",
    "failed",
    "cancelled",
  ],
  paused: ["running", "cancelled", "failed", "waiting_approval"],
  waiting_approval: ["paused", "running", "cancelled", "failed"],
  completed: [], // terminal unless reset/reseed
  failed: ["paused", "running", "cancelled"],
  cancelled: [],
};

export function canTransitionNode(
  from: NodeStatus,
  to: NodeStatus,
): boolean {
  if (from === to) return true;
  return NODE_TRANSITIONS[from]?.includes(to) ?? false;
}

export function canTransitionRun(from: RunStatus, to: RunStatus): boolean {
  if (from === to) return true;
  return RUN_TRANSITIONS[from]?.includes(to) ?? false;
}

export function assertNodeTransition(
  from: NodeStatus,
  to: NodeStatus,
  context = "node",
): void {
  if (!canTransitionNode(from, to)) {
    throw new Error(`Illegal ${context} transition: ${from} → ${to}`);
  }
}

export function assertRunTransition(
  from: RunStatus,
  to: RunStatus,
  context = "run",
): void {
  if (!canTransitionRun(from, to)) {
    throw new Error(`Illegal ${context} transition: ${from} → ${to}`);
  }
}
