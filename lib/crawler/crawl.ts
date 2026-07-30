import { chromium, type Browser, type Page } from "playwright";
import {
  hostsFromUrl,
  projectPath,
  readProjectConfig,
  updateProjectStage,
  writeJsonFile,
} from "@/lib/project";
import { writeProjectStatus } from "@/lib/status";
import {
  classifyFetchError,
  hostAllowed,
  isDocumentHref,
  normalizeUrl,
  pickPreferredHost,
  shouldSkipPath,
  sleep,
} from "@/lib/crawler/normalize";
import { extractPageRecord } from "@/lib/crawler/extract";
import {
  fetchRobotsTxt,
  isAllowedByRobots,
  type RobotsRules,
} from "@/lib/crawler/robots";
import type {
  CrawlError,
  DocumentLink,
  ExternalTool,
  FormRecord,
  ImageRecord,
  NavigationData,
  PageRecord,
  TableRecord,
} from "@/lib/schemas/crawl";

export type CrawlResult = {
  pagesCrawled: number;
  errors: number;
  documents: number;
  healthPath: string;
};

export type CrawlHealthReport = {
  projectSlug: string;
  generatedAt: string;
  startUrl: string;
  preferredHost?: string;
  pagesAttempted: number;
  pagesSucceeded: number;
  uniqueCanonicalPages: number;
  retries: number;
  retrySuccesses: number;
  permanentFailures: number;
  robotsSkipped: number;
  documentLinksSkipped: number;
  downloadBlocked: number;
  rateLimited: number;
  timeouts: number;
  encodingFailures: number;
  encodingSalvages: number;
  duplicatesCollapsed: number;
  queueDuplicatesSkipped: number;
  skippedUrls: string[];
  permanentFailureSamples: Array<{ url: string; error: string; kind: string }>;
  notes: string[];
};

async function discoverSitemapUrls(
  robots: RobotsRules,
  origin: string,
): Promise<string[]> {
  const seeds = robots.sitemapUrls.length
    ? robots.sitemapUrls
    : [new URL("/sitemap.xml", origin).toString()];
  const found: string[] = [];

  for (const sitemapUrl of seeds) {
    try {
      const res = await fetch(sitemapUrl, { redirect: "follow" });
      if (!res.ok) continue;
      const xml = await res.text();
      const locs = [...xml.matchAll(/<loc>([^<]+)<\/loc>/gi)].map((m) => m[1]!);
      for (const loc of locs) {
        if (loc.includes("sitemap") && loc.endsWith(".xml")) {
          const nested = await fetch(loc, { redirect: "follow" });
          if (!nested.ok) continue;
          const nestedXml = await nested.text();
          const nestedLocs = [
            ...nestedXml.matchAll(/<loc>([^<]+)<\/loc>/gi),
          ].map((m) => m[1]!);
          found.push(...nestedLocs);
        } else {
          found.push(loc);
        }
      }
    } catch {
      /* continue */
    }
  }
  return found;
}

async function gotoWithRetry(
  page: Page,
  url: string,
  maxAttempts = 3,
): Promise<{
  ok: boolean;
  statusCode?: number;
  finalUrl: string;
  attempts: number;
  error?: string;
  kind?: string;
}> {
  let lastError = "";
  let kind = "other";
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const response = await page.goto(url, {
        waitUntil: "domcontentloaded",
        timeout: 45000,
      });
      await page.waitForTimeout(200);
      const status = response?.status();
      if (status && status >= 500 && attempt < maxAttempts) {
        await sleep(500 * attempt);
        continue;
      }
      if (status === 429 && attempt < maxAttempts) {
        await sleep(1000 * attempt);
        continue;
      }
      return {
        ok: true,
        statusCode: status,
        finalUrl: page.url(),
        attempts: attempt,
      };
    } catch (err) {
      lastError = err instanceof Error ? err.message : String(err);
      const c = classifyFetchError(lastError);
      kind = c.kind;
      if (!c.retryable || attempt === maxAttempts) {
        return {
          ok: false,
          finalUrl: url,
          attempts: attempt,
          error: lastError,
          kind,
        };
      }
      await sleep(c.kind === "rate_limit" ? 1500 * attempt : 600 * attempt);
    }
  }
  return { ok: false, finalUrl: url, attempts: maxAttempts, error: lastError, kind };
}

