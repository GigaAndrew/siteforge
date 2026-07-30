import type { ApprovalMode } from "@/forge-core/state/schemas";

export type RuntimePolicies = {
  approvalMode: ApprovalMode;
  maxCrawlPages: number;
  minEvidenceConfidence: number;
  minPrototypeScore: number;
  minPitchConfidence: number;
  requireBrowserQa: boolean;
  requireAccessibility: boolean;
  maxWallClockMs: number;
  maxInvocations: number;
  maxRetriesPerNode: number;
  maxLoopIterations: number;
  maxPlaywrightLaunches: number;
  knowledgeCriticalHighMustBeZero: boolean;
  autoApproveKeys: string[];
  pauseApprovalKeys: string[];
};

export const DEFAULT_POLICIES: RuntimePolicies = {
  approvalMode: "mixed",
  maxCrawlPages: 75,
  minEvidenceConfidence: 0.4,
  minPrototypeScore: 0.5,
  minPitchConfidence: 0.4,
  requireBrowserQa: true,
  requireAccessibility: true,
  maxWallClockMs: 45 * 60 * 1000,
  maxInvocations: 80,
  maxRetriesPerNode: 2,
  maxLoopIterations: 3,
  maxPlaywrightLaunches: 40,
  knowledgeCriticalHighMustBeZero: true,
  autoApproveKeys: [],
  pauseApprovalKeys: [
    "strategy.accept",
    "prototype.approve",
    "pitch.approve",
  ],
};

export function policiesForMode(mode: ApprovalMode): RuntimePolicies {
  if (mode === "auto") {
    return {
      ...DEFAULT_POLICIES,
      approvalMode: "auto",
      pauseApprovalKeys: [],
    };
  }
  if (mode === "strict") {
    return {
      ...DEFAULT_POLICIES,
      approvalMode: "strict",
      pauseApprovalKeys: [
        "crawl.continue",
        "strategy.accept",
        "prototype.approve",
        "pitch.approve",
        "pattern.promote",
      ],
    };
  }
  return { ...DEFAULT_POLICIES, approvalMode: "mixed" };
}

export function requiresHumanApproval(
  policies: RuntimePolicies,
  approvalKey: string | null | undefined,
): boolean {
  if (!approvalKey) return false;
  if (policies.approvalMode === "auto") return false;
  return policies.pauseApprovalKeys.includes(approvalKey);
}
