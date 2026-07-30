# Benchmark Operations

## CLI

```bash
npm run siteforge -- benchmark-list
npm run siteforge -- benchmark-inspect --benchmark cfs-digital-capability
npm run siteforge -- benchmark-run --slugs eb-metal,northline-framing --benchmark cfs-digital-capability
npm run siteforge -- benchmark-run --slug eb-metal --dry-run
npm run siteforge -- benchmark-rebuild --slugs eb-metal,northline-framing
npm run siteforge -- benchmark-status --slug eb-metal
npm run siteforge -- benchmark-report --slug eb-metal
npm run siteforge -- benchmark-compare --slugs eb-metal,northline-framing
npm run siteforge -- benchmark-approve --key benchmark.definition.review --actor <name> --reason "..."
```

## Outputs

`projects/<slug>/benchmark/<id>/<version>/` — observations, scores, recommendations, status, run-manifest.

Root reports under `reports/benchmark-*.md`.

## Approvals

Keys: `benchmark.definition.review`, `benchmark.observation.review`, `benchmark.publish`.

Bound to artifact id, version, digest, reviewer, timestamp, decision, rationale. Upstream definition/mapping changes invalidate approvals.

## Replacing synthetic peer

Swap `northline-framing` fixture for a live crawl project with the same slug conventions; re-normalize then `benchmark-rebuild`. No engine redesign required.
