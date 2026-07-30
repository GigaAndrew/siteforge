# Sprint 3 — Runtime Hardening Results

Generated: 2026-07-30

## Tests

| Metric | Value |
|---|---|
| Tests passed | **60** |
| Tests failed | **0** |
| New/expanded test files | `tests/runtime/hardening.test.ts`, updated `registry.test.ts`, `planner.test.ts` |

New coverage includes: slug validation, transitions, stranded recovery, invalidate clears outputs, early approval block, approval revision binding, approval invalidation on reset, lock contention, budget pause, loop non-retention, duplicate capability rejection, cycle detection.

## EB Metal re-validation

Completed under mixed approvals with explicit `SITEFORGE_QA_ALLOW_OFFLINE=1`.

Final status: **completed**. Three human gates exercised with actor `audit`.

## Findings summary

| Severity | Found | Fixed now | Remaining |
|---|---|---|---|
| Critical | 1 | 1 | 0 |
| High | 7 | 7 | 0 |
| Medium | 8 | 0 (documented) | 8 |
| Low | 3 | 0 (documented) | 3 |

## Fixes completed

1. **Slug containment** — `assertValidProjectSlug` in `lib/project.ts` + CLI  
2. **Atomic JSON writes** — temp + rename  
3. **Runtime lock** — `forge-core/runtime/.run.lock` with stale/pid break  
4. **Exception-safe execute** — try/catch; stranded running recovery  
5. **Invalidation hygiene** — clear outputs/retries/scores; revoke approvals  
6. **Approval binding** — `graphRevision` + `artifactDigest`; upstream required  
7. **Reject path** — fail gate + invalidate upstream for revision  
8. **Loop accounting** — rebuild active set; count re-exec only  
9. **Quality ceiling** — `Math.min(result, gateScore)`  
10. **Duplicate capability rejection** + graph cycle validation on save  
11. **Thin adapters** marked `demoOnly` / versioned  
12. **Offline QA** opt-in only (no CLI default)  
13. **Transition helpers** for node/run legality  
14. **Tolerant JSONL readers**  

## Remaining risks

- Template-coupled planner/gates (Medium) — ok for 2nd company, revisit before scale  
- Thin/demo completion still permitted for Sprint 3 validation profile  
- Token budgets not metered  
- Artifact freshness still largely existence-based for some `isComplete` checks  

## Readiness

**Score: 78/100 — GO** for second-company ingestion / cross-company normalization, under the constraints in the architecture review.
