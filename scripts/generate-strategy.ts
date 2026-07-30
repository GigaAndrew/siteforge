#!/usr/bin/env tsx
import { runStrategyPipeline } from "@/lib/analyzer/pipeline";

function arg(flag: string): string | undefined {
  const idx = process.argv.indexOf(flag);
  if (idx === -1) return undefined;
  return process.argv[idx + 1];
}

async function main() {
  const slug = arg("--slug");
  if (!slug) {
    console.error("Usage: npm run project:strategy -- --slug <slug>");
    process.exit(1);
  }
  runStrategyPipeline(slug);
  console.log(`Strategy + art direction artifacts written for ${slug}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
