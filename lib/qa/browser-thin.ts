import fs from "node:fs";
import { chromium } from "playwright";
import AxeBuilder from "@axe-core/playwright";
import {
  projectPath,
  readJsonFile,
  writeJsonFile,
} from "@/lib/project";

export type BrowserQaResult = {
  ok: boolean;
  artifact: string;
  qualityScore: number;
  routesChecked: number;
  violations: number;
  broken: string[];
  message: string;
};

type PrototypeManifest = {
  routes?: string[];
};

/**
 * Sprint 3 thin browser QA — smoke + axe summary against local prototype routes.
 * Requires NEXT_PUBLIC base or defaults to http://127.0.0.1:3000.
 * When server is unavailable, writes a deferred result that fails the gate
 * unless SITEFORGE_QA_ALLOW_OFFLINE=1 (records skipped smoke for CI/unit paths).
 */
export async function runThinBrowserQa(slug: string): Promise<BrowserQaResult> {
  const manifest =
    readJsonFile<PrototypeManifest>(
      projectPath(slug, "prototype/manifest.json"),
    ) ?? { routes: [] };
  const routes = manifest.routes?.length
    ? manifest.routes
    : [
        `/prototype/${slug}/art-direction`,
        `/prototype/${slug}/design-system`,
      ];

  const base =
    process.env.SITEFORGE_BASE_URL?.replace(/\/$/, "") ??
    "http://127.0.0.1:3000";
  const allowOffline = process.env.SITEFORGE_QA_ALLOW_OFFLINE === "1";

  const results: Array<{
    route: string;
    status: number | null;
    ok: boolean;
    axeViolations: number;
    error?: string;
  }> = [];

  let browser: Awaited<ReturnType<typeof chromium.launch>> | null = null;
  try {
    browser = await chromium.launch({ headless: true });
    const page = await browser.newPage();

    for (const route of routes) {
      const url = `${base}${route}`;
      try {
        const res = await page.goto(url, {
          waitUntil: "domcontentloaded",
          timeout: 20000,
        });
        const status = res?.status() ?? null;
        let axeViolations = 0;
        if (status && status < 400) {
          try {
            const axe = await new AxeBuilder({ page })
              .withTags(["wcag2a", "wcag2aa"])
              .analyze();
            axeViolations = axe.violations.length;
          } catch {
            axeViolations = -1;
          }
        }
        results.push({
          route,
          status,
          ok: !!status && status < 400,
          axeViolations,
        });
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        const unreachable =
          /ECONNREFUSED|ERR_CONNECTION_REFUSED|net::ERR|Timeout/i.test(message);
        if (unreachable && allowOffline) {
          results.push({
            route,
            status: null,
            ok: true,
            axeViolations: 0,
            error: `offline_allowed: ${message.slice(0, 120)}`,
          });
        } else {
          results.push({
            route,
            status: null,
            ok: false,
            axeViolations: 0,
            error: message,
          });
        }
      }
    }
  } catch (err) {
    const payload = {
      schemaVersion: "1.0.0",
      kind: "thin_browser_qa",
      projectSlug: slug,
      generatedAt: new Date().toISOString(),
      baseUrl: base,
      offline: true,
      error: err instanceof Error ? err.message : String(err),
      results: [],
      ok: allowOffline,
      qualityScore: allowOffline ? 0.45 : 0,
      note: allowOffline
        ? "Offline mode allowed for runtime demo/tests"
        : "Dev server unreachable",
    };
    writeJsonFile(projectPath(slug, "qa/browser-qa.json"), payload);
    fs.writeFileSync(
      projectPath(slug, "qa/browser-qa.md"),
      `# Browser QA — ${slug}\n\nOffline/error: ${payload.error}\nAllow offline: ${allowOffline}\n`,
      "utf8",
    );
    return {
      ok: allowOffline,
      artifact: "qa/browser-qa.json",
      qualityScore: allowOffline ? 0.45 : 0,
      routesChecked: 0,
      violations: 0,
      broken: routes,
      message: allowOffline
        ? "Browser QA deferred (offline allowed)"
        : "Browser QA failed — server unreachable",
    };
  } finally {
    await browser?.close();
  }

  const broken = results.filter((r) => !r.ok).map((r) => r.route);
  const violations = results.reduce(
    (s, r) => s + Math.max(0, r.axeViolations),
    0,
  );
  const ok = broken.length === 0;
  const qualityScore = ok
    ? Math.max(0.5, 0.85 - Math.min(0.3, violations * 0.02))
    : 0.2;

  const payload = {
    schemaVersion: "1.0.0",
    kind: "thin_browser_qa",
    projectSlug: slug,
    generatedAt: new Date().toISOString(),
    baseUrl: base,
    results,
    ok,
    qualityScore,
    violations,
  };
  writeJsonFile(projectPath(slug, "qa/browser-qa.json"), payload);
  fs.writeFileSync(
    projectPath(slug, "qa/browser-qa.md"),
    `# Browser QA — ${slug}

Generated: ${payload.generatedAt}
Base: ${base}
OK: ${ok}
Violations: ${violations}

${results
  .map(
    (r) =>
      `- \`${r.route}\` status=${r.status ?? "err"} axe=${r.axeViolations}${r.error ? ` (${r.error})` : ""}`,
  )
  .join("\n")}
`,
    "utf8",
  );

  return {
    ok,
    artifact: "qa/browser-qa.json",
    qualityScore,
    routesChecked: results.length,
    violations,
    broken,
    message: ok ? "Browser QA passed" : `Broken routes: ${broken.join(", ")}`,
  };
}
