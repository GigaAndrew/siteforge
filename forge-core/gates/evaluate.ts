import { fileExists, projectPath, readJsonFile } from "@/lib/project";
import { inspectKnowledge } from "@/lib/knowledge/inspect";
import type { RuntimePolicies } from "@/forge-core/policies/defaults";
import type { ExecutionNode } from "@/forge-core/state/schemas";

export type GateResult = {
  passed: boolean;
  score: number;
  issues: string[];
};

export function evaluateNodeGates(
  slug: string,
  node: ExecutionNode,
  policies: RuntimePolicies,
): GateResult {
  const issues: string[] = [];
  let score = 1;

  switch (node.capability) {
    case "knowledge.build": {
      const insp = inspectKnowledge({ slug });
      if (
        policies.knowledgeCriticalHighMustBeZero &&
        (insp.criticalCount > 0 || insp.highCount > 0)
      ) {
        issues.push(
          `knowledge integrity critical=${insp.criticalCount} high=${insp.highCount}`,
        );
        score = 0.3;
      }
      break;
    }
    case "audit.technical":
    case "audit.accessibility":
    case "audit.seo":
    case "audit.performance":
    case "audit.ux": {
      if (!fileExists(slug, "analysis/executive-audit.md")) {
        issues.push("executive audit missing");
        score = 0.2;
      }
      break;
    }
    case "qa.browser": {
      if (policies.requireBrowserQa) {
        const qa = readJsonFile<{ ok?: boolean; qualityScore?: number }>(
          projectPath(slug, "qa/browser-qa.json"),
        );
        if (!qa?.ok) {
          issues.push("browser QA not ok");
          score = 0.2;
        } else {
          score = qa.qualityScore ?? 0.7;
          if (score < policies.minPrototypeScore) {
            issues.push("browser QA below min prototype score");
          }
        }
      }
      break;
    }
    case "prototype.generate": {
      if (!fileExists(slug, "prototype/manifest.json")) {
        issues.push("prototype manifest missing");
        score = 0.1;
      } else {
        score = 0.62;
        if (score < policies.minPrototypeScore) {
          issues.push("prototype score below policy minimum");
        }
      }
      break;
    }
    case "pitch.generate": {
      const pkg = readJsonFile<{
        recommendations?: Array<{ evidenceIds?: string[] }>;
      }>(projectPath(slug, "reports/pitch/package.json"));
      const recs = pkg?.recommendations ?? [];
      const covered = recs.filter((r) => (r.evidenceIds?.length ?? 0) > 0);
      const coverage = recs.length ? covered.length / recs.length : 1;
      score = Math.min(0.7, coverage);
      if (coverage < 0.8 && recs.length > 0) {
        issues.push("pitch evidence coverage below 80%");
      }
      if (score < policies.minPitchConfidence) {
        issues.push("pitch confidence below policy minimum");
      }
      break;
    }
    case "lessons.derive": {
      if (!fileExists(slug, "reports/lessons-learned.md")) {
        issues.push("lessons-learned missing");
        score = 0.2;
      }
      break;
    }
    case "platform.improvements": {
      const reg = readJsonFile<{ items?: unknown[] }>(
        `${process.cwd()}/platform/improvements/registry.json`,
      );
      if (!(reg?.items?.length ?? 0)) {
        issues.push("platform improvements empty");
        score = 0.2;
      }
      break;
    }
    default:
      break;
  }

  return { passed: issues.length === 0, score, issues };
}
