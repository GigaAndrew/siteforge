import type { RuntimePolicies } from "@/forge-core/policies/defaults";
import type {
  ApprovalMode,
  BudgetSnapshot,
  ExecutionGraph,
  ExecutionNode,
  RunState,
} from "@/forge-core/state/schemas";

export type QualityFinding = {
  severity: "critical" | "high" | "medium" | "low" | "info";
  code: string;
  message: string;
};

export type CapabilityResult = {
  ok: boolean;
  artifacts: string[];
  qualityFindings: QualityFinding[];
  confidenceDelta: number;
  qualityScore: number;
  blockingIssues: string[];
  suggestedInvalidations: string[];
  metrics: Record<string, number | string | boolean>;
  message?: string;
};

export type CapabilityContext = {
  slug: string;
  node: ExecutionNode;
  graph: ExecutionGraph;
  run: RunState;
  policies: RuntimePolicies;
  budgets: BudgetSnapshot;
  force?: boolean;
};

export type RetryPolicy = {
  maxRetries: number;
  backoffMs: number;
  alternateCapability?: string;
};

export type CapabilityDescriptor = {
  name: string;
  /** Semver-ish capability contract version. Defaults to 1.0.0 at registration. */
  version?: string;
  purpose: string;
  consumes: string[];
  produces: string[];
  prerequisites: string[];
  completionCriteria: string[];
  estimatedCost: number;
  estimatedRuntimeMs: number;
  confidenceGain: number;
  qualityGates: string[];
  failureConditions: string[];
  retryPolicy: RetryPolicy;
  humanApprovalRequirement: string | null;
  /** Soft priority hint for planner when multiple nodes ready (higher = sooner). */
  plannerWeight: number;
  /** When true, consulting completion should be flagged as demo-grade. */
  demoOnly?: boolean;
  /** When false, planner treats capability as unavailable. */
  available?: boolean;
};

export type CapabilityHandler = {
  descriptor: CapabilityDescriptor;
  isComplete: (ctx: CapabilityContext) => boolean;
  execute: (ctx: CapabilityContext) => Promise<CapabilityResult>;
};

export type NextAction =
  | {
      kind: "execute";
      nodeId: string;
      capability: string;
      score: number;
      rationale: string;
    }
  | {
      kind: "await_approval";
      nodeId: string;
      approvalKey: string;
      score: number;
      rationale: string;
    }
  | {
      kind: "complete";
      score: number;
      rationale: string;
    }
  | {
      kind: "pause";
      score: number;
      rationale: string;
      reason: string;
    }
  | {
      kind: "fail";
      score: number;
      rationale: string;
      reason: string;
    };

export type PlannerCandidate = {
  nodeId: string;
  capability: string;
  score: number;
  reason: string;
  needsApproval: boolean;
  approvalKey: string | null;
};

export type CreateRunOptions = {
  slug: string;
  goal?: string;
  approvalMode?: ApprovalMode;
  force?: boolean;
};
