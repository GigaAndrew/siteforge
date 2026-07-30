import { z } from "zod";

export const NodeStatusSchema = z.enum([
  "pending",
  "ready",
  "running",
  "waiting_approval",
  "passed",
  "failed",
  "skipped",
  "invalidated",
]);

export const ApprovalModeSchema = z.enum(["auto", "mixed", "strict"]);

export const RunStatusSchema = z.enum([
  "idle",
  "running",
  "paused",
  "waiting_approval",
  "completed",
  "failed",
  "cancelled",
]);

export const ExecutionNodeSchema = z.object({
  id: z.string(),
  type: z.string(),
  capability: z.string(),
  inputs: z.record(z.string(), z.unknown()).default({}),
  outputs: z.array(z.string()).default([]),
  dependencies: z.array(z.string()).default([]),
  status: NodeStatusSchema.default("pending"),
  confidence: z.number().min(0).max(1).default(0),
  qualityScore: z.number().min(0).max(1).default(0),
  startedAt: z.string().nullable().default(null),
  completedAt: z.string().nullable().default(null),
  runtimeMs: z.number().nonnegative().default(0),
  cost: z.number().nonnegative().default(0),
  retries: z.number().int().nonnegative().default(0),
  blockingIssues: z.array(z.string()).default([]),
  nextActions: z.array(z.string()).default([]),
  loopId: z.string().nullable().default(null),
  approvalKey: z.string().nullable().default(null),
  lastError: z.string().nullable().default(null),
});

export const ExecutionGraphSchema = z.object({
  schemaVersion: z.literal("1.0.0"),
  projectSlug: z.string(),
  goal: z.string(),
  createdAt: z.string(),
  updatedAt: z.string(),
  /** Monotonic revision bumped on structural/status mutations. */
  revision: z.number().int().nonnegative().default(0),
  nodes: z.array(ExecutionNodeSchema),
});

export const BudgetSnapshotSchema = z.object({
  maxWallClockMs: z.number().positive(),
  maxInvocations: z.number().int().positive(),
  maxRetriesPerNode: z.number().int().nonnegative(),
  maxTokens: z.number().nonnegative().default(0),
  maxPlaywrightLaunches: z.number().int().positive().default(50),
  wallClockMsUsed: z.number().nonnegative().default(0),
  invocationsUsed: z.number().int().nonnegative().default(0),
  tokensUsed: z.number().nonnegative().default(0),
  playwrightLaunchesUsed: z.number().int().nonnegative().default(0),
  startedAt: z.string().nullable().default(null),
});

export const ApprovalDecisionSchema = z.object({
  key: z.string(),
  status: z.enum(["pending", "approved", "rejected"]),
  actor: z.string().nullable().default(null),
  reason: z.string().nullable().default(null),
  decidedAt: z.string().nullable().default(null),
  nodeId: z.string().nullable().default(null),
  /** Graph revision at decision time — invalidated if graph moves past this. */
  graphRevision: z.number().int().nonnegative().nullable().default(null),
  /** Optional digest of primary artifact(s) approved. */
  artifactDigest: z.string().nullable().default(null),
  invalidated: z.boolean().default(false),
  invalidatedReason: z.string().nullable().default(null),
});

export const ApprovalsFileSchema = z.object({
  schemaVersion: z.literal("1.0.0"),
  projectSlug: z.string(),
  decisions: z.array(ApprovalDecisionSchema),
  updatedAt: z.string(),
});

export const RunStateSchema = z.object({
  schemaVersion: z.literal("1.0.0"),
  projectSlug: z.string(),
  runId: z.string(),
  status: RunStatusSchema,
  approvalMode: ApprovalModeSchema,
  goal: z.string(),
  currentNodeId: z.string().nullable().default(null),
  activeLoops: z.array(z.string()).default([]),
  loopIterations: z.record(z.string(), z.number()).default({}),
  pauseReason: z.string().nullable().default(null),
  lastPlannerRationale: z.string().nullable().default(null),
  lastDecisionAt: z.string().nullable().default(null),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export const PlannerDecisionSchema = z.object({
  at: z.string(),
  runId: z.string(),
  action: z.string(),
  nodeId: z.string().nullable(),
  capability: z.string().nullable(),
  score: z.number(),
  rationale: z.string(),
  candidates: z.array(
    z.object({
      nodeId: z.string(),
      capability: z.string(),
      score: z.number(),
      reason: z.string(),
    }),
  ),
});

export const HistoryEventSchema = z.object({
  at: z.string(),
  runId: z.string(),
  type: z.string(),
  nodeId: z.string().nullable().default(null),
  message: z.string(),
  data: z.record(z.string(), z.unknown()).default({}),
});

export type NodeStatus = z.infer<typeof NodeStatusSchema>;
export type ApprovalMode = z.infer<typeof ApprovalModeSchema>;
export type RunStatus = z.infer<typeof RunStatusSchema>;
export type ExecutionNode = z.infer<typeof ExecutionNodeSchema>;
export type ExecutionGraph = z.infer<typeof ExecutionGraphSchema>;
export type BudgetSnapshot = z.infer<typeof BudgetSnapshotSchema>;
export type ApprovalDecision = z.infer<typeof ApprovalDecisionSchema>;
export type ApprovalsFile = z.infer<typeof ApprovalsFileSchema>;
export type RunState = z.infer<typeof RunStateSchema>;
export type PlannerDecision = z.infer<typeof PlannerDecisionSchema>;
export type HistoryEvent = z.infer<typeof HistoryEventSchema>;
