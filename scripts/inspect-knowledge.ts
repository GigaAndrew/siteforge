#!/usr/bin/env tsx
import { inspectKnowledge } from "@/lib/knowledge/inspect";

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
  const asJson = hasFlag("--json");
  const strict = hasFlag("--strict");

  const insp = inspectKnowledge({ slug });

  if (asJson) {
    console.log(JSON.stringify(insp, null, 2));
  } else {
    console.log(`Forge Knowledge inspect${slug ? ` — ${slug}` : ""}`);
    console.log(`Schema: ${insp.schemaVersion}`);
    console.log("\nTotals:");
    for (const [k, v] of Object.entries(insp.totals)) {
      console.log(`  ${k}: ${v}`);
    }
    console.log("\nEntities by type:");
    for (const [k, v] of Object.entries(insp.entitiesByType).sort(
      (a, b) => b[1] - a[1],
    )) {
      console.log(`  ${k}: ${v}`);
    }
    console.log(
      `\nIssues: ${insp.issues.length} (critical=${insp.criticalCount}, high=${insp.highCount})`,
    );
    for (const issue of insp.issues.slice(0, 30)) {
      console.log(
        `  [${issue.severity}] ${issue.category}: ${issue.message}`,
      );
    }
    if (insp.issues.length > 30) {
      console.log(`  … ${insp.issues.length - 30} more`);
    }
    console.log("\nConflicts: see knowledge/conflicts/all.json");
    console.log(
      `Candidate patterns: ${insp.totals.candidatePatterns}`,
    );
    console.log("\nExport paths:");
    for (const p of insp.exportPaths.slice(-8)) console.log(`  ${p}`);
  }

  if (strict && (insp.criticalCount > 0 || insp.highCount > 0)) {
    console.error(
      `\nStrict mode failed: critical=${insp.criticalCount} high=${insp.highCount}`,
    );
    process.exit(1);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
