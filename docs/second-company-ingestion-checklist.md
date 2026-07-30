# Second-company ingestion checklist (cold-formed steel)

Use this before running Forge Knowledge on another CFS / metal framing manufacturer.

## 0. Goal

Prove candidate-pattern logic with **two independent companies** while preserving project isolation and epistemic honesty.

## 1. Required crawl artifacts

For `projects/<slug>/`:

- [ ] `config.json` with `approvedHosts`, industry string, website URL
- [ ] `source/pages.json` (successful HTML pages; prefer ≥20)
- [ ] `source/documents.json`
- [ ] `source/forms.json`, `tables.json`, `images.json`, `external-tools.json`
- [ ] `source/navigation.json`
- [ ] `source/crawl-errors.json` (may be empty array)
- [ ] `screenshots/manifest.json` (recommended, not required for knowledge ingest)

## 2. Required audit / evidence artifacts

- [ ] `data/company-profile.json` (readable summary — not binary garbage)
- [ ] `data/product-inventory.json`
- [ ] `data/document-inventory.json`
- [ ] `analysis/source-evidence.md`
- [ ] `analysis/digital-maturity.json`
- [ ] `analysis/executive-audit.md` + technical/a11y/seo/performance audits

## 3. Required strategy artifacts (recommended for task/opportunity quality)

- [ ] `strategy/current-journeys.md`
- [ ] `strategy/opportunity-map.md`
- [ ] `strategy/process-improvement-map.md`
- [ ] `data/calculator-requirements.json` (even if empty calculators array)

## 4. Minimum evidence quality

- [ ] Homepage fact claims include `sourceUrl` + confidence
- [ ] No company summary dominated by non-printable bytes
- [ ] At least one ProductFamily or Product with source URL
- [ ] Technology/CMS indicators captured when visible
- [ ] Maturity categories include evidence text + confidence
- [ ] Conceptual tools labeled `recommendation`, never `fact`

## 5. Expected normalization collisions

| Collision | Example | Handling |
|---|---|---|
| Generic family terms | both sites say “stud” | Shared `ProductFamily` global key may merge — verify that is desirable; else scope families per project |
| DocumentType `pdf` | both sites | Global DocumentType is OK |
| Industry string drift | “CFS” vs “cold-formed steel framing…” | Normalize industry key manually in config before ingest if needed |
| Observation keys | maturity category labels | Keep category names stable across audits |
| Brand vs legal name | “Acme” vs “Acme Building Products LLC” | One Company entity per project; do not merge companies automatically |

## 6. Company identity rules

- One `Company` entity per `projectSlug` (project-scoped ID)
- Never treat two projects about the **same** legal entity as two independent companies for candidate patterns
- If re-auditing the same company, reuse the same slug or explicitly link company IDs — multiple projects alone do **not** count as independence

## 7. Product-family normalization rules

- Prefer manufacturer-named families (e.g. NITROSTUD) over generic nouns when both exist
- Store generic terms with `properties.genericTerm=true` in a future extract (not required now)
- Do not invent families not present in crawl/inventory

## 8. Document-type normalization rules

- Prefer semantic types when title/filename implies them: `limiting-height-table`, `sds`, `catalog`, `spec`, `warranty`
- Fall back to extension (`pdf`, `docx`) only when unknown
- Unknown is better than wrong

## 9. Calculator classification rules

| Situation | Epistemic class | `classification` property |
|---|---|---|
| Live tool observed on site | `observation` or `fact` (with evidence) | `table_driven` / unknown |
| Proposed in strategy/prototype only | `recommendation` | `conceptual` |
| Production engineering claim | forbidden without manufacturer validation | `production_engineering` only with signoff |

## 10. Independent-company logic (candidate patterns)

Requires **all** of:

1. Same normalized `observationKey`
2. ≥2 distinct `sourceProject` values
3. ≥2 distinct `Company` entity IDs
4. No conflict with `blocksPatternPromotion=true`

Duplicate pages inside one project never increase independence.

## 11. Candidate-pattern behavior to expect

After second independent CFS company with overlapping weak-calculator / PDF-submittal / dept-IA observations:

- [ ] `knowledge:query -- --candidate-patterns` may return **candidate_unapproved** rows
- [ ] Labels must still say unapproved / not industry standard
- [ ] Conflicts surface under `knowledge/conflicts/` and block auto-create

## 12. Commands

```bash
npm run project:create -- --name "..." --url "https://..." --slug "..." --industry "Cold-formed steel framing"
npm run project:crawl -- --slug ...
npm run project:screenshots -- --slug ...
npm run project:audit -- --slug ...
npm run project:strategy -- --slug ...
npm run project:knowledge -- --slug ... --dry-run
npm run project:knowledge -- --slug ...
npm run knowledge:inspect -- --slug ... --strict
npm run knowledge:query -- --candidate-patterns
```

## 13. Ready when

- [ ] Integrity tests pass (`npm run test`)
- [ ] `knowledge:inspect --strict` passes for company A and company B (or only medium/low issues accepted intentionally)
- [ ] Quality report regenerated for each slug
- [ ] No conceptual calculator stored as `fact`

## Suggested next company (from existing project context only)

SiteForge currently contains **only** EB Metal as a completed prospect. No second CFS manufacturer has been crawled or configured in this repository.

**Recommendation:** Choose another **public cold-formed steel framing manufacturer** (same industry string family) that is **not** EB Metal, create a new slug, and run the checklist above. Do not pick a distributor-only site or a general contractor — independence and observationKey overlap work best with a peer manufacturer.

Do not invent a specific competitor name here without an explicit configured target URL in project config.
