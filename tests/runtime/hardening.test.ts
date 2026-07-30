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
import { createBudgets, checkBudgets } from "@/forge-core/budgets/track";
import {
  loadGraph,
  loadRunState,
  loadApprovals,
  updateNode,
  saveGraph,
  invalidateDownstream,
  recoverStrandedRunningNodes,
} from "@/forge-core/state/persist";
import {
  approve,
  resetNode,
} from "@/forge-core/runtime/controller";
import {
  canTransitionNode,
  canTransitionRun,
} from "@/forge-core/state/transitions";
import {
  acquireRuntimeLock,
  releaseRuntimeLock,
} from "@/forge-core/runtime/lock";
import { assertValidProjectSlug, PROJECTS_ROOT } from "@/lib/project";

const SLUG = "runtime-harden-fixture";

function wipe() {
  const dir = path.join(PROJECTS_ROOT, SLUG);
  if (fs.existsSync(dir)) fs.rmSync(dir, { recursive: true, force: true });
}

function writeConfig() {
  fs.mkdirSync(path.join(PROJECTS_ROOT, SLUG), { recursive: true });
  fs.writeFileSync(
    path.join(PROJECTS_ROOT, SLUG, "config.json"),
    JSON.stringify({
      name: "Harden Fixture",
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
}

describe("runtime hardening", () => {
  beforeEach(async () => {
    clearRegistryForTests();
    wipe();
    writeConfig();
    await ensureCapabilitiesRegistered();
    seedExecution(SLUG, { approvalMode: "mixed" });
  });

  afterEach(() => {
    wipe();
    clearRegistryForTests();
  });

  it("rejects path-traversal slugs", () => {
    expect(() => assertValidProjectSlug("../etc")).toThrow(/Invalid/);
    expect(() => assertValidProjectSlug("EB Metal")).toThrow(/Invalid/);
  });

  it("enforces legal node transitions", () => {
    expect(canTransitionNode("pending", "running")).toBe(true);
    expect(canTransitionNode("passed", "running")).toBe(false);
    expect(canTransitionRun("completed", "running")).toBe(false);
    expect(canTransitionRun("paused", "running")).toBe(true);
  });

  it("recovers stranded running nodes", () => {
    let graph = loadGraph(SLUG)!;
    graph = updateNode(graph, "n_crawl", { status: "running" });
    graph = recoverStrandedRunningNodes(graph);
    expect(getStatus(graph, "n_crawl")).toBe("pending");
  });

  it("clears outputs on invalidateDownstream", () => {
    let graph = loadGraph(SLUG)!;
    graph = updateNode(graph, "n_crawl", {
      status: "passed",
      outputs: ["source/pages.json"],
      qualityScore: 0.9,
      retries: 2,
    });
    graph = updateNode(graph, "n_extract", {
      status: "passed",
      outputs: ["source/pages.json"],
    });
    graph = invalidateDownstream(graph, "n_crawl");
    const crawl = graph.nodes.find((n) => n.id === "n_crawl")!;
    const extract = graph.nodes.find((n) => n.id === "n_extract")!;
    expect(crawl.status).toBe("pending");
    expect(crawl.outputs).toEqual([]);
    expect(crawl.retries).toBe(0);
    expect(extract.status).toBe("invalidated");
    expect(extract.outputs).toEqual([]);
  });

  it("blocks early approval before upstream passes", () => {
    expect(() =>
      approve(SLUG, "strategy.accept", { actor: "test" }),
    ).toThrow(/dependency/);
  });

  it("binds approval to graph revision when gate is ready", () => {
    let graph = loadGraph(SLUG)!;
    const strategy = graph.nodes.find((n) => n.id === "n_strategy_accept")!;
    for (const dep of strategy.dependencies) {
      graph = updateNode(graph, dep, {
        status: "passed",
        outputs: ["design/design-tokens.json"],
      });
    }
    // Mark all earlier nodes passed so deps of strategy are ok
    for (const n of graph.nodes) {
      if (
        n.id === "n_strategy_accept" ||
        n.id.startsWith("n_prototype") ||
        n.id.startsWith("n_browser") ||
        n.id.startsWith("n_pitch") ||
        n.id === "n_lessons" ||
        n.id === "n_improvements"
      ) {
        continue;
      }
      graph = updateNode(graph, n.id, { status: "passed", outputs: n.outputs });
    }
    graph = updateNode(graph, "n_strategy_accept", {
      status: "waiting_approval",
    });
    saveGraph(graph);

    approve(SLUG, "strategy.accept", { actor: "test", reason: "ok" });
    const approvals = loadApprovals(SLUG)!;
    const d = approvals.decisions.find((x) => x.key === "strategy.accept")!;
    expect(d.status).toBe("approved");
    expect(d.graphRevision).toBeTypeOf("number");
    expect(d.actor).toBe("test");
  });

  it("resetNode invalidates downstream approvals", () => {
    let graph = loadGraph(SLUG)!;
    for (const n of graph.nodes) {
      if (n.id === "n_strategy_accept") {
        graph = updateNode(graph, n.id, { status: "waiting_approval" });
      } else if (
        !n.id.startsWith("n_prototype") &&
        !n.id.startsWith("n_browser") &&
        !n.id.startsWith("n_pitch") &&
        n.id !== "n_lessons" &&
        n.id !== "n_improvements"
      ) {
        graph = updateNode(graph, n.id, {
          status: "passed",
          outputs: ["design/design-tokens.json"],
        });
      }
    }
    saveGraph(graph);
    approve(SLUG, "strategy.accept", { actor: "test" });
    resetNode(SLUG, "n_strategy");
    const approvals = loadApprovals(SLUG)!;
    const d = approvals.decisions.find((x) => x.key === "strategy.accept")!;
    expect(d.status).toBe("pending");
    expect(d.invalidated).toBe(true);
  });

  it("prevents concurrent locks", () => {
    const a = acquireRuntimeLock(SLUG);
    expect(() => acquireRuntimeLock(SLUG)).toThrow(/lock held/);
    releaseRuntimeLock(a);
    const b = acquireRuntimeLock(SLUG);
    releaseRuntimeLock(b);
  });

  it("budget exhaustion pauses planning", () => {
    const graph = loadGraph(SLUG)!;
    const run = loadRunState(SLUG)!;
    const budgets = {
      ...createBudgets(policiesForMode("mixed")),
      maxInvocations: 1,
      invocationsUsed: 1,
    };
    expect(checkBudgets(budgets).ok).toBe(false);
    const planned = planNextAction({
      slug: SLUG,
      graph,
      run,
      policies: policiesForMode("mixed"),
      budgets,
    });
    expect(planned.action.kind).toBe("pause");
  });

  it("loop set does not retain inactive loops forever", () => {
    const graph = loadGraph(SLUG)!;
    const run = {
      ...loadRunState(SLUG)!,
      activeLoops: ["audit", "evidence", "prototype"],
      loopIterations: { audit: 99 },
    };
    const planned = planNextAction({
      slug: SLUG,
      graph,
      run,
      policies: policiesForMode("mixed"),
      budgets: createBudgets(policiesForMode("mixed")),
    });
    // audit exhausted (99 >= max) and should not remain solely from prior activeLoops
    expect(planned.activeLoops.includes("audit")).toBe(false);
  });
});

function getStatus(
  graph: ReturnType<typeof loadGraph>,
  id: string,
): string | undefined {
  return graph?.nodes.find((n) => n.id === id)?.status;
}
