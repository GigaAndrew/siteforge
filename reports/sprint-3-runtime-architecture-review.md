# Sprint 3 — Forge Core Runtime Architecture Review

Generated: 2026-07-30  
Branch: `feature/forge-runtime`  
Scope: architecture audit + Critical/High hardening (no new product capabilities)

---

## 1. Executive summary

The Forge Core Runtime is a viable **orchestration OS** for SiteForge: graph-seeded execution, registry-backed capabilities, planner scoring, mixed approvals, budgets, history, and CLI/dashboard. EB Metal completes end-to-end under mixed approvals.

It is **graph-aware** (deps + status + signals) but still **template-seeded** (fixed consulting workflow nodes). Registration alone does not add planner nodes/gates/signals — documented as Medium debt.

Critical path traversal and several High issues (locking, stranded running, approval binding, loop accounting, quality inflation, offline-QA default) were fixed in this audit. Remaining Medium items should not block second-company ingestion if operators follow runtime ops guidance.

**Readiness score: 78 / 100**  
**Recommendation: GO** for cross-company normalization / second-company ingestion, with constraints below.

---

## 2. Actual implementation map

| Responsibility | Owner |
|---|---|
| CLI entry | `scripts/siteforge.ts` |
| Loop controller / tick | `forge-core/runtime/controller.ts` |
| File lock | `forge-core/runtime/lock.ts` |
| Planner | `forge-core/planner/plan.ts` |
| Graph seed template | `forge-core/state/seed.ts` |
| Schemas | `forge-core/state/schemas.ts` |
| Persistence / invalidation | `forge-core/state/persist.ts` |
| Transitions | `forge-core/state/transitions.ts` |
| Graph validation | `forge-core/state/validate-graph.ts` |
| Registry | `forge-core/capabilities/registry.ts` |
| Adapters | `forge-core/capabilities/register-all.ts` |
| Gates | `forge-core/gates/evaluate.ts` |
| Loops (declarative) | `forge-core/loops/definitions.ts` |
| Budgets | `forge-core/budgets/track.ts` |
| Policies | `forge-core/policies/defaults.ts` |
| History | `forge-core/history/log.ts` |
| Dashboard | `app/runtime/[projectSlug]/page.tsx` |
| Thin adapters | `lib/prototype/thin.ts`, `lib/pitch/thin.ts`, `lib/qa/browser-thin.ts` |
| Atomic JSON / slug guard | `lib/project.ts` |

---

## 3. Planner assessment

**Verdict: graph-driven for readiness; not fully graph-derived.**

Driven by: node status, dependencies, capability availability, approval state, budgets, loop signals, existing outputs (`isComplete` fast-path).

Not purely derived: consulting node template is fixed in `seed.ts`; audit capability names and loop IDs are listed in planner/gates. No EB Metal / slug special cases in runtime code.

Adding a future capability via registration works for **execution** if a seed/template node references it; it does **not** auto-insert nodes or gate logic without seed/gate updates (Medium).

---

## 4. Capability registry assessment

| Contract field | Status |
|---|---|
| Name / purpose / consumes / produces | Present |
| Version | Added (default `1.0.0`; thin = `0.1.0-thin`) |
| Retry / approval / plannerWeight | Present |
| demoOnly / available | Present |
| Duplicate rejection | **Fixed** — throws |
| Cycle / missing dep detection | **Fixed** — `validateExecutionGraph` on save |
| Output schema validation | Partial (Zod on runtime state; not per-capability outputs) |
| Prerequisites enforced by planner | Graph deps only (descriptor prerequisites documentary) |

Thin adapters are marked `demoOnly: true` and replaceable by swapping the registered handler without controller changes.

---

## 5. State model assessment

Statuses: `pending|ready|running|waiting_approval|passed|failed|skipped|invalidated` (+ run-level statuses).

**Fixed:** transition helpers; stranded `running` recovery; invalidate clears outputs/retries; unknown node IDs throw; graph `revision` monotonic.

**Remaining:** `ready` unused; force-rerun of `passed` nodes still blocked by planner skip (Medium).

---

## 6. Loop safety assessment

Loops are priority/signal boosts, not closed feedback controllers.

**Fixed:** active loops rebuilt from signals each tick (no forever retention); iteration increments only on re-execution after failure/invalidation; maxIterations can bind again.

**Remaining:** no stagnation fingerprint across identical planner decisions (Medium); `maxTicks` is per CLI invocation (documented).

---

## 7. Approval assessment

Mixed policy confirmed: auto through crawl→audits; pause at `strategy.accept`, `prototype.approve`, `pitch.approve`.

**Fixed:** cannot approve before upstream deps pass; binds `graphRevision` + `artifactDigest`; reset invalidates dependent approvals; reject fails gate + invalidates upstream; unknown keys rejected; completed runs cannot approve.

