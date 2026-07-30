#!/usr/bin/env tsx
import {
  ensureProjectDirs,
  hostsFromUrl,
  listProjectSlugs,
  projectPath,
  slugify,
  writeProjectConfig,
} from "@/lib/project";
import { writeProjectStatus } from "@/lib/status";
import {
  ModuleOptionSchema,
  PrototypeDepthSchema,
  type ModuleOption,
  type PrototypeDepth,
} from "@/lib/schemas/project";
import fs from "node:fs";

function arg(flag: string): string | undefined {
  const idx = process.argv.indexOf(flag);
  if (idx === -1) return undefined;
  return process.argv[idx + 1];
}

function argsList(flag: string): string[] {
  const idx = process.argv.indexOf(flag);
  if (idx === -1) return [];
  const values: string[] = [];
  for (let i = idx + 1; i < process.argv.length; i++) {
    const v = process.argv[i]!;
    if (v.startsWith("--")) break;
    values.push(v);
  }
  return values;
}

function usage(): never {
  console.error(`Usage:
  npm run project:create -- --name "Company" --url "https://example.com" --slug "company" [--industry "..."] [--max-pages 75] [--depth website_plus_interactive_tools] [--modules product_catalog calculator] [--notes "..."]`);
  process.exit(1);
}

async function main() {
  const name = arg("--name");
  const url = arg("--url");
  let slug = arg("--slug");
  const industry = arg("--industry") ?? "Unspecified";
  const maxPages = Number(arg("--max-pages") ?? "75");
  const depthRaw = arg("--depth") ?? "website_plus_interactive_tools";
  const notes = arg("--notes") ?? "";
  const modulesRaw = argsList("--modules");

  if (!name || !url) usage();
  slug = slug || slugify(name);

  if (listProjectSlugs().includes(slug) && fs.existsSync(projectPath(slug, "config.json"))) {
    console.error(`Project already exists: ${slug}. Refusing to overwrite.`);
    process.exit(1);
  }

  const prototypeDepth = PrototypeDepthSchema.parse(depthRaw) as PrototypeDepth;
  const modules = modulesRaw.map((m) => ModuleOptionSchema.parse(m)) as ModuleOption[];
  const now = new Date().toISOString();

  ensureProjectDirs(slug);
  writeProjectConfig({
    name,
    slug,
    websiteUrl: url,
    approvedHosts: hostsFromUrl(url),
    industry,
    maxCrawlPages: maxPages,
    crawlDelayMs: 750,
    prototypeDepth,
    modules,
    notes,
    stage: "created",
    createdAt: now,
    updatedAt: now,
  });

  writeProjectStatus(slug, {
    currentPhase: "created",
    completedArtifacts: ["config.json", "project-status.md"],
    blockers: [],
    openQuestions: [],
    qaFailures: [],
    requiredRevisions: [],
    approvedGates: [],
  });

  console.log(`Created project ${slug} at projects/${slug}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
