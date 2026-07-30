import { describe, expect, it, beforeEach } from "vitest";
import {
  clearRegistryForTests,
  ensureCapabilitiesRegistered,
  getCapability,
  listCapabilities,
  registerCapability,
} from "@/forge-core/capabilities/registry";
import type { CapabilityHandler } from "@/forge-core/capabilities/types";
import { validateExecutionGraph } from "@/forge-core/state/validate-graph";
import type { ExecutionGraph } from "@/forge-core/state/schemas";

function noop(name: string): CapabilityHandler {
  return {
    descriptor: {
      name,
      version: "1.0.0",
      purpose: "noop",
      consumes: [],
      produces: [],
      prerequisites: [],
      completionCriteria: [],
      estimatedCost: 0,
      estimatedRuntimeMs: 0,
      confidenceGain: 0,
      qualityGates: [],
      failureConditions: [],
      retryPolicy: { maxRetries: 0, backoffMs: 0 },
      humanApprovalRequirement: null,
      plannerWeight: 1,
    },
    isComplete: () => true,
    execute: async () => ({
      ok: true,
      artifacts: [],
      qualityFindings: [],
      confidenceDelta: 0,
      qualityScore: 1,
      blockingIssues: [],
      suggestedInvalidations: [],
      metrics: {},
    }),
  };
}

describe("capability registry", () => {
  beforeEach(() => {
    clearRegistryForTests();
  });

  it("registers built-in capabilities with versions", async () => {
    await ensureCapabilitiesRegistered();
    const names = listCapabilities().map((c) => c.descriptor.name);
    expect(names).toContain("crawl.run");
    expect(names).toContain("prototype.generate");
    const proto = getCapability("prototype.generate");
    expect(proto?.descriptor.demoOnly).toBe(true);
    expect(proto?.descriptor.version).toBeTruthy();
  });

  it("rejects duplicate capability names", async () => {
    await ensureCapabilitiesRegistered();
    expect(() => registerCapability(noop("crawl.run"))).toThrow(/Duplicate/);
  });

  it("allows register-only extension of new names", async () => {
    await ensureCapabilitiesRegistered();
    registerCapability(noop("test.noop"));
    expect(getCapability("test.noop")?.descriptor.name).toBe("test.noop");
  });

  it("detects dependency cycles in graphs", () => {
    const graph: ExecutionGraph = {
      schemaVersion: "1.0.0",
      projectSlug: "x",
      goal: "g",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      revision: 0,
      nodes: [
        {
          id: "a",
          type: "T",
          capability: "crawl.run",
          inputs: {},
          outputs: [],
          dependencies: ["b"],
          status: "pending",
          confidence: 0,
          qualityScore: 0,
          startedAt: null,
          completedAt: null,
          runtimeMs: 0,
          cost: 0,
          retries: 0,
          blockingIssues: [],
          nextActions: [],
          loopId: null,
          approvalKey: null,
          lastError: null,
        },
        {
          id: "b",
          type: "T",
          capability: "crawl.run",
          inputs: {},
          outputs: [],
          dependencies: ["a"],
          status: "pending",
          confidence: 0,
          qualityScore: 0,
          startedAt: null,
          completedAt: null,
          runtimeMs: 0,
          cost: 0,
          retries: 0,
          blockingIssues: [],
          nextActions: [],
          loopId: null,
          approvalKey: null,
          lastError: null,
        },
      ],
    };
    const issues = validateExecutionGraph(graph);
    expect(issues.some((i) => i.code === "dependency_cycle")).toBe(true);
  });
});
