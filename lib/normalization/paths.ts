import path from "node:path";
import fs from "node:fs";
import { projectPath } from "@/lib/project";

export const NORMALIZATION_ROOT = path.join(
  process.cwd(),
  "knowledge",
  "normalization",
);

export function normalizationPath(...parts: string[]): string {
  return path.join(NORMALIZATION_ROOT, ...parts);
}

export function ensureNormalizationDirs(): void {
  for (const sub of ["", "mappings", "indexes", "reviews"]) {
    fs.mkdirSync(normalizationPath(sub), { recursive: true });
  }
}

export function projectNormalizationDir(slug: string): string {
  return projectPath(slug, "knowledge", "normalization");
}

export function ensureProjectNormalizationDir(slug: string): void {
  fs.mkdirSync(projectNormalizationDir(slug), { recursive: true });
}
