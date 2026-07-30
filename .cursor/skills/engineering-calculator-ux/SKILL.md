---
name: engineering-calculator-ux
description: Designs safe engineering calculator UX with conceptual/table-driven/production classification, disclaimers, and input validation for manufacturer prototypes. Use when scoping calculators, writing calculator-requirements.json, or implementing calculator routes.
---

# Engineering Calculator UX

## Workflow

1. Identify calculator opportunities from audit (e.g., limiting-height table lookup friction).
2. Classify: **conceptual** (demo data), **table-driven** (verified published tables), **production** (signoff required).
3. Write `calculator-requirements.json`: inputs, outputs, units, validation rules, classification, dependencies.
4. For conceptual: create `calculator-demo-data.json` with `kind: "prototype"` on every record.
5. Design UX: grouped inputs, inline validation, assumptions panel, results table, pass/fail states.
6. Place persistent disclaimer above inputs and below results.
7. Implement logic in `lib/calculators/` with unit tests; components consume JSON data only.
8. Mobile: stack inputs, sticky results summary, readable table scroll.

## Required outputs

```
projects/<slug>/data/calculator-requirements.json
projects/<slug>/data/calculator-demo-data.json
projects/<slug>/analysis/calculator-opportunities.md
lib/calculators/** (deterministic logic)
app/prototype/[projectSlug]/**/limiting-height-calculator/** (Gate 6)
components/calculator/** (Gate 6)
```

## Prohibitions

- Never invent formulas, load values, or height limits.
- Never present conceptual output as code-compliant or approved engineering.
- Never remove disclaimers for aesthetic reasons.
- Never hardcode engineering constants in JSX — use data files.
- Never skip empty, error, and no-match result states.
