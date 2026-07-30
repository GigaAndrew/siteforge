import type { RuntimePolicies } from "@/forge-core/policies/defaults";
import type { BudgetSnapshot } from "@/forge-core/state/schemas";

export function createBudgets(policies: RuntimePolicies): BudgetSnapshot {
  return {
    maxWallClockMs: policies.maxWallClockMs,
    maxInvocations: policies.maxInvocations,
    maxRetriesPerNode: policies.maxRetriesPerNode,
    maxTokens: 0,
    maxPlaywrightLaunches: policies.maxPlaywrightLaunches,
    wallClockMsUsed: 0,
    invocationsUsed: 0,
    tokensUsed: 0,
    playwrightLaunchesUsed: 0,
    startedAt: new Date().toISOString(),
  };
}

export type BudgetCheck =
  | { ok: true }
  | { ok: false; reason: string };

export function checkBudgets(budgets: BudgetSnapshot): BudgetCheck {
  if (budgets.startedAt) {
    const elapsed = Date.now() - new Date(budgets.startedAt).getTime();
    const used = Math.max(budgets.wallClockMsUsed, elapsed);
    if (used > budgets.maxWallClockMs) {
      return { ok: false, reason: "wall_clock_budget_exceeded" };
    }
  }
  if (budgets.invocationsUsed >= budgets.maxInvocations) {
    return { ok: false, reason: "invocation_budget_exceeded" };
  }
  if (budgets.playwrightLaunchesUsed >= budgets.maxPlaywrightLaunches) {
    return { ok: false, reason: "playwright_budget_exceeded" };
  }
  return { ok: true };
}

export function recordInvocation(
  budgets: BudgetSnapshot,
  opts: { runtimeMs?: number; playwright?: boolean; tokens?: number } = {},
): BudgetSnapshot {
  const started = budgets.startedAt
    ? new Date(budgets.startedAt).getTime()
    : Date.now();
  return {
    ...budgets,
    invocationsUsed: budgets.invocationsUsed + 1,
    wallClockMsUsed: Math.max(
      budgets.wallClockMsUsed,
      Date.now() - started,
      budgets.wallClockMsUsed + (opts.runtimeMs ?? 0),
    ),
    playwrightLaunchesUsed:
      budgets.playwrightLaunchesUsed + (opts.playwright ? 1 : 0),
    tokensUsed: budgets.tokensUsed + (opts.tokens ?? 0),
  };
}
