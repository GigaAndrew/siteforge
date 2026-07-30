# Benchmark Approval Workflow

Keys:

- `benchmark.definition.review`
- `benchmark.observation.review`
- `benchmark.publish`

```bash
npm run siteforge -- benchmark-approve --key benchmark.definition.review --actor <name> --reason "..."
npm run siteforge -- benchmark-approve --key benchmark.observation.review --actor <name> --reason "..."
# publish remains blocked until all conditions genuinely pass — do not auto-satisfy
```

Approvals bind artifact id, version, digest, reviewer, timestamp, decision, rationale. Definition/mapping/evidence changes invalidate stale approvals via digest mismatch.
