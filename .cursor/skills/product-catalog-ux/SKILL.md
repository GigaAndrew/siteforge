---
name: product-catalog-ux
description: Designs structured product catalog UX with filters, search, product rows/cards, compare, and add-to-project flows for manufacturer prototypes. Use when scoping catalog modules, writing page blueprints, or implementing /products routes.
---

# Product Catalog UX

## Workflow

1. Inventory product families and attributes from `data/product-inventory.json` — note gaps as open questions.
2. Map current discovery friction from `strategy/current-journeys.md` and audit findings.
3. Define catalog index: search, filters (family, gauge, coating, application), result count, sort.
4. Specify product row vs card patterns for desktop and mobile; include compare checkbox and add-to-project action.
5. Blueprint product detail: sourced overview, attributes table, documents, related tools, add-to-submittal.
6. Wire empty states (no results), loading, and filter-clear behavior.
7. Ensure all displayed attributes trace to source URLs or are labeled prototype/demo.
8. Document in `strategy/page-blueprints.md`; implement under `components/catalog/` and prototype routes.

## Required outputs

```
projects/<slug>/strategy/page-blueprints.md (catalog sections)
projects/<slug>/strategy/proposed-journeys.md (product selection journey)
app/prototype/[projectSlug]/products/** (Gate 6)
components/catalog/** (Gate 6)
```

## Prohibitions

- Do not invent product attributes not in inventory or source docs.
- Do not use lorem ipsum or fake SKU codes on final prototype pages.
- Do not build catalog before design-system components exist (Gate 5).
- Do not add e-commerce cart/checkout unless explicitly scoped.
- Do not hide missing data — show "unknown" with source gap note.
