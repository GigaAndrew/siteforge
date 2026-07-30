import fs from "node:fs";
import path from "node:path";
import { projectPath } from "@/lib/project";
import { ensureRuntimeDirs } from "@/forge-core/state/persist";
import {
  HistoryEventSchema,
  PlannerDecisionSchema,
  type HistoryEvent,
  type PlannerDecision,
} from "@/forge-core/state/schemas";

function appendJsonl(filePath: string, row: unknown): void {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.appendFileSync(filePath, `${JSON.stringify(row)}\n`, "utf8");
}

export function appendEvent(slug: string, event: HistoryEvent): void {
  ensureRuntimeDirs(slug);
  const parsed = HistoryEventSchema.parse(event);
  appendJsonl(projectPath(slug, "runtime/history/events.jsonl"), parsed);
}

export function appendDecision(slug: string, decision: PlannerDecision): void {
  ensureRuntimeDirs(slug);
  const parsed = PlannerDecisionSchema.parse(decision);
  appendJsonl(projectPath(slug, "runtime/history/decisions.jsonl"), parsed);
}

export function readEvents(slug: string, limit = 200): HistoryEvent[] {
  const p = projectPath(slug, "runtime/history/events.jsonl");
  if (!fs.existsSync(p)) return [];
  const lines = fs.readFileSync(p, "utf8").split("\n").filter(Boolean);
  const out: HistoryEvent[] = [];
  for (const l of lines.slice(-limit)) {
    try {
      out.push(HistoryEventSchema.parse(JSON.parse(l)));
    } catch {
      /* skip corrupt trailing lines */
    }
  }
  return out;
}

export function readDecisions(slug: string, limit = 100): PlannerDecision[] {
  const p = projectPath(slug, "runtime/history/decisions.jsonl");
  if (!fs.existsSync(p)) return [];
  const lines = fs.readFileSync(p, "utf8").split("\n").filter(Boolean);
  const out: PlannerDecision[] = [];
  for (const l of lines.slice(-limit)) {
    try {
      out.push(PlannerDecisionSchema.parse(JSON.parse(l)));
    } catch {
      /* skip corrupt trailing lines */
    }
  }
  return out;
}

export function emit(
  slug: string,
  runId: string,
  type: string,
  message: string,
  opts: { nodeId?: string | null; data?: Record<string, unknown> } = {},
): void {
  appendEvent(slug, {
    at: new Date().toISOString(),
    runId,
    type,
    nodeId: opts.nodeId ?? null,
    message,
    data: opts.data ?? {},
  });
}
