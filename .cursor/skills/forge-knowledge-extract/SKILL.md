---
name: forge-knowledge-extract
description: >-
  Extracts and merges SiteForge project artifacts into Forge Knowledge with
  provenance, deduplication, conflict handling, and candidate-pattern rules.
  Use when running project:knowledge, rebuilding the graph, or reviewing
  promotion safeguards.
---

# Forge Knowledge Extract

## When to use

After Gate 1–2 artifacts exist for a project, or when refreshing shared intelligence.

## Commands

```bash
npm run project:knowledge -- --slug <slug>
npm run project:knowledge -- --slug <slug> --dry-run
npm run project:knowledge -- --slug <slug> --force
npm run project:knowledge -- --slug <slug> --rebuild
npm run knowledge:query -- --company <slug-or-key>
npm run knowledge:query -- --industry "cold-formed steel"
npm run knowledge:query -- --entity-type Calculator
npm run knowledge:query -- --candidate-patterns
```

## Workflow

1. Verify inventories exist (`data/company-profile.json`).
2. Prefer `--dry-run` first for large changes.
3. Run ingest (idempotent via artifact hashes).
4. Query company / entity type / evidence status.
5. Review `knowledge/conflicts/` and blocked candidates — never auto-approve.

## Safeguards

- Stable hashed IDs + schema version `1.0.0`
- Project slice isolation under `projects/<slug>/knowledge/`
- Candidate patterns require ≥2 projects AND ≥2 companies
- Conflicts set `blocksPatternPromotion`
- Stale evidence marked when missing on re-ingest
- Rebuild clears graph shards but keeps `knowledge/audit/`

## Prohibitions

- No invented industry conclusions
- No UI changes in this skill
- No storing recommendations as `fact`
