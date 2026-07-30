# Sprint 4 — Cross-Company Intelligence Validation

## Outcomes checklist

| # | Outcome | Status |
|---|---|---|
| 1 | Canonical industry concepts | Implemented (`knowledge/normalization/concepts.json` via seed) |
| 2 | Alias normalization | Implemented (registry aliases + company_specific_aliases) |
| 3 | Cross-company entity matching | Implemented (`lib/normalization/match.ts` + compare) |
| 4 | Second-manufacturer ingestion | Fixture `northline-framing` via `seed-peer` |
| 5 | Candidate pattern generation | Observation-key + canonical-concept paths |
| 6 | Cross-company comparison | `npm run siteforge -- compare --slugs a,b` |
| 7 | Pattern confidence + provenance | Mapping method/confidence/evidence on patterns |
| 8 | Human review / promotion readiness | `normalization-review` + confirm; no auto-promote |
| 9 | Runtime across two companies | Capability `normalization.run` + peer fixture |
| 10 | Evidence-backed validation | See commands below |

## Commands

```bash
npm test -- tests/normalization.test.ts
npm run siteforge -- seed-peer
npm run siteforge -- normalize --slug eb-metal --dry-run
npm run siteforge -- normalize --slug northline-framing
npm run siteforge -- compare --slugs eb-metal,northline-framing
npm run siteforge -- normalization-status --slug eb-metal
npm run siteforge -- normalization-review --slug eb-metal
```

## Evidence (2026-07-30 run)

After `npm run siteforge -- seed-peer` + compare:

| Metric | Result |
|---|---|
| Shared canonical concepts | 5 |
| Candidate-pattern-ready concepts | 5 |
| EB Metal mapped / reviewable | 23 mapped (avg conf 0.84) |
| Northline Framing mapped | 7 mapped (avg conf 0.91) |
| Observation-key candidates | 4 (weak calculators, submittals, docs, a11y) |
| Canonical candidates | include Document Center, Engineering Calculator, Submittal Workflow |

Notable alias proof:

- EB Metal `Limiting height calculator` ↔ Northline `Wall Selector` → **Engineering Calculator**
- Northline `Engineering Resources` → **Document Center**
- Northline `Submittal Builder` → **Submittal Workflow**

All candidate patterns remain `candidate_unapproved`.

## Notes

- Benchmark Engine and Digital Maturity Engine intentionally not built.
- Peer manufacturer is a synthetic CFS fixture (not a live crawl) for deterministic CI proof.
- No EB Metal-specific branches in normalization code.
