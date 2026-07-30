#!/usr/bin/env tsx
import { captureScreenshots } from "@/lib/screenshots/capture";

function arg(flag: string): string | undefined {
  const idx = process.argv.indexOf(flag);
  if (idx === -1) return undefined;
  return process.argv[idx + 1];
}

async function main() {
  const slug = arg("--slug");
  if (!slug) {
    console.error("Usage: npm run project:screenshots -- --slug <slug>");
    process.exit(1);
  }
  console.log(`Capturing screenshots for: ${slug}`);
  const manifest = await captureScreenshots(slug);
  const ok = manifest.entries.filter((e) => e.success).length;
  const fail = manifest.entries.filter((e) => !e.success).length;
  console.log(`Done. success=${ok} failed=${fail}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
