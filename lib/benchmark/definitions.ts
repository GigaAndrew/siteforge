import fs from "node:fs";
import {
  BenchmarkDefinitionSchema,
  type BenchmarkDefinition,
} from "@/lib/benchmark/schemas";
import { seedCfsCapabilityBenchmark } from "@/lib/benchmark/seed-definition";
import { benchmarkPath, ensureBenchmarkDirs } from "@/lib/benchmark/paths";
import { writeJson } from "@/lib/knowledge/paths";

export function ensureBenchmarkDefinitions(): BenchmarkDefinition[] {
  ensureBenchmarkDirs();
  const seed = seedCfsCapabilityBenchmark();
  const path = benchmarkPath("definitions", `${seed.id}.json`);
  if (!fs.existsSync(path)) {
    writeJson(path, seed);
  }
  return listBenchmarkDefinitions();
}

export function listBenchmarkDefinitions(): BenchmarkDefinition[] {
  ensureBenchmarkDirs();
  const dir = benchmarkPath("definitions");
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir)
    .filter((f) => f.endsWith(".json"))
    .map((f) =>
      BenchmarkDefinitionSchema.parse(
        JSON.parse(fs.readFileSync(pathJoin(dir, f), "utf8")),
      ),
    )
    .sort((a, b) => a.id.localeCompare(b.id));
}

function pathJoin(a: string, b: string): string {
  return `${a}/${b}`;
}

export function loadBenchmarkDefinition(
  id: string,
  version?: string,
): BenchmarkDefinition {
  ensureBenchmarkDefinitions();
  const defs = listBenchmarkDefinitions().filter((d) => d.id === id);
  if (!defs.length) throw new Error(`Unknown benchmark: ${id}`);
  if (version) {
    const match = defs.find((d) => d.version === version);
    if (!match) throw new Error(`Benchmark ${id}@${version} not found`);
    return match;
  }
  // Prefer accepted, then highest version string
  const accepted = defs.filter((d) => d.status === "accepted");
  const pool = accepted.length ? accepted : defs;
  return pool.sort((a, b) => b.version.localeCompare(a.version))[0]!;
}

export function saveBenchmarkDefinition(def: BenchmarkDefinition): void {
  ensureBenchmarkDirs();
  const parsed = BenchmarkDefinitionSchema.parse({
    ...def,
    updated_at: new Date().toISOString(),
  });
  writeJson(benchmarkPath("definitions", `${parsed.id}.json`), parsed);
}
