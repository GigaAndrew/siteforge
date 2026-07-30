# Knowledge schema migrations

Current version: **1.0.0**

## Strategy

1. Bump `KNOWLEDGE_SCHEMA_VERSION` in `lib/schemas/knowledge.ts` on breaking changes.
2. Add a dated section below describing transform steps.
3. Provide a rebuild path: delete `knowledge/entities|relationships|evidence|patterns|indexes|conflicts` (keep audit log) and re-run `project:knowledge` for each slug.
4. Non-breaking additive fields: keep version, document in changelog only.

## 1.0.0 — Initial MVP

- Entity / relationship / evidence / conflict / candidate pattern models
- Project slice + shared merge with provenance
