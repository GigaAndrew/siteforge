#!/usr/bin/env tsx
import { crawlProject } from "@/lib/crawler/crawl";

function arg(flag: string): string | undefined {
  const idx = process.argv.indexOf(flag);
  if (idx === -1) return undefined;
  return process.argv[idx + 1];
}

async function main() {
  const slug = arg("--slug");
  if (!slug) {
    console.error("Usage: npm run project:crawl -- --slug <slug>");
    process.exit(1);
  }
  console.log(`Crawling project: ${slug}`);
  const result = await crawlProject(slug);
  console.log(
    `Done. pages=${result.pagesCrawled} documents=${result.documents} errors=${result.errors}`,
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
