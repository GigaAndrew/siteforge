---
name: process-improvement-analysis
description: Maps current business-process friction to proposed digital features with operational benefits, assumptions, and phased implementation for manufacturer websites. Use at Gate 3 or when process-improvement-map.md is missing or incomplete.
---

# Process Improvement Analysis

## Workflow

1. Load audit journeys, audience definitions, and inventory data for the prospect.
2. For each workflow (product selection, engineering lookup, document retrieval, submittal, distributor find, support intake, spec prep, quote/lead): document **current process** from observed site behavior.
3. Identify **friction** with evidence references (observation/inference labels).
4. Name **affected audience** from `strategy/audiences.md`.
5. Describe **proposed future process** enabled by a specific digital feature.
6. State **operational benefit** qualitatively — no invented percentages.
7. List **assumptions**, **data/integration dependencies**, and **recommended phase** (1/2/3).
8. Cross-check that each feature appears in `opportunity-map.md` and `product-roadmap.md`.

## Required outputs

```
projects/<slug>/strategy/process-improvement-map.md
```

Aligns with Gate 3 alongside `opportunity-map.md` and `product-roadmap.md`.

## Prohibitions

- Do not invent ROI, cost savings, or time-reduction metrics without reliable inputs.
- Do not recommend features without tied friction evidence.
- Do not design UI or write prototype copy.
- Do not assume ERP/CRM integrations exist — label as dependencies.
- Do not duplicate UX strategy content — focus on operational process change.
