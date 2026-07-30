# Benchmark Definitions

Definitions live under `knowledge/benchmarks/definitions/<id>.json`.

## Seed: `cfs-digital-capability` v1.0.0

Cold-formed steel / adjacent building-product **digital capability** benchmark.

- Status: `accepted` for SiteForge engine use
- **Not** a universal industry standard
- Excludes company size, market share, commercial performance
- Excludes candidate patterns as scoring criteria

## Schema fields

`id`, `name`, `description`, `version`, `industry`, `status`, `scope`, `canonical_concepts`, `dimensions`, `weights`, `eligibility_rules`, `evidence_requirements`, `confidence_rules`, `missing_data_policy`, review metadata, `notes`.

Statuses: `draft` | `candidate` | `reviewed` | `accepted` | `deprecated`.

## CLI

```bash
npm run siteforge -- benchmark-list
npm run siteforge -- benchmark-inspect --benchmark cfs-digital-capability
```
