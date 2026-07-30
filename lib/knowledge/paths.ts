import fs from "node:fs";
import path from "node:path";
import { KNOWLEDGE_SCHEMA_VERSION } from "@/lib/schemas/knowledge";

export const KNOWLEDGE_ROOT = path.join(process.cwd(), "knowledge");

export const KNOWLEDGE_DIRS = [
  "schemas",
  "entities",
  "relationships",
  "evidence",
  "patterns",
  "indexes",
  "exports",
  "conflicts",
  "audit",
] as const;

export function knowledgePath(...parts: string[]): string {
  return path.join(KNOWLEDGE_ROOT, ...parts);
}

export function projectKnowledgeDir(slug: string): string {
  return path.join(process.cwd(), "projects", slug, "knowledge");
}

export function ensureKnowledgeSkeleton(): void {
  for (const dir of KNOWLEDGE_DIRS) {
    fs.mkdirSync(knowledgePath(dir), { recursive: true });
  }
  const readme = knowledgePath("README.md");
  if (!fs.existsSync(readme)) {
    fs.writeFileSync(
      readme,
      `# Forge Knowledge

Shared industry intelligence store for SiteForge.

- Schema version: ${KNOWLEDGE_SCHEMA_VERSION}
- Project facts are ingested from \`projects/<slug>/knowledge/\` then merged here.
- Candidate patterns are unapproved until human promotion.
- Never treat a single-company observation as an industry conclusion.

See \`schemas/MIGRATIONS.md\` for versioning.
`,
      "utf8",
    );
  }
  const migrations = knowledgePath("schemas/MIGRATIONS.md");
  if (!fs.existsSync(migrations)) {
    fs.writeFileSync(
      migrations,
      `# Knowledge schema migrations

Current version: **${KNOWLEDGE_SCHEMA_VERSION}**

## Strategy

1. Bump \`KNOWLEDGE_SCHEMA_VERSION\` in \`lib/schemas/knowledge.ts\` on breaking changes.
2. Add a dated section below describing transform steps.
3. Provide a rebuild path: delete \`knowledge/entities|relationships|evidence|patterns|indexes|conflicts\` (keep audit log) and re-run \`project:knowledge\` for each slug.
4. Non-breaking additive fields: keep version, document in changelog only.

## 1.0.0 — Initial MVP

- Entity / relationship / evidence / conflict / candidate pattern models
- Project slice + shared merge with provenance
`,
      "utf8",
    );
  }
}

export function ensureProjectKnowledgeDir(slug: string): void {
  fs.mkdirSync(projectKnowledgeDir(slug), { recursive: true });
}

export function readJsonArray<T>(filePath: string): T[] {
  if (!fs.existsSync(filePath)) return [];
  const raw = JSON.parse(fs.readFileSync(filePath, "utf8")) as unknown;
  return Array.isArray(raw) ? (raw as T[]) : [];
}

export function writeJson(filePath: string, data: unknown): void {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(data, null, 2)}\n`, "utf8");
}

export function writeJsonl(filePath: string, rows: unknown[]): void {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  const body = rows.map((r) => JSON.stringify(r)).join("\n") + (rows.length ? "\n" : "");
  fs.writeFileSync(filePath, body, "utf8");
}
