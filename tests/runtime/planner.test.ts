import { describe, expect, it, beforeEach, afterEach } from "vitest";
import fs from "node:fs";
import path from "node:path";
import {
  clearRegistryForTests,
  ensureCapabilitiesRegistered,
} from "@/forge-core/capabilities/registry";
import { seedExecution } from "@/forge-core/state/seed";
import { planNextAction } from "@/forge-core/planner/plan";
import { policiesForMode } from "@/forge-core/policies/defaults";
import { createBudgets } from "@/forge-core/budgets/track";
import { checkBudgets, recordInvocation } from "@/forge-core/budgets/track";
import {
  loadGraph,
  loadRunState,
  updateNode,
  saveGraph,
} from "@/forge-core/state/persist";
import { PROJECTS_ROOT } from "@/lib/project";

const SLUG = "runtime-test-fixture";

function wipe() {
  const dir = path.join(PROJECTS_ROOT, SLUG);
  if (fs.existsSync(dir)) fs.rmSync(dir, { recursive: true, force: true });
}

describe("planner + budgets", () => {
  beforeEach(async () => {
    clearRegistryForTests();
    wipe();
    fs.mkdirSync(path.join(PROJECTS_ROOT, SLUG), { recursive: true });
    fs.writeFileSync(
      path.join(PROJECTS_ROOT, SLUG, "config.json"),
      JSON.stringify({
        name: "Runtime Fixture",
        slug: SLUG,
        websiteUrl: "https://example.com",
        approvedHosts: ["example.com"],
        industry: "Test",
        maxCrawlPages: 5,
        crawlDelayMs: 0,
        prototypeDepth: "homepage_concept",
        modules: [],
        notes: "",
        stage: "created",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }),
      "utf8",
    );
    await ensureCapabilitiesRegistered();
    seedExecution(SLUG, { approvalMode: "mixed" });
  });

  afterEach(() => {
    wipe();
    clearRegistryForTests();
  });

  it("plans crawl first when nothing is complete", () => {
    const graph = loadGraph(SLUG)!;
    const run = loadRunState(SLUG)!;
    const planned = planNextAction({
      slug: SLUG,
      graph,
      run,
      policies: policiesForMode("mixed"),
      budgets: createBudgets(policiesForMode("mixed")),
    });
    expect(planned.action.kind).toBe("execute");
    if (planned.action.kind === "execute") {
      expect(planned.action.capability).toBe("crawl.run");
    }
  });

  it("pauses for strategy approval when strategy node is ready", () => {
    let graph = loadGraph(SLUG)!;
    for (const n of graph.nodes) {
      if (n.id === "n_strategy_accept") continue;
      if (
        n.id.startsWith("n_prototype") ||
        n.id.startsWith("n_browser") ||
        n.id.startsWith("n_pitch") ||
        n.id === "n_lessons" ||
        n.id === "n_improvements" ||
        n.id === "n_reports"
      ) {
        continue;
      }
      graph = updateNode(graph, n.id, { status: "passed" });
    }
    graph = updateNode(graph, "n_reports", { status: "passed" });
    saveGraph(graph);
    const run = loadRunState(SLUG)!;
    const planned = planNextAction({
      slug: SLUG,
      graph: loadGraph(SLUG)!,
      run,
      policies: policiesForMode("mixed"),
      budgets: createBudgets(policiesForMode("mixed")),
    });
    expect(planned.action.kind).toBe("await_approval");
    if (planned.action.kind === "await_approval") {
      expect(planned.action.approvalKey).toBe("strategy.accept");
    }
  });

  it("budget check blocks when invocations exhausted", () => {
    let budgets = createBudgets(policiesForMode("mixed"));
    budgets = { ...budgets, maxInvocations: 1, invocationsUsed: 1 };
    const check = checkBudgets(budgets);
    expect(check.ok).toBe(false);
  });

  it("recordInvocation increments counters", () => {
    let budgets = createBudgets(policiesForMode("mixed"));
    budgets = recordInvocation(budgets, { runtimeMs: 10, playwright: true });
    expect(budgets.invocationsUsed).toBe(1);
    expect(budgets.playwrightLaunchesUsed).toBe(1);
  });
});
