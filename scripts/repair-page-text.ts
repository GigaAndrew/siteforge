#!/usr/bin/env tsx
/**
 * Repair page text summaries after text-normalize fixes without full recrawl.
 */
import { chromium } from "playwright";
import {
  projectPath,
  readJsonFile,
  readProjectConfig,
  writeJsonFile,
} from "@/lib/project";
import { extractPageRecord } from "@/lib/crawler/extract";
import {
  normalizeUrl,
  pickPreferredHost,
} from "@/lib/crawler/normalize";
import type { PageRecord } from "@/lib/schemas/crawl";
import { sleep } from "@/lib/crawler/normalize";
import { needsTextRepair } from "@/lib/crawler/text-normalize";

function arg(flag: string): string | undefined {
  const idx = process.argv.indexOf(flag);
  if (idx === -1) return undefined;
  return process.argv[idx + 1];
}

async function readCleanDomText(page: import("playwright").Page): Promise<string> {
  try {
    return await page.evaluate(() => {
      const isWeirdTag = (tag: string) =>
        !/^[A-Za-z][A-Za-z0-9:-]{0,32}$/.test(tag);
      const roots = [
        document.querySelector("main"),
        document.querySelector("#content"),
        document.querySelector(".entry-content"),
        document.querySelector("article"),
        document.body,
      ].filter(Boolean) as Element[];
      const root = roots[0] ?? document.body;
      if (!root) return "";
      const clone = root.cloneNode(true) as HTMLElement;
      for (const el of [...clone.querySelectorAll("*")]) {
        if (isWeirdTag(el.tagName)) el.remove();
        if (["SCRIPT", "STYLE", "NOSCRIPT", "SVG"].includes(el.tagName)) {
          el.remove();
        }
      }
      return (clone.innerText || "").trim();
    });
  } catch {
    return page.locator("body").innerText({ timeout: 5000 });
  }
}

async function main() {
  const slug = arg("--slug");
  if (!slug) throw new Error("--slug required");
  const forceAll = process.argv.includes("--all");
  const config = readProjectConfig(slug);
  const preferredHost = pickPreferredHost(config.approvedHosts);
  const pages =
    readJsonFile<PageRecord[]>(projectPath(slug, "source/pages.json")) ?? [];
  const log: Array<Record<string, unknown>> = [];

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    userAgent: "SiteForgeBot/0.2 (+text repair)",
  });
  const page = await context.newPage();

  let repaired = 0;
  for (let i = 0; i < pages.length; i++) {
    const rec = pages[i]!;
    const needs = forceAll || needsTextRepair(rec.mainTextSummary);
    if (!needs) continue;
    const url =
      normalizeUrl(rec.url, undefined, {
        preferredHost,
        preferHttps: true,
      }) ?? rec.url;
    try {
      await page.goto(url, { waitUntil: "domcontentloaded", timeout: 45000 });
      await page.waitForTimeout(200);
      const html = await page.content();
      const domText = await readCleanDomText(page);
      const extracted = extractPageRecord({
        url,
        html,
        domText,
        approvedHosts: config.approvedHosts,
        statusCode: rec.statusCode,
        textNormalizeLog: log,
      });
      pages[i] = { ...rec, ...extracted.page, url: extracted.page.url };
      repaired += 1;
      writeJsonFile(projectPath(slug, "source/pages.json"), pages);
    } catch (err) {
      log.push({
        url,
        repairError: err instanceof Error ? err.message : String(err),
      });
    }
    await sleep(400);
  }

  await context.close();
  await browser.close();
  writeJsonFile(projectPath(slug, "source/text-normalize-log.json"), log);
  console.log(JSON.stringify({ repaired, total: pages.length, log: log.length }));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
