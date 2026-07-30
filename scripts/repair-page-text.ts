#!/usr/bin/env tsx
import { repairPageText } from "@/lib/crawler/repair";

function arg(flag: string): string | undefined {
  const idx = process.argv.indexOf(flag);
  if (idx === -1) return undefined;
  return process.argv[idx + 1];
}

async function main() {
  const slug = arg("--slug");
  if (!slug) throw new Error("--slug required");
  const forceAll = process.argv.includes("--all");
  const result = await repairPageText(slug, { forceAll });
  console.log(JSON.stringify(result));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
