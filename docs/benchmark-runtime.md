# Benchmark Runtime

## Capability

- Name: `benchmark.run`
- Prerequisite: `normalization.run`
- Seed node: `n_benchmark` (depends on `n_normalize`)
- Produces: `benchmark/cfs-digital-capability/1.0.0/status.json`

## Planner behavior

| Graph state | Action |
|---|---|
| Normalized, no benchmark status | Run `benchmark.run` |
| Benchmark status present, force | Rebuild |
| Insufficient evidence | Status written with overall suppressed + evidence-gap recommendations |
| Definition/version change | Digests diverge → stale approvals invalidated |

Runtime does not auto-publish results. Publication approvals remain human-gated.
