import fs from "node:fs";
import path from "node:path";
import { chromium } from "playwright";
import {
  projectPath,
  readJsonFile,
  readProjectConfig,
  writeJsonFile,
} from "@/lib/project";
import type { PageRecord, ScreenshotManifest } from "@/lib/schemas/crawl";

const VIEWPORTS = [
  { name: "desktop" as const, width: 1440, height: 1000 },
  { name: "tablet" as const, width: 768, height: 1024 },
  { name: "mobile" as const, width: 390, height: 844 },
];

type Target = { url: string; pageLabel: string };

function pickTargets(pages: PageRecord[]): Target[] {
  const byLabel = new Map<string, Target>();

  const assign = (label: string, predicate: (p: PageRecord) => boolean) => {
    if (byLabel.has(label)) return;
    const match = pages.find(predicate);
    if (match) byLabel.set(label, { url: match.url, pageLabel: label });
  };

  assign("homepage", (p) => {
    try {
      const u = new URL(p.url);
      return u.pathname === "/" || u.pathname === "";
    } catch {
      return false;
    }
  });
  assign(
    "catalog",
    (p) => /product|catalog|framing/i.test(p.url + (p.title ?? "")),
  );
  assign(
    "product-category",
    (p) => /stud|track|joist|category/i.test(p.url + (p.title ?? "")),
  );
  assign("nitrostud", (p) => /nitrostud/i.test(p.url + (p.title ?? "") + p.h1.join(" ")));
  assign(
    "technical-resources",
    (p) => /technical|resource|engineering|table/i.test(p.url + (p.title ?? "")),
  );
  assign(
    "documents",
    (p) => /document|download|brochure|pdf/i.test(p.url + (p.title ?? "")),
  );
  assign("contact", (p) => /contact/i.test(p.url + (p.title ?? "")));
  assign(
    "distributors",
    (p) => /distributor|dealer|where.?to.?buy/i.test(p.url + (p.title ?? "")),
  );
  assign(
    "submittal",
    (p) => /submittal|specification/i.test(p.url + (p.title ?? "")),
  );
  assign(
    "calculator-or-tool",
    (p) => /calculat|tool|limiting.?height|span/i.test(p.url + (p.title ?? "")),
  );

  // Ensure homepage always present if pages exist
  if (!byLabel.has("homepage") && pages[0]) {
    byLabel.set("homepage", { url: pages[0].url, pageLabel: "homepage" });
  }

  return [...byLabel.values()];
}

function slugifyLabel(label: string): string {
  return label.replace(/[^a-z0-9]+/gi, "-").toLowerCase();
}

export async function captureScreenshots(slug: string): Promise<ScreenshotManifest> {
  const config = readProjectConfig(slug);
  const pages =
    readJsonFile<PageRecord[]>(projectPath(slug, "source/pages.json")) ?? [];
  const targets = pickTargets(pages);

  if (targets.length === 0) {
    targets.push({ url: config.websiteUrl, pageLabel: "homepage" });
  }

  const manifest: ScreenshotManifest = {
    projectSlug: slug,
    entries: [],
    updatedAt: new Date().toISOString(),
  };

  const browser = await chromium.launch({ headless: true });
  try {
    for (const viewport of VIEWPORTS) {
      const context = await browser.newContext({
        viewport: { width: viewport.width, height: viewport.height },
        userAgent:
          "SiteForgeBot/0.1 (+local research; screenshot capture)",
      });
      const page = await context.newPage();

      for (const target of targets) {
        const fileName = `${slugifyLabel(target.pageLabel)}.png`;
        const rel = path.join(
          "screenshots",
          "current",
          viewport.name,
          fileName,
        );
        const abs = projectPath(slug, rel);
        fs.mkdirSync(path.dirname(abs), { recursive: true });

        try {
          await page.goto(target.url, {
            waitUntil: "domcontentloaded",
            timeout: 45000,
          });
          await page.waitForTimeout(500);
          await page.screenshot({ path: abs, fullPage: true });
          manifest.entries.push({
            url: target.url,
            pageLabel: target.pageLabel,
            viewport: viewport.name,
            width: viewport.width,
            height: viewport.height,
            filePath: rel,
            capturedAt: new Date().toISOString(),
            success: true,
          });
        } catch (err) {
          manifest.entries.push({
            url: target.url,
            pageLabel: target.pageLabel,
            viewport: viewport.name,
            width: viewport.width,
            height: viewport.height,
            filePath: rel,
            capturedAt: new Date().toISOString(),
            success: false,
            error: err instanceof Error ? err.message : String(err),
          });
        }

        writeJsonFile(projectPath(slug, "screenshots/manifest.json"), {
          ...manifest,
          updatedAt: new Date().toISOString(),
        });
      }

      await context.close();
    }
  } finally {
    await browser.close();
  }

  manifest.updatedAt = new Date().toISOString();
  writeJsonFile(projectPath(slug, "screenshots/manifest.json"), manifest);
  return manifest;
}
