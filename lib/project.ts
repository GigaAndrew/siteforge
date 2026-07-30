import fs from "node:fs";
import path from "node:path";
import {
  ProjectConfigSchema,
  type ProjectConfig,
  type ProjectStage,
} from "@/lib/schemas/project";

export const PROJECTS_ROOT = path.join(process.cwd(), "projects");

export const PROJECT_SUBDIRS = [
  "source",
  "screenshots/current/desktop",
  "screenshots/current/tablet",
  "screenshots/current/mobile",
  "analysis",
  "strategy",
  "design",
  "data",
  "reports",
  "qa",
  "knowledge",
  "runtime",
  "runtime/history",
  "runtime/checkpoints",
  "prototype",
  "reports/pitch",
] as const;

const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/** Reject path traversal / invalid project identifiers. */
export function assertValidProjectSlug(slug: string): string {
  if (!slug || !SLUG_RE.test(slug)) {
    throw new Error(
      `Invalid project slug "${slug}". Expected lowercase kebab-case (e.g. eb-metal).`,
    );
  }
  const resolved = path.resolve(PROJECTS_ROOT, slug);
  const root = path.resolve(PROJECTS_ROOT) + path.sep;
  if (resolved !== path.resolve(PROJECTS_ROOT) && !resolved.startsWith(root)) {
    throw new Error(`Slug escapes projects root: ${slug}`);
  }
  return slug;
}

export function projectDir(slug: string): string {
  return path.join(PROJECTS_ROOT, assertValidProjectSlug(slug));
}

export function projectPath(slug: string, ...parts: string[]): string {
  return path.join(projectDir(slug), ...parts);
}

export function ensureProjectDirs(slug: string): void {
  for (const sub of PROJECT_SUBDIRS) {
    fs.mkdirSync(projectPath(slug, sub), { recursive: true });
  }
}

export function listProjectSlugs(): string[] {
  if (!fs.existsSync(PROJECTS_ROOT)) return [];
  return fs
    .readdirSync(PROJECTS_ROOT, { withFileTypes: true })
    .filter((d) => d.isDirectory() && !d.name.startsWith("."))
    .filter((d) => fs.existsSync(projectPath(d.name, "config.json")))
    .map((d) => d.name)
    .sort();
}

export function readProjectConfig(slug: string): ProjectConfig {
  const raw = fs.readFileSync(projectPath(slug, "config.json"), "utf8");
  return ProjectConfigSchema.parse(JSON.parse(raw));
}

export function writeProjectConfig(config: ProjectConfig): void {
  ensureProjectDirs(config.slug);
  const next = {
    ...config,
    updatedAt: new Date().toISOString(),
  };
  fs.writeFileSync(
    projectPath(config.slug, "config.json"),
    `${JSON.stringify(ProjectConfigSchema.parse(next), null, 2)}\n`,
    "utf8",
  );
}

export function updateProjectStage(slug: string, stage: ProjectStage): ProjectConfig {
  const config = readProjectConfig(slug);
  const next = { ...config, stage };
  writeProjectConfig(next);
  return next;
}

export function readJsonFile<T>(filePath: string): T | null {
  if (!fs.existsSync(filePath)) return null;
  return JSON.parse(fs.readFileSync(filePath, "utf8")) as T;
}

/** Atomic JSON write: temp file + rename to avoid partial reads. */
export function writeJsonFile(filePath: string, data: unknown): void {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  const payload = `${JSON.stringify(data, null, 2)}\n`;
  const tmp = `${filePath}.${process.pid}.${Date.now()}.tmp`;
  fs.writeFileSync(tmp, payload, "utf8");
  fs.renameSync(tmp, filePath);
}

export function fileExists(slug: string, ...parts: string[]): boolean {
  return fs.existsSync(projectPath(slug, ...parts));
}

export function slugify(input: string): string {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-{2,}/g, "-");
}

export function hostsFromUrl(websiteUrl: string): string[] {
  const u = new URL(websiteUrl);
  const host = u.hostname.replace(/^www\./, "");
  return [host, `www.${host}`];
}
