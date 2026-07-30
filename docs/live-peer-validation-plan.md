# Sprint 6 — Live Peer Validation (Architecture Plan)

## Baseline

SiteForge `v0.4.0` provides crawl, KG, normalization, comparison, Benchmark Engine, approvals, and reports. Sprint 6 replaces the synthetic peer as the **primary** validation cohort with a live public manufacturer and adds practical human review records.

## Integration points

| System | Reuse |
|---|---|
| Project create | `npm run project:create` |
| Runtime crawl/extract/knowledge | `siteforge run` → `n_crawl` … `n_normalize` / `n_benchmark` |
| Normalization review | Extend `confirmMapping` with reject/unresolve + status filters |
| Comparison | `compareProjects` / `benchmark-compare` |
| Benchmark approvals | `recordApproval` / `requiredApprovalsForPublish` |
| Synthetic detection | `isSyntheticFixture` (notes/fixture URL) |

## Manufacturer selection criteria

Actual manufacturer; public technical content; overlap with CFS capabilities; crawlable without auth or control bypass; robots-respecting.

**Selected:** CEMCO (`cemcosteel.com`) — see `reports/live-peer-selection.md`.

## Review workflow

1. Normalize live project  
2. List unresolved mappings (`ambiguous` / below-threshold / unmapped)  
3. Human accept/reject/leave unresolved with rationale + digest  
4. Generate benchmark observations  
5. Optional observation review / override with audit trail  
6. Re-run live cohort benchmark  
7. Satisfy definition/observation review gates only with real review records  
8. Keep `benchmark.publish` unsatisfied unless all conditions genuinely pass  

## Synthetic fixture disposition

Retain `northline-framing` for deterministic tests/fixtures only. Live cohort defaults exclude synthetic projects. Reports must label any synthetic inclusion.

## Validation strategy

Crawl CEMCO → normalize → review sample → compare with EB Metal → benchmark live pair → approval binding tests → full suite.

## Rollback / rebuild

`normalize --rebuild`, `benchmark-rebuild`, runtime `--reset` / `reset-node`. Mapping and evidence digests invalidate approvals.
