#!/usr/bin/env tsx
import fs from "node:fs";
import path from "node:path";
import {
  inspectKnowledge,
  renderQualityReportMarkdown,
} from "@/lib/knowledge/inspect";
import {
  renderDemoQueriesMarkdown,
  runDemoQueries,
} from "@/lib/knowledge/demo-queries";
import { projectPath } from "@/lib/project";

function arg(flag: string): string | undefined {
  const idx = process.argv.indexOf(flag);
  if (idx === -1) return undefined;
  return process.argv[idx + 1];
}

async function main() {
  const slug = arg("--slug") ?? "eb-metal";
  const insp = inspectKnowledge({ slug });
  const qualityPath = projectPath(slug, "reports/knowledge-quality-report.md");
  const demoPath = projectPath(slug, "reports/knowledge-query-demonstration.md");
  fs.mkdirSync(path.dirname(qualityPath), { recursive: true });
  fs.writeFileSync(qualityPath, renderQualityReportMarkdown(insp), "utf8");
  const demos = runDemoQueries(slug);
  fs.writeFileSync(demoPath, renderDemoQueriesMarkdown(slug, demos), "utf8");
  console.log(`Wrote ${qualityPath}`);
  console.log(`Wrote ${demoPath}`);
  console.log(
    `Issues: critical=${insp.criticalCount} high=${insp.highCount} total=${insp.issues.length}`,
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
