import fs from "node:fs";
import path from "node:path";
import { projectPath } from "@/lib/project";

export const BENCHMARK_ROOT = path.join(process.cwd(), "knowledge", "benchmarks");

export function benchmarkPath(...parts: string[]): string {
  return path.join(BENCHMARK_ROOT, ...parts);
}

export function ensureBenchmarkDirs(): void {
  for (const sub of ["", "definitions", "runs", "approvals", "indexes"]) {
    fs.mkdirSync(benchmarkPath(sub), { recursive: true });
  }
}

export function projectBenchmarkDir(
  slug: string,
  benchmarkId: string,
  version: string,
): string {
  return projectPath(slug, "benchmark", benchmarkId, version);
}

export function ensureProjectBenchmarkDir(
  slug: string,
  benchmarkId: string,
  version: string,
): string {
  const dir = projectBenchmarkDir(slug, benchmarkId, version);
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}
