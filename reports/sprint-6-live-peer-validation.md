# Sprint 6 — Live Peer Validation (Final Readiness)

## Verdict

**GO (84/100)** for the next sprint after PR merge. SiteForge produced defensible benchmark outputs from two independently crawled live manufacturers (`eb-metal`, `cemco`) without treating results as an industry standard. `benchmark.publish` remains closed by design.

**Recommended next sprint:** broader live cohort expansion + crawl/extraction hardening (unknown counts remain high under page budgets). Digital Maturity Engine is not recommended until another live peer lands or CEMCO coverage is denser.

---

## Branch / baseline

| Item | Value |
|---|---|
| Branch | `feature/live-peer-validation` |
| Base | `main` @ `v0.4.0` (`612f462`) |
| Scope exclusions honored | No Digital Maturity scoring, Studio, Graph-from-Manifest, runtime redesign, merge/tag/release |

---

## Live manufacturer

| Field | Value |
|---|---|
| Company | CEMCO |
| Slug | `cemco` |
| Domain | https://cemcosteel.com/ |
| Rationale | Real CFS manufacturer; public Submittal Creator, Product Finder, catalogs, eval reports, Revit/CAD; crawlable without auth; enough overlap with EB Metal for comparison and enough structural difference to stress normalization |
| Alternatives rejected | ClarkDietrich (Cloudflare hard-block); MarinoWARE (weaker public technical surface); northline-framing (synthetic) |

Selection detail: `reports/live-peer-selection.md`

---

## Crawl totals (`cemco`)

| Metric | Value |
|---|---:|
| Pages fetched | 40 |
| Documents inventoried | 782 |
| Crawl errors | 0 |
| Coverage claim | **Incomplete** — conservative page budget; not full-site |

Knowledge ingest: **229** entities, **227** relationships, **186** evidence records.

Detail: `reports/live-peer-crawl.md`, `projects/cemco/reports/live-peer-crawl.md`

---

## Normalization

| Metric | Pre-review (approx) | Post-review |
|---|---:|---:|
| Mapped | 24 | 26 |
| Unmapped / below-threshold | 147 | 145 |
| Ambiguous | 3 | 1 |
| Confirmed (human) | 0 | 4 |
| Rejected (human) | 0 | 1 |
| Unresolved (explicit) | — | 1 |
| Review-log entries | 0 | 6 |

Reductions came from explicit human decisions + evidence-backed confirms, not relabeling unknowns as absent.

Detail: `reports/live-peer-normalization.md`, `reports/human-review-log.md`

---

## Cross-company comparison

Cohort: **EB Metal × CEMCO** (live two-company validation cohort — not an industry benchmark).

Shared concepts observed include Document Center, Submittal Workflow, Product Catalog/Detail, CAD/BIM resources, Contact/Rep locator patterns. Company-specific surfaces and evidence gaps remain; unknowns are not treated as confirmed absences.

Detail: `reports/live-peer-comparison.md`

---

## Benchmark (`cfs-digital-capability` v1.0.0)

| Project | Overall | Confidence | Coverage | Unknown obs | Synthetic |
|---|---:|---:|---:|---:|---|
| eb-metal | 75.0 | 0.609 | 0.474 | 59 | false |
| cemco | 75.1 | 0.620 | 0.500 | 58 | false |

| CEMCO observations | Count |
|---|---:|
| Total | 108 |
| present | 23 |
| partial | 27 |
| unknown | 58 |
| absent | 0 |
| Reviewed observations | 1 accepted |
| Material overrides | 0 |

CEMCO dimension raw scores (eligible): capability_presence 71.7, discoverability 77.5, information_completeness 77.5, technical_depth 55.0, workflow_support 100, document_accessibility 100, product_navigation 70.0, engineering_utility 20.0, evidence_quality 100, evidence_recency 95.0, cross_channel_consistency 100.

Overall scores generated (eligible). Synthetic peer excluded from `--live-cohort`.

Detail: `reports/live-peer-benchmark.md`, `reports/live-peer-evidence-gaps.md`

