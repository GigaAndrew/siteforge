#!/usr/bin/env tsx
import { ingestProjectKnowledge } from "@/lib/knowledge/ingest";

function hasFlag(flag: string): boolean {
  return process.argv.includes(flag);
}

function arg(flag: string): string | undefined {
  const idx = process.argv.indexOf(flag);
  if (idx === -1) return undefined;
  return process.argv[idx + 1];
}

async function main() {
  const slug = arg("--slug");
  if (!slug) {
    console.error(
      "Usage: npm run project:knowledge -- --slug <slug> [--dry-run] [--force] [--rebuild]",
    );
    process.exit(1);
  }

  const result = ingestProjectKnowledge({
    slug,
    dryRun: hasFlag("--dry-run"),
    force: hasFlag("--force"),
    rebuild: hasFlag("--rebuild"),
  });

  console.log(JSON.stringify(result, null, 2));
  if (result.skipped) {
    console.log(`Skipped: ${result.skipReason}`);
  } else if (result.dryRun) {
    console.log("Dry run complete — no files written.");
  } else {
    console.log(
      `Ingested Forge Knowledge for ${slug} → projects/${slug}/knowledge/ + knowledge/`,
    );
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