export async function crawlProject(slug: string): Promise<CrawlResult> {
  const config = readProjectConfig(slug);
  updateProjectStage(slug, "crawling");

  const approvedHosts =
    config.approvedHosts.length > 0
      ? config.approvedHosts
      : hostsFromUrl(config.websiteUrl);
  const preferredHost = pickPreferredHost(approvedHosts);
  const canonOpts = { preferredHost, preferHttps: true as const };

  const start = normalizeUrl(config.websiteUrl, undefined, canonOpts);
  if (!start) throw new Error(`Invalid website URL: ${config.websiteUrl}`);

  const origin = new URL(start).origin;
  const robots = await fetchRobotsTxt(origin);

  const queue: string[] = [start];
  const sitemapUrls = await discoverSitemapUrls(robots, origin);
  for (const u of sitemapUrls) {
    const n = normalizeUrl(u, undefined, canonOpts);
    if (n && hostAllowed(n, approvedHosts) && !shouldSkipPath(n)) queue.push(n);
  }

  const seen = new Set<string>();
  const pages: PageRecord[] = [];
  const documents: DocumentLink[] = [];
  const forms: FormRecord[] = [];
  const tables: TableRecord[] = [];
  const images: ImageRecord[] = [];
  const externalTools: ExternalTool[] = [];
  const errors: CrawlError[] = [];
  let navigation: NavigationData | null = null;
  const textNormalizeLog: Array<Record<string, unknown>> = [];

  const health: CrawlHealthReport = {
    projectSlug: slug,
    generatedAt: new Date().toISOString(),
    startUrl: start,
    preferredHost,
    pagesAttempted: 0,
    pagesSucceeded: 0,
    uniqueCanonicalPages: 0,
    retries: 0,
    retrySuccesses: 0,
    permanentFailures: 0,
    robotsSkipped: 0,
    documentLinksSkipped: 0,
    downloadBlocked: 0,
    rateLimited: 0,
    timeouts: 0,
    encodingFailures: 0,
    encodingSalvages: 0,
    duplicatesCollapsed: 0,
    queueDuplicatesSkipped: 0,
    skippedUrls: [],
    permanentFailureSamples: [],
    notes: [
      "Sprint 2 crawler: canonical host collapse, retries, encoding normalize log",
    ],
  };

  let browser: Browser | null = null;

  try {
    browser = await chromium.launch({ headless: true });
    const context = await browser.newContext({
      userAgent:
        "SiteForgeBot/0.2 (+local research; respectful crawl; contact via operator)",
      viewport: { width: 1440, height: 1000 },
    });
    const page = await context.newPage();
    page.on("download", async (download) => {
      try {
        await download.cancel();
      } catch {
        /* ignore */
      }
    });

    while (queue.length > 0 && pages.length < config.maxCrawlPages) {
      const next = queue.shift();
      if (!next) break;
      const url = normalizeUrl(next, undefined, canonOpts);
      if (!url) continue;
      if (seen.has(url)) {
        health.queueDuplicatesSkipped += 1;
        continue;
      }
      if (!hostAllowed(url, approvedHosts)) continue;
      if (shouldSkipPath(url)) {
        health.skippedUrls.push(url);
        continue;
      }
      if (isDocumentHref(url)) {
        health.documentLinksSkipped += 1;
        continue;
      }
      if (!isAllowedByRobots(url, robots)) {
        health.robotsSkipped += 1;
        health.skippedUrls.push(url);
        continue;
      }
      seen.add(url);
      health.pagesAttempted += 1;

      const fetched = await gotoWithRetry(page, url, 3);
      if (fetched.attempts > 1) {
        health.retries += fetched.attempts - 1;
        if (fetched.ok) health.retrySuccesses += 1;
      }

      if (!fetched.ok) {
        health.permanentFailures += 1;
        if (fetched.kind === "download") health.downloadBlocked += 1;
        if (fetched.kind === "rate_limit") health.rateLimited += 1;
        if (fetched.kind === "timeout") health.timeouts += 1;
        if (health.permanentFailureSamples.length < 40) {
          health.permanentFailureSamples.push({
            url,
            error: fetched.error ?? "unknown",
            kind: fetched.kind ?? "other",
          });
        }
        errors.push({
          url,
          error: fetched.error ?? "fetch failed",
          timestamp: new Date().toISOString(),
          stage: "page_fetch",
        });
        writeJsonFile(projectPath(slug, "source/crawl-errors.json"), errors);
        await sleep(config.crawlDelayMs);
        continue;
      }

      try {
        const html = await page.content();
        let domText = "";
        try {
          // Prefer main/content regions; skip malformed binary tag names injected into body.
          domText = await page.evaluate(() => {
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
          try {
            domText = await page.locator("body").innerText({ timeout: 5000 });
          } catch {
            domText = "";
          }
        }

        const beforeLog = textNormalizeLog.length;
        const extracted = extractPageRecord({
          url: normalizeUrl(fetched.finalUrl, undefined, canonOpts) ?? fetched.finalUrl,
          html,
          domText,
          statusCode: fetched.statusCode,
          redirectChain: fetched.finalUrl !== url ? [url, fetched.finalUrl] : [],
          approvedHosts,
          textNormalizeLog,
        });
        if (textNormalizeLog.length > beforeLog) {
          const last = textNormalizeLog[textNormalizeLog.length - 1] as {
            ok?: boolean;
            issues?: string[];
          };
          if (last?.ok === false) health.encodingFailures += 1;
          else if (last?.issues?.includes("salvaged_readable_text")) {
            health.encodingSalvages += 1;
          }
        }

        // Dedupe by canonical page URL
        const existingIdx = pages.findIndex((p) => p.url === extracted.page.url);
        if (existingIdx >= 0) {
          health.duplicatesCollapsed += 1;
          pages[existingIdx] = extracted.page;
        } else {
          pages.push(extracted.page);
        }
        health.pagesSucceeded = pages.length;
        health.uniqueCanonicalPages = pages.length;

        documents.push(...extracted.documents);
        forms.push(...extracted.page.forms);
        tables.push(...extracted.page.tables);
        images.push(...extracted.page.images);
        externalTools.push(...extracted.externalTools);

        if (!navigation && extracted.page.navigationLinks.length) {
          navigation = {
            sourceUrl: extracted.page.url,
            items: extracted.page.navigationLinks.map((href) => ({
              label: href,
              href,
              depth: 0,
            })),
            capturedAt: new Date().toISOString(),
          };
        }

        for (const link of extracted.page.internalLinks) {
          const n = normalizeUrl(link, undefined, canonOpts);
          if (
            n &&
            !seen.has(n) &&
            hostAllowed(n, approvedHosts) &&
            !shouldSkipPath(n) &&
            isAllowedByRobots(n, robots)
          ) {
            queue.push(n);
          }
        }

        writeJsonFile(projectPath(slug, "source/pages.json"), pages);
        writeJsonFile(projectPath(slug, "source/documents.json"), documents);
        writeJsonFile(projectPath(slug, "source/forms.json"), forms);
        writeJsonFile(projectPath(slug, "source/tables.json"), tables);
        writeJsonFile(projectPath(slug, "source/images.json"), images);
        writeJsonFile(
          projectPath(slug, "source/external-tools.json"),
          externalTools,
        );
        writeJsonFile(projectPath(slug, "source/crawl-errors.json"), errors);
        writeJsonFile(
          projectPath(slug, "source/text-normalize-log.json"),
          textNormalizeLog,
        );
        if (navigation) {
          writeJsonFile(projectPath(slug, "source/navigation.json"), navigation);
        }
      } catch (err) {
        health.permanentFailures += 1;
        errors.push({
          url,
          error: err instanceof Error ? err.message : String(err),
          timestamp: new Date().toISOString(),
          stage: "page_extract",
        });
        writeJsonFile(projectPath(slug, "source/crawl-errors.json"), errors);
      }

      await sleep(config.crawlDelayMs);
    }

    await context.close();
  } finally {
    await browser?.close();
  }

  health.generatedAt = new Date().toISOString();
  const healthPath = projectPath(slug, "reports/crawl-health-report.json");
  writeJsonFile(healthPath, health);
  writeJsonFile(projectPath(slug, "analysis/crawl-health.json"), health);

  // Markdown companion
  const md = `# Crawl health report — ${slug}

Generated: ${health.generatedAt}

| Metric | Value |
|---|---|
| Start URL | ${health.startUrl} |
| Preferred host | ${health.preferredHost ?? "—"} |
| Pages attempted | ${health.pagesAttempted} |
| Pages succeeded (canonical) | ${health.pagesSucceeded} |
| Retries | ${health.retries} |
| Retry successes | ${health.retrySuccesses} |
| Permanent failures | ${health.permanentFailures} |
| Robots skipped | ${health.robotsSkipped} |
| Document links skipped | ${health.documentLinksSkipped} |
| Download blocked | ${health.downloadBlocked} |
| Encoding failures | ${health.encodingFailures} |
| Encoding salvages | ${health.encodingSalvages} |
| Canonical page duplicates collapsed | ${health.duplicatesCollapsed} |
| Queue duplicate URLs skipped | ${health.queueDuplicatesSkipped} |

## Permanent failure samples

${health.permanentFailureSamples
  .map((f) => `- \`${f.kind}\` ${f.url} — ${f.error.replace(/\n/g, " ").slice(0, 160)}`)
  .join("\n") || "_None_"}
`;
  const fs = await import("node:fs");
  fs.writeFileSync(
    projectPath(slug, "reports/crawl-health-report.md"),
    md,
    "utf8",
  );

  writeProjectStatus(slug, {
    currentPhase: "evidence_collection",
    completedArtifacts: [
      `source/pages.json (${pages.length} pages)`,
      `source/documents.json (${documents.length})`,
      "source/crawl-errors.json",
      "reports/crawl-health-report.md",
    ],
    blockers: [],
    openQuestions: [],
    qaFailures: [],
    requiredRevisions: [],
    approvedGates: [],
  });

  return {
    pagesCrawled: pages.length,
    errors: errors.length,
    documents: documents.length,
    healthPath,
  };
}
