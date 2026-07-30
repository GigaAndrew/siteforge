# Runtime state model

## Execution node

Fields: `id`, `type`, `capability`, `inputs`, `outputs`, `dependencies`, `status`, `confidence`, `qualityScore`, `startedAt`, `completedAt`, `runtimeMs`, `cost`, `retries`, `blockingIssues`, `nextActions`, `loopId`, `approvalKey`, `lastError`.

### Status values

`pending` → `ready`/`running` → `passed` | `failed` | `skipped` | `waiting_approval` | `invalidated`

## Run state

Tracks `runId`, `status`, `approvalMode`, `goal`, `currentNodeId`, `activeLoops`, `loopIterations`, `pauseReason`, `lastPlannerRationale`.

## Approvals

`approvals.json` stores per-key decisions (`strategy.accept`, `prototype.approve`, `pitch.approve` in mixed mode).

## Source of truth

Runtime JSON under `projects/<slug>/runtime/` is authoritative for gates and approvals. `project-status.md` / `config.stage` are derived views updated by adapters.

## Transitions

Legal transitions are enforced by `forge-core/state/transitions.ts`. Nodes left in `running` after a crash are recovered to `pending` on the next run/resume.

## Invalidation

`reset-node` clears execution fields (outputs, retries, scores) on the target and downstream nodes, bumps graph `revision`, and revokes dependent approvals (`invalidated: true`).