---

## 8. Budget assessment

Tracks wall-clock, invocations, Playwright launches, retries.

**Fixed:** budget check before plan execute; pause with reason.

**Remaining:** tokens unused; wall-clock includes human wait; Playwright metering by capability name heuristic (Medium).

---

## 9. Checkpoint / replay / reset

**Fixed:** checkpoint envelope (`schemaVersion`, `runId`, `graphRevision`); atomic JSON writes; reset clears execution fields + approval invalidation.

**Remaining:** `--reset` does not wipe historical JSONL (by design — history preserved); no formal migration framework beyond Zod literals (Medium).

---

## 10. Concurrency assessment

**Fixed:** per-project `runtime/.run.lock` with stale/pid recovery; sync + async lock helpers; CLI mutating commands take the lock.

Not distributed orchestration — local accidental corruption protection only.

---

## 11. Observability assessment

History: `events.jsonl` + `decisions.jsonl` with runId, node, rationale, candidates.

**Fixed:** corrupt JSONL lines skipped; demoOnly noted on pass events; approval digests logged.

**Remaining:** no redaction pipeline for credentialed URLs; unbounded log growth (Medium/Low).

---

## 12. Thin adapter assessment

| Adapter | Version | Replacement path |
|---|---|---|
| Prototype | `0.1.0-thin` | Register `prototype.generate` v1.0 full Gate 6 generator |
| Browser QA | `0.1.0-thin` | Register full matrix + server lifecycle; require online |
| Pitch | `0.1.0-thin` | Register Gate 9 package generator |

`SITEFORGE_QA_ALLOW_OFFLINE` is **opt-in only** (no CLI default). Offline QA must not be mistaken for production a11y sign-off.

---

## 13. EB Metal validation (post-hardening)

Re-run completed:

1. `run --reset` → auto through crawl/extract/knowledge/audits/strategy  
2. Pause → `strategy.accept`  
3. Prototype + browser QA (offline allowed via explicit env)  
4. Pause → `prototype.approve`  
5. Pitch  
6. Pause → `pitch.approve`  
7. Lessons + improvements → **completed**

No EB Metal-specific runtime branches observed.

---

## 14. Findings by severity

### Critical (fixed)

| ID | Finding | Fix |
|---|---|---|
| C1 | Slug path traversal via `projectDir` | `assertValidProjectSlug` + containment check |

### High (fixed)

| ID | Finding | Fix |
|---|---|---|
| H1 | Stranded `running` after exceptions | try/catch + `recoverStrandedRunningNodes` |
| H2 | Reset kept stale outputs / approvals | clear fields + `invalidateApprovalsForNodes` |
| H3 | Approvals unbound to artifacts | revision + digest binding; early approve blocked |
| H4 | Loop max ineffective | rebuild active loops; count re-exec only |
| H5 | Non-atomic / unlocked writes | atomic rename + `.run.lock` |
| H6 | Offline QA defaulted on | removed CLI default |
| H7 | Quality score inflation (`Math.max` with gate=1) | `Math.min(result, gate)` |

### Medium (documented, not fully fixed)

- Planner/gates still name-coupled to audit capabilities  
- Descriptor prerequisites not enforced independently of graph  
- Token budgets unused; wall-clock includes approval wait  
- Force cannot re-execute passed nodes  
- Thin demo completion still allowed (explicitly for Sprint 3 demo profile)  
- Global platform improvements registry can satisfy cross-project `isComplete`  
- No stagnation fingerprint  

### Low

- Unused `ready` status  
- History rotation absent  
- Naming/docs polish  

---

## 15. Fixes completed

See `reports/sprint-3-runtime-hardening-results.md`.

---

## 16. Remaining technical debt

1. Compile execution graphs from capability manifests (remove hard template coupling)  
2. Per-capability output Zod schemas  
3. Active vs calendar budget clocks  
4. Production profile forbidding `demoOnly` terminal completion  
5. Split analyzer monolith behind true separate audit executors  
6. Artifact content-hash freshness in `isComplete`  

---

## 17. Readiness score

| Dimension | Score |
|---|---|
| Planner correctness | 75 |
| Registry extensibility | 70 |
| State safety | 85 |
| Approvals | 88 |
| Budgets | 65 |
| Concurrency | 80 |
| Observability | 70 |
| Thin boundary clarity | 80 |
| Test depth | 78 |
| **Overall** | **78** |

---

## 18. Go / no-go for next sprint

**GO** — proceed to cross-company normalization and second-company ingestion.

Constraints:

1. Keep thin adapters marked demo; do not treat offline QA as production a11y.  
2. Use `siteforge` runtime (not `project:all`) for orchestration.  
3. Address Medium debt item #1 (graph compilation) before a third+ company wave.  
4. Do not expand product scope inside the runtime core during ingestion sprint.
