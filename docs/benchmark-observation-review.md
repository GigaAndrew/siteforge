# Benchmark Observation Review

```bash
npm run siteforge -- benchmark-observation-review \
  --slug cemco \
  --observation <id> \
  --decision accepted|rejected|overridden|unresolved \
  --actor <name> \
  --reason "..." \
  [--state present|partial|unknown|...] \
  [--normalized 0.55] \
  [--material]
```

Overrides must include rationale and are logged with original/resulting values, evidence IDs, benchmark version, and artifact digest. Do not use overrides to hide weak data.
