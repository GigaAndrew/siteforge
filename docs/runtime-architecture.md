# Forge Core Runtime — Architecture

SiteForge Sprint 3 introduces a graph-driven execution engine that orchestrates existing capabilities without redesigning them.

## Principles

1. **Runtime decides WHAT** — planner, gates, budgets, approvals.
2. **Capabilities decide HOW** — adapters wrap `lib/` engines and thin generators.
3. **No hardcoded workflow** inside the loop controller — the planner re-evaluates graph state every tick.
4. **Registration-only extension** — new work registers a capability; core runtime stays stable.

## Components

| Component | Path | Role |
|---|---|---|
| State | `forge-core/state/` | Execution graph, run state, persistence |
| Planner | `forge-core/planner/` | Next-best-action scoring |
| Runtime | `forge-core/runtime/` | Loop controller, pause/resume |
| Registry | `forge-core/capabilities/` | Capability descriptors + adapters |
| Policies | `forge-core/policies/` | Approval mode, thresholds, budgets |
| Gates | `forge-core/gates/` | Quality gate evaluation |
| Loops | `forge-core/loops/` | Declarative loop activation |
| History | `forge-core/history/` | Events + planner decisions |
| Budgets | `forge-core/budgets/` | Invocation / time / Playwright limits |
| Dashboard | `app/runtime/[projectSlug]/` | Internal status UI |
| CLI | `scripts/siteforge.ts` | Operator interface |

## Data flow

```
CLI/Dashboard → LoopController → Planner → Capability Registry → Adapters → lib engines
                     ↓
              execution-graph.json + history/*.jsonl
```

## Project artifacts

```
projects/<slug>/runtime/
  execution-graph.json
  run-state.json
  budgets.json
  approvals.json
  history/events.jsonl
  history/decisions.jsonl
  checkpoints/<nodeId>.json
```

## Compatibility

Legacy `npm run project:*` commands remain. Prefer `npm run siteforge -- run --slug <slug>` for end-to-end execution.

## Hardening notes (post Sprint 3 audit)

- Per-project runtime lock: `runtime/.run.lock`
- Atomic JSON writes (temp + rename)
- Slug path containment via `assertValidProjectSlug`
- Graph revision + approval digests
- Duplicate capability registration rejected
- Thin Prototype / Browser QA / Pitch marked `demoOnly`
- See `reports/sprint-3-runtime-architecture-review.md` and `docs/runtime-operations.md`
