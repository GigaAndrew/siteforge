# Sprint 5 — Benchmark Engine Validation

## Cohort

- `eb-metal` (live crawl project)
- `northline-framing` (**synthetic fixture** — validation only)

Benchmark: `cfs-digital-capability` v1.0.0

## Proof points

| Requirement | Result |
|---|---|
| Both companies scored from normalized concepts | Yes (108 observations each) |
| unknown ≠ absent | Yes — unknowns do not receive absent performance |
| Performance ≠ confidence | Yes — separate fields on all score outputs |
| Reproducible rebuild | Yes — identical overall + input digest across rebuilds |
| Evidence-backed comparison | Yes — limited peer comparison with gaps/traces |
| Candidate patterns excluded | Yes — definition `excludeCandidatePatterns: true` |
| No company-specific scoring logic | Yes — fixture labeling via generic synthetic detection |
| Sparse evidence lowers certainty | Yes — northline overall **suppressed** (coverage 0.29) |
| Score traces inspectable | Yes — `calculationTrace` on outputs + reports |
| Version invalidation | Yes — approval digest invalidation + inputDigest mismatch |

## Snapshot (rebuild-validated)

| Project | Overall | Confidence | Coverage | Unknown obs | Recommendations |
|---|---:|---:|---:|---:|---:|
| eb-metal | 75.0 | 0.61 | 0.47 | 59 | 15 |
| northline-framing | suppressed | 0.46 | 0.29 | 80 | 17 |

Peer cohort labeled **Limited peer comparison / validation cohort**.

## Approvals (unpublished)

- `benchmark.definition.review` — required
- `benchmark.observation.review` — required
- `benchmark.publish` — required

## Out of scope (confirmed)

- Digital Maturity scoring
- Studio
- Graph-from-Manifest
- Normalization redesign
- Runtime redesign (thin `benchmark.run` only)

## Final validation (Sprint 5)

| Check | Result |
|---|---|
| Tests | **78/78 passed** |
| Typecheck | Pass |
| Lint | Pass (0 errors, 3 pre-existing warnings) |
| Build | Pass |
| Deterministic rebuild | Pass (identical overall + digest) |
| Runtime capability | `benchmark.run` registered; seed node `n_benchmark` |
| Hygiene | Timestamped `knowledge/exports/*` dumps gitignored |

## Readiness

**Score: 86 / 100 — GO** for next sprint after PR review/merge.

Recommended next sprint: **Human Benchmark Review + Live Second Manufacturer Crawl** (replace synthetic peer, resolve approval keys, tighten ambiguous mappings) — not Digital Maturity/Studio until peer evidence is real.
