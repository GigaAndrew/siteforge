import fs from "node:fs";
import path from "node:path";
import {
  listProjectSlugs,
  projectPath,
  readProjectConfig,
} from "@/lib/project";
import type { ProjectConfig } from "@/lib/schemas/project";

export type ProjectSummary = {
  config: ProjectConfig;
  hasCrawl: boolean;
  hasScreenshots: boolean;
  hasAudit: boolean;
  hasStrategy: boolean;
  hasTokens: boolean;
};

export function getProjectSummaries(): ProjectSummary[] {
  return listProjectSlugs().map((slug) => {
    const config = readProjectConfig(slug);
    return {
      config,
      hasCrawl: fs.existsSync(projectPath(slug, "source/pages.json")),
      hasScreenshots: fs.existsSync(projectPath(slug, "screenshots/manifest.json")),
      hasAudit: fs.existsSync(projectPath(slug, "analysis/executive-audit.md")),
      hasStrategy: fs.existsSync(projectPath(slug, "strategy/proposed-sitemap.md")),
      hasTokens: fs.existsSync(projectPath(slug, "design/design-tokens.json")),
    };
  });
}

export function readDesignTokens(slug: string): Record<string, unknown> | null {
  const file = projectPath(slug, "design/design-tokens.json");
  if (!fs.existsSync(file)) return null;
  return JSON.parse(fs.readFileSync(file, "utf8")) as Record<string, unknown>;
}

export function readTextArtifact(slug: string, rel: string): string | null {
  const file = projectPath(slug, rel);
  if (!fs.existsSync(file)) return null;
  return fs.readFileSync(file, "utf8");
}

export function projectsRootAbs(): string {
  return path.join(process.cwd(), "projects");
}
