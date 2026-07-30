# Human Normalization Review

## List queue

```bash
npm run siteforge -- normalization-review --slug cemco
npm run siteforge -- normalization-review --slug cemco --status ambiguous
npm run siteforge -- normalization-review --slug cemco --status below_threshold --min-confidence 0.5
```

## Decisions

```bash
npm run siteforge -- normalization-confirm --slug cemco --mapping <id> --concept canon_document-center --actor <name> --reason "..."
npm run siteforge -- normalization-reject --slug cemco --mapping <id> --actor <name> --reason "..."
npm run siteforge -- normalization-unresolve --slug cemco --mapping <id> --actor <name> --reason "..."
```

Each decision appends to `projects/<slug>/knowledge/normalization/review-log.json` with digest, rationale, timestamps. Prior valid decisions for the same mapping are invalidated when superseded. Digest mismatch invalidation is available for upstream evidence changes.

Do not accept a mapping solely to reduce unknown counts.
