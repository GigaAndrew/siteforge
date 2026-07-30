import fs from "node:fs";
import { createHash } from "node:crypto";
import {
  BenchmarkApprovalSchema,
  type BenchmarkApproval,
} from "@/lib/benchmark/schemas";
import { benchmarkPath, ensureBenchmarkDirs } from "@/lib/benchmark/paths";
import { writeJson } from "@/lib/knowledge/paths";

export function digestPayload(payload: unknown): string {
  return createHash("sha256")
    .update(JSON.stringify(payload))
    .digest("hex")
    .slice(0, 24);
}

function approvalsFile(): string {
  return benchmarkPath("approvals", "log.json");
}

export function loadApprovals(): BenchmarkApproval[] {
  ensureBenchmarkDirs();
  const path = approvalsFile();
  if (!fs.existsSync(path)) return [];
  const raw = JSON.parse(fs.readFileSync(path, "utf8")) as unknown[];
  return raw
    .map((a) => BenchmarkApprovalSchema.safeParse(a))
    .filter((r) => r.success)
    .map((r) => r.data);
}

export function saveApprovals(list: BenchmarkApproval[]): void {
  ensureBenchmarkDirs();
  writeJson(approvalsFile(), list);
}

export function recordApproval(input: {
  key: BenchmarkApproval["key"];
  artifactId: string;
  artifactVersion: string;
  payload: unknown;
  reviewer: string;
  decision: BenchmarkApproval["decision"];
  rationale: string;
}): BenchmarkApproval {
  const entry = BenchmarkApprovalSchema.parse({
    key: input.key,
    artifactId: input.artifactId,
    artifactVersion: input.artifactVersion,
    digest: digestPayload(input.payload),
    reviewer: input.reviewer,
    timestamp: new Date().toISOString(),
    decision: input.decision,
    rationale: input.rationale,
    valid: true,
    invalidatedReason: null,
  });
  const all = loadApprovals().filter(
    (a) =>
      !(
        a.key === entry.key &&
        a.artifactId === entry.artifactId &&
        a.artifactVersion === entry.artifactVersion
      ),
  );
  all.push(entry);
  saveApprovals(all);
  return entry;
}

/** Invalidate approvals when definition version / digest no longer matches. */
export function invalidateStaleApprovals(
  artifactId: string,
  currentVersion: string,
  currentPayload: unknown,
  reason: string,
): number {
  const digest = digestPayload(currentPayload);
  const all = loadApprovals();
  let n = 0;
  for (const a of all) {
    if (a.artifactId !== artifactId || !a.valid) continue;
    if (a.artifactVersion !== currentVersion || a.digest !== digest) {
      a.valid = false;
      a.invalidatedReason = reason;
      n++;
    }
  }
  if (n) saveApprovals(all);
  return n;
}

export function requiredApprovalsForPublish(
  benchmarkId: string,
  version: string,
): { key: BenchmarkApproval["key"]; satisfied: boolean }[] {
  const all = loadApprovals().filter(
    (a) =>
      a.valid &&
      a.artifactId === benchmarkId &&
      a.artifactVersion === version &&
      a.decision === "approved",
  );
  const keys: BenchmarkApproval["key"][] = [
    "benchmark.definition.review",
    "benchmark.observation.review",
    "benchmark.publish",
  ];
  return keys.map((key) => ({
    key,
    satisfied: all.some((a) => a.key === key),
  }));
}
