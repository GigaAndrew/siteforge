#!/usr/bin/env tsx
import { runAuditPipeline } from "@/lib/analyzer/pipeline";

function arg(flag: string): string | undefined {
  const idx = process.argv.indexOf(flag);
  if (idx === -1) return undefined;
  return process.argv[idx + 1];
}

async function main() {
  const slug = arg("--slug");
  if (!slug) {
    console.error("Usage: npm run project:audit -- --slug <slug>");
    process.exit(1);
  }
  runAuditPipeline(slug);
  console.log(`Audit artifacts written for ${slug}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
