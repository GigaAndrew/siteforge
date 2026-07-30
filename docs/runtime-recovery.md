# Failure recovery

Failures do not immediately abort the project.

1. **Retry** — per capability `retryPolicy.maxRetries` and global `maxRetriesPerNode`
2. **Alternate** — e.g. extraction may suggest recrawl via `alternateCapability` (recorded for operators)
3. **Partial complete** — other ready nodes may still run on later resumes
4. **Escalate** — pause with `pauseReason` for human intervention
5. **Abort** — only via `siteforge cancel` or unrecoverable planner `fail`

Budgets (`wall_clock`, `invocations`, `playwright`) force pause rather than infinite loops. Planner also enforces `maxTicks` safety bound per CLI invocation.

## Additional recovery behaviors

- **Exceptions during execute** → retry per policy, else pause with `node_exception`
- **Stranded running** → recovered to `pending` at run/resume start
- **Reject approval** → gate failed + upstream invalidated for revision
- **Lock contention** → fail fast with operator message (no silent overwrite)
