#!/usr/bin/env tsx
/**
 * Gate 6 scaffold hook. Full prototype pages are deferred until Gate 5 passes.
 */
import { fileExists } from "@/lib/project";

function arg(flag: string): string | undefined {
  const idx = process.argv.indexOf(flag);
  if (idx === -1) return undefined;
  return process.argv[idx + 1];
}

async function main() {
  const slug = arg("--slug");
  if (!slug) {
    console.error("Usage: npm run project:prototype -- --slug <slug>");
    process.exit(1);
  }

  if (!fileExists(slug, "design/design-tokens.json")) {
    throw new Error("Art direction tokens missing. Pass Gate 4 first.");
  }

  console.log(
    `Prototype generator for ${slug}: design-system/art-direction routes are available. Full page set waits for Gate 5 visual QA approval.`,
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
