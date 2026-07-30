# Runtime operations

## Safe local execution

```bash
# Prefer runtime orchestration
npm run siteforge -- run --slug <slug> --mode mixed

# Explicit offline browser QA (demo only — not production a11y)
SITEFORGE_QA_ALLOW_OFFLINE=1 npm run siteforge -- resume --slug <slug>

npm run siteforge -- approve --slug <slug> --key strategy.accept --actor <you>
npm run siteforge -- resume --slug <slug>
```

## Locking

Mutating commands acquire `projects/<slug>/runtime/.run.lock`.

If a process crashes, the lock is broken when the PID is dead or the lock is older than 5 minutes. Do not delete the lock while another `siteforge` command is running.

## Approvals

- Mixed mode pauses at `strategy.accept`, `prototype.approve`, `pitch.approve`.
- Approvals bind `graphRevision` + optional `artifactDigest`.
- `reset-node` revokes dependent approvals.
- Reject fails the gate and invalidates upstream for revision.

## Profiles

| Profile | Guidance |
|---|---|
| Demo / Sprint validation | Thin adapters OK; offline QA opt-in |
| Consulting delivery | Replace `demoOnly` capabilities; require live browser QA |

## Dashboard

Internal: `/runtime/<slug>` — reads the same JSON as the CLI (`run-state`, graph, budgets, approvals, history).

## Recovery

| Situation | Action |
|---|---|
| Stuck lock | Confirm no process; delete `runtime/.run.lock` if stale |
| Stranded running node | Automatic on next `run`/`resume` |
| Bad upstream artifact | `reset-node --node <id>` then `resume` |
| Budget pause | Raise policy limits or wait; resume after change + re-seed budgets if needed |
