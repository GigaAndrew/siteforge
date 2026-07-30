# Sprint 5 — Benchmark Engine (Architecture Plan)

## Baseline

SiteForge `v0.3.0` provides canonical concepts, project mappings, evidence/confidence/conflicts, cross-company comparison, and unapproved candidate patterns. The Benchmark Engine is a **consumer** of that layer.

## Integration points

| Input | Source | Usage |
|---|---|---|
| Canonical concepts | `loadConcepts()` | Dimension ↔ concept eligibility |
| Project mappings | `loadProjectMappings(slug)` | Presence / partial / ambiguous observations |
| Evidence + conflicts | `loadStore()` | Confidence, stale, conflict flags |
| Comparison | `compareProjects(slugs)` | Peer cohort context only |
| Candidate patterns | `knowledge/patterns/candidates.json` | **Excluded** as criteria unless status approved |

## Data flow

```
benchmark definition (versioned)
        ↓
normalize mappings + KG evidence (read-only)
        ↓
observations (present|absent|partial|unknown|ambiguous|not_applicable)
        ↓
dimension scores + concept scores (performance ≠ confidence)
        ↓
company aggregate (only if eligibility met)
        ↓
peer comparison (limited cohort when n=2)
        ↓
recommendations + reports
```

## Storage (project isolation)

```
knowledge/benchmarks/definitions/<id>.json
knowledge/benchmarks/runs/<runId>.json
projects/<slug>/benchmark/<benchmarkId>/<version>/
  observations.json
  concept-scores.json
  dimension-scores.json
  company-score.json
  recommendations.json
  status.json
  run-manifest.json
```

Benchmark never mutates `knowledge/entities`, mappings, or project knowledge slices.

## Scoring boundaries

- Performance score and confidence score are separate.
- `unknown` ≠ `absent`.
- Missing evidence → unknown / suppressed aggregates, never fabricated precision.
- Weights apply only to eligible dimensions.
- Candidate patterns are not scoring criteria.
- Two-company results labeled **limited peer comparison / validation cohort**.

## Runtime

Thin capability `benchmark.run` after `n_normalize`. Planner selects when graph shows normalization complete and benchmark outputs missing/stale. Approvals: `benchmark.definition.review`, `benchmark.observation.review`, `benchmark.publish`.

## Validation strategy

Score `eb-metal` + `northline-framing` (synthetic labeled), deterministic rebuild, tests for present/absent/unknown, eligibility, peer compare, isolation.

## Known limitations

- Initial CFS definition is **not** a universal industry standard.
- Synthetic peer is not market evidence.
- Live second manufacturer crawl deferred; architecture supports swap-in.
- Digital Maturity / Studio out of scope.
