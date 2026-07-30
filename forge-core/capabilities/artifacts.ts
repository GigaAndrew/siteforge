import fs from "node:fs";
import { fileExists, projectPath } from "@/lib/project";

export function hasArtifact(slug: string, rel: string): boolean {
  return fileExists(slug, rel);
}

export function allArtifacts(slug: string, rels: string[]): boolean {
  return rels.every((r) => hasArtifact(slug, r));
}

export function artifactMtime(slug: string, rel: string): number {
  const p = projectPath(slug, rel);
  if (!fs.existsSync(p)) return 0;
  return fs.statSync(p).mtimeMs;
}
