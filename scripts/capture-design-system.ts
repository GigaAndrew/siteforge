#!/usr/bin/env tsx
/**
 * Capture design-system route screenshots for Gate 5 visual QA.
 * Expects Next.js to be running on BASE_URL (default http://localhost:3000).
 */
import fs from "node:fs";
import path from "node:path";
import { chromium } from "playwright";
import { projectPath, writeJsonFile } from "@/lib/project";

function arg(flag: string): string | undefined {
  const idx = process.argv.indexOf(flag);
  if (idx === -1) return undefined;
  return process.argv[idx + 1];
}

const VIEWPORTS = [
  { name: "1440x1000", width: 1440, height: 1000 },
  { name: "1280x800", width: 1280, height: 800 },
  { name: "768x1024", width: 768, height: 1024 },
  { name: "390x844", width: 390, height: 844 },
];

async function main() {
  const slug = arg("--slug");
  if (!slug) {
    console.error("Usage: tsx scripts/capture-design-system.ts --slug <slug>");
    process.exit(1);
  }
  const base = process.env.BASE_URL ?? "http://localhost:3000";
  const url = `${base}/prototype/${slug}/design-system`;
  const outDir = projectPath(slug, "screenshots/prototype/design-system");
  fs.mkdirSync(outDir, { recursive: true });

  const browser = await chromium.launch({ headless: true });
  const entries = [];
  try {
    for (const vp of VIEWPORTS) {
      const context = await browser.newContext({
        viewport: { width: vp.width, height: vp.height },
      });
      const page = await context.newPage();
      const filePath = path.join(outDir, `design-system-${vp.name}.png`);
      try {
        await page.goto(url, { waitUntil: "networkidle", timeout: 60000 });
        await page.waitForTimeout(400);
        await page.screenshot({ path: filePath, fullPage: true });
        entries.push({
          url,
          viewport: vp.name,
          filePath: path.relative(projectPath(slug), filePath),
          success: true,
          capturedAt: new Date().toISOString(),
        });
        console.log(`OK ${vp.name}`);
      } catch (err) {
        entries.push({
          url,
          viewport: vp.name,
          filePath: path.relative(projectPath(slug), filePath),
          success: false,
          error: err instanceof Error ? err.message : String(err),
          capturedAt: new Date().toISOString(),
        });
        console.error(`FAIL ${vp.name}`, err);
      }
      await context.close();
    }
  } finally {
    await browser.close();
  }

  writeJsonFile(projectPath(slug, "screenshots/prototype/design-system-manifest.json"), {
    projectSlug: slug,
    entries,
    updatedAt: new Date().toISOString(),
  });
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
