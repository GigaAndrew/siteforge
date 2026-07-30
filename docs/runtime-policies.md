# Runtime policies

Configured via approval mode and `forge-core/policies/defaults.ts`.

## Approval modes

| Mode | Behavior |
|---|---|
| `auto` | No human pauses |
| `mixed` (default) | Auto through crawl/extract/knowledge/audits; pause at strategy, prototype, pitch |
| `strict` | Also pauses crawl continue + pattern promote |

## Thresholds

- `minEvidenceConfidence`, `minPrototypeScore`, `minPitchConfidence`
- `knowledgeCriticalHighMustBeZero`
- `requireBrowserQa`, `requireAccessibility`
- Budget ceilings: wall clock, invocations, retries, Playwright launches
- `maxLoopIterations` (default 3)

Policies are data — swap mode without architectural changes.
