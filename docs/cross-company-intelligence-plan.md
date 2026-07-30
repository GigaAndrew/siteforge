# Sprint 4 — Cross-Company Intelligence (Architecture Plan)

## Phase 1 inspection summary

| Area | Current state | Integration point |
|---|---|---|
| KG schema | `lib/schemas/knowledge.ts` v1.0.0 | Unchanged; optional candidate provenance via `normalizationLogic` |
| Entities / evidence / conflicts | Project-scoped IDs; shared store under `knowledge/` | Normalization **references** entity IDs; never merges companies |
| Candidate patterns | `refreshCandidatePatterns()` buckets exact `observationKey` | Extended by `refreshCanonicalCandidatePatterns()` |
| Normalization | Only `normalizeKey()` lexical helper | New `lib/normalization/*` registry + engine |
| Runtime | `forge-core/capabilities/register-all.ts` + seed graph | New capability `normalization.run` / node `n_normalize` |
| EB Metal | Full project under `projects/eb-metal/` | First real company; no special-case code paths |

## Design (no redesign of working systems)

```
knowledge/normalization/concepts.json     ← canonical registry
knowledge/normalization/mappings/<slug>.json
projects/<slug>/knowledge/normalization/  ← project-local mappings + status
lib/normalization/{schemas,registry,match,engine,compare,patterns,seed-peer}
```

Principles enforced:

1. Project isolation — mappings point at source entity IDs; store records untouched aside from candidate pattern rows.
2. Normalize concepts, not source truth — original labels/evidence preserved on each mapping.
3. No fabricated commonality — patterns require ≥2 companies, evidence, successful mapping, no blocking conflicts.
4. Candidates stay unapproved — status remains `candidate_unapproved`.
5. No EB Metal special-casing — peer fixture is `northline-framing`; matching is registry-driven.

## Out of scope

- Benchmark Engine
- Digital Maturity Engine
- Auto-promotion of candidates to accepted platform knowledge
