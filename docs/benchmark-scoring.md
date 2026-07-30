# Benchmark Scoring

## Flow

1. Load selected/accepted definition version
2. Generate observations from normalization mappings + KG evidence
3. Score concepts and dimensions
4. Emit company aggregate only if eligibility thresholds met
5. Peer-compare when ≥2 scored projects

## Observed states

`present` | `partial` | `absent` | `unknown` | `ambiguous` | `not_applicable`

**Never** coerce `unknown` → `absent`.

## Eligibility (company overall)

Controlled by definition:

- min mapped concepts
- min evidence coverage
- min eligible dimensions
- required dimensions present

If unmet → overall score **suppressed**; component scores remain visible.

## Weights

Dimension weights sum to 1.0. Overall uses eligible dimensions only (renormalized).

## Traces

Every score output includes `calculationTrace`, exclusions, caveats, confidence, coverage, uncertainty.
