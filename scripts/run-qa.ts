#!/usr/bin/env tsx
import { execSync } from "node:child_process";
import fs from "node:fs";
import { projectPath } from "@/lib/project";

function arg(flag: string): string | undefined {
  const idx = process.argv.indexOf(flag);
  if (idx === -1) return undefined;
  return process.argv[idx + 1];
}

async function main() {
  const slug = arg("--slug");
  if (!slug) {
    console.error("Usage: npm run project:qa -- --slug <slug>");
    process.exit(1);
  }

  const results: string[] = [];
  try {
    execSync("npm run typecheck", { stdio: "inherit" });
    results.push("- Typecheck: pass");
  } catch {
    results.push("- Typecheck: fail");
  }
  try {
    execSync("npm run lint", { stdio: "inherit" });
    results.push("- Lint: pass");
  } catch {
    results.push("- Lint: fail");
  }
  try {
    execSync("npm run test", { stdio: "inherit" });
    results.push("- Unit tests: pass");
  } catch {
    results.push("- Unit tests: fail");
  }

  fs.writeFileSync(
    projectPath(slug, "qa/automated-qa.md"),
    `# Automated QA — ${slug}\n\n${results.join("\n")}\n\nGenerated: ${new Date().toISOString()}\n`,
    "utf8",
  );
  console.log(`Wrote projects/${slug}/qa/automated-qa.md`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
