#!/usr/bin/env tsx
import { execSync } from "node:child_process";
import { fileExists } from "@/lib/project";

function arg(flag: string): string | undefined {
  const idx = process.argv.indexOf(flag);
  if (idx === -1) return undefined;
  return process.argv[idx + 1];
}

function run(cmd: string) {
  console.log(`\n>>> ${cmd}`);
  execSync(cmd, { stdio: "inherit" });
}

async function main() {
  const slug = arg("--slug");
  if (!slug) {
    console.error("Usage: npm run project:all -- --slug <slug>");
    process.exit(1);
  }

  if (!fileExists(slug, "source/pages.json")) {
    run(`npm run project:crawl -- --slug ${slug}`);
  } else {
    console.log("Resume: crawl artifacts present, skipping crawl");
  }

  if (!fileExists(slug, "screenshots/manifest.json")) {
    run(`npm run project:screenshots -- --slug ${slug}`);
  } else {
    console.log("Resume: screenshots present, skipping");
  }

  if (!fileExists(slug, "analysis/executive-audit.md")) {
    run(`npm run project:audit -- --slug ${slug}`);
  } else {
    console.log("Resume: audit present, skipping");
  }

  if (!fileExists(slug, "design/design-tokens.json")) {
    run(`npm run project:strategy -- --slug ${slug}`);
  } else {
    console.log("Resume: strategy/art direction present, skipping");
  }

  if (!fileExists(slug, "knowledge/extract-manifest.json")) {
    run(`npm run project:knowledge -- --slug ${slug}`);
  } else {
    console.log("Resume: knowledge extract present (use --force to re-ingest)");
  }

  run(`npm run project:prototype -- --slug ${slug}`);
  console.log(
    "\nproject:all stopped before Gate 6 full prototype. Complete Gate 5 visual QA next.",
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
