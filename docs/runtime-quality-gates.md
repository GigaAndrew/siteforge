# Runtime quality gates

Gates live in `forge-core/gates/evaluate.ts`. A node cannot be marked `passed` if gates fail (except pure approval stamps).

| Capability | Gate |
|---|---|
| knowledge.build | inspect critical/high = 0 |
| audit.* | executive audit present |
| prototype.generate | manifest present; score ≥ policy |
| qa.browser | browser-qa.json ok |
| pitch.generate | ≥80% recommendations have evidence |
| lessons.derive | lessons-learned.md |
| platform.improvements | registry non-empty |

Thin Prototype/Pitch/QA are demo-grade and carry confidence caps so they do not overclaim consulting readiness.