---

## Approval statuses

| Gate | Status |
|---|---|
| `benchmark.definition.review` | **satisfied** (sprint6-reviewer, digest-bound) |
| `benchmark.observation.review` | **satisfied** (sprint6-reviewer, digest-bound) |
| `benchmark.publish` | **unsatisfied** (intentional; not an industry publication) |

Invalidation semantics remain digest/version-bound via existing approval helpers. Publication stays blocked until all three gates pass.

---

## Synthetic fixture disposition

`projects/northline-framing` retained for deterministic tests/fixtures/regression only.

- Clearly labeled synthetic
- Excluded from `--live-cohort` and live claims
- Reports label live vs synthetic; production-facing cohort defaults to live projects
- Architecture does not require the fixture for live comparison

Docs: `docs/live-vs-synthetic-cohorts.md`

---

## Review tooling delivered

- Normalization: filtered review queue; confirm / reject / unresolve; digest-bound audit log; CLI `normalization-review|confirm|reject|unresolve`
- Benchmark: observation accept/reject/override/unresolve with audit; cohort labeling (`cohortLabel`, `--live-cohort`)
- Synthetic detection hardened (`Not synthetic` no longer false-positive)

---

## Reports created

- `reports/live-peer-selection.md`
- `reports/live-peer-crawl.md`
- `reports/live-peer-normalization.md`
- `reports/live-peer-comparison.md`
- `reports/live-peer-benchmark.md`
- `reports/live-peer-evidence-gaps.md`
- `reports/human-review-log.md`
- `reports/sprint-6-live-peer-validation.md` (this file)
- Project mirrors under `projects/cemco/reports/`

Docs: `docs/live-peer-validation-plan.md`, `docs/live-manufacturer-ingestion.md`, `docs/human-normalization-review.md`, `docs/benchmark-observation-review.md`, `docs/benchmark-approval-workflow.md`, `docs/live-vs-synthetic-cohorts.md`

---

## Validation results

| Check | Result |
|---|---|
| Full test suite | **85/85 passed** (5× sequential stress runs green after timeout/bootstrap hardening) |
| Typecheck | **pass** |
| Lint | **pass** (3 pre-existing unused-var warnings) |
| Production build | **pass** |
| Deterministic rebuild (eb-metal) | **pass** — overall 75.009… retained; publish still false |
| Runtime capability registration | **pass** (bootstrap lock + 30s test timeout) |
| Live cohort labeling | **pass** — “Live two-company validation cohort — not an industry benchmark” |
| Publish gate | **blocked** without `benchmark.publish` |

---

## Remaining risks / debt

1. **High unknown counts** (~58–59 obs) under 40-page crawl — limits external validity of dimension scores (especially engineering_utility).
2. **Large unmapped/below-threshold set** (145) — needs more evidence or deliberate review, not auto-accept.
3. **One ambiguous mapping remaining** on CEMCO — left unresolved intentionally.
4. **EB Metal human review** lighter than CEMCO in this sprint.
5. **Approval invalidation E2E** covered at unit/helper level; full multi-artifact change matrix can deepen later.
6. **Crawl used project:crawl + audit + knowledge path**; full `siteforge run` planner path for CEMCO not re-proven end-to-end in this session.
7. Parallel vitest contention required registry bootstrap hardening — monitor in CI.

---

## Readiness score

**84 / 100 — GO**

Deducted for incomplete crawl coverage, residual unknowns/unmapped volume, and limited observation-review depth — not for architectural failure.

---

## Next sprint recommendation (evidence-based)

1. **Primary:** Broader live cohort expansion (third real manufacturer) **and/or** crawl/extraction hardening to reduce unknowns with more evidence.
2. **Secondary:** Review dashboard / denser human review throughput.
3. **Defer:** Digital Maturity Engine and Studio until live cohort evidence density improves further.
4. **Do not:** treat current scores as industry standard; do not satisfy `benchmark.publish` without an explicit publication decision.
