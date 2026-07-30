# Benchmark Confidence

Confidence is scored **separately** from performance.

## Inputs

- Mapping confidence floors (high/medium)
- Evidence presence
- Stale evidence penalty
- Blocking conflict penalty
- Synthetic fixture confidence cap
- Ambiguity / unknown rates (coverage)

## Interpretation

| Situation | Effect |
|---|---|
| High mapping + fresh evidence | Higher confidence |
| Sparse / unknown observations | Lower coverage; may suppress overall |
| Stale evidence | Confidence penalty |
| Conflicts | Confidence penalty |
| Synthetic fixture | Confidence capped; reports labeled |

Low confidence with a moderate performance score means “possible signal, weak support” — not a precise ranking.
