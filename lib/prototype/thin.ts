import fs from "node:fs";
import {
  fileExists,
  projectPath,
  readProjectConfig,
  writeJsonFile,
} from "@/lib/project";

export type ThinPrototypeResult = {
  ok: boolean;
  manifestPath: string;
  routes: string[];
  qualityScore: number;
  message: string;
};

/**
 * Sprint 3 thin prototype adapter — structured package for runtime gates.
 * Does not generate a full Gate 6 page set.
 */
export function generateThinPrototype(slug: string): ThinPrototypeResult {
  if (!fileExists(slug, "design/design-tokens.json")) {
    return {
      ok: false,
      manifestPath: "",
      routes: [],
      qualityScore: 0,
      message: "design/design-tokens.json missing",
    };
  }

  const config = readProjectConfig(slug);
  const routes = [
    `/prototype/${slug}/art-direction`,
    `/prototype/${slug}/design-system`,
  ];

  const manifest = {
    schemaVersion: "1.0.0",
    kind: "thin_prototype",
    projectSlug: slug,
    company: config.name,
    generatedAt: new Date().toISOString(),
    depth: config.prototypeDepth,
    modules: config.modules,
    routes,
    notes:
      "Thin runtime prototype package. Design-system and art-direction routes are the executable surfaces; full Gate 6 pages are out of scope for Sprint 3.",
    confidenceCap: 0.65,
  };

  const manifestPath = projectPath(slug, "prototype/manifest.json");
  writeJsonFile(manifestPath, manifest);

  const statusMd = `# Prototype package — ${config.name}

Generated: ${manifest.generatedAt}
Kind: thin (Sprint 3 runtime)

## Routes

${routes.map((r) => `- \`${r}\``).join("\n")}

## Scope note

This is a structured runtime artifact for quality gates and demonstration.
It is not a full production Gate 6 website prototype.
`;
  fs.writeFileSync(projectPath(slug, "prototype/STATUS.md"), statusMd, "utf8");

  return {
    ok: true,
    manifestPath: "prototype/manifest.json",
    routes,
    qualityScore: 0.62,
    message: "Thin prototype package written",
  };
}
