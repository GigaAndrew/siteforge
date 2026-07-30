# Capability registry

Every capability registers a descriptor + handlers:

- `isComplete(ctx)` — artifact/quality completeness (not mere file existence alone where possible)
- `execute(ctx)` → `CapabilityResult`

## Registered capabilities (Sprint 3)

| Name | Adapter target |
|---|---|
| `crawl.run` | `lib/crawler/crawl.ts` |
| `extraction.repair` | `lib/crawler/repair.ts` |
| `screenshots.capture` | `lib/screenshots/capture.ts` |
| `knowledge.build` | `lib/knowledge/ingest.ts` |
| `reliability.score` | `lib/reliability/scores.ts` |
| `audit.*` | `lib/analyzer/pipeline.ts` (facades) |
| `strategy.generate` | `runStrategyPipeline` |
| `approval.gate` | approvals.json check |
| `prototype.generate` | `lib/prototype/thin.ts` |
| `qa.browser` | `lib/qa/browser-thin.ts` |
| `pitch.generate` | `lib/pitch/thin.ts` |
| `reports.confidence` | `runPlatformReports` |
| `lessons.derive` | platform reports |
| `platform.improvements` | improvements registry |

## Adding a capability

1. Implement callable in `lib/` or `forge-core/capabilities/adapters/`.
2. Register in `forge-core/capabilities/register-all.ts`.
3. Optionally add a node to the goal template in `forge-core/state/seed.ts`.
4. No changes to planner/runtime core required if produces/prerequisites are declared.
