# Benchmark Engine

The Benchmark Engine evaluates manufacturers against **versioned, evidence-backed** digital capability definitions. It consumes SiteForge normalization mappings and knowledge evidence; it does not create a second normalization layer.

See also:

- [Architecture plan](./benchmark-engine-plan.md)
- [Definitions](./benchmark-definitions.md)
- [Scoring](./benchmark-scoring.md)
- [Confidence](./benchmark-confidence.md)
- [Operations / CLI](./benchmark-operations.md)
- [Runtime](./benchmark-runtime.md)

## Principles

- Performance score ≠ confidence score
- `unknown` ≠ `absent`
- No fabricated precision when evidence is sparse
- Candidate patterns remain unapproved and are excluded from criteria
- Project isolation — benchmark reads mappings/evidence; never mutates company KG records
- Two-company results are a **limited peer comparison / validation cohort**
