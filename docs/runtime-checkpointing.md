# Checkpointing

After each successful node, the runtime writes `runtime/checkpoints/<nodeId>.json` and updates `execution-graph.json`.

## Commands

- `siteforge pause` — set run status paused
- `siteforge resume` — continue without re-running passed nodes (`isComplete` fast-path)
- `siteforge reset-node --node <id>` — reset node to pending and invalidate downstream dependents
- `siteforge run --reset` — re-seed graph/approvals/budgets

Passed nodes are skipped on resume unless `--force` is supplied to the tick/execute path.

Checkpoints are versioned envelopes:

```json
{ "schemaVersion": "1.0.0", "runId": "...", "graphRevision": 12, "savedAt": "...", "node": { } }
```

JSON persistence uses atomic rename. Concurrent writers are serialized by `runtime/.run.lock`.
