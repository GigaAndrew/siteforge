---
name: manufacturing-art-direction
description: Defines industrial, precise, engineered visual direction with design tokens and component principles for manufacturer pitch prototypes. Use at Gate 4 or when prototype aesthetics look generic, startup-like, or copied from the current site theme.
---

# Manufacturing Art Direction

## Workflow

1. Review brand signals from `analysis/source-evidence.md`, screenshots, and product/document context.
2. Define brand personality: industrial, precise, engineered, established, dependable, contemporary, technical.
3. Specify typography (industrial sans + monospace/data face), color strategy, grid, spacing, radius, shadows.
4. Document photography and technical-illustration guidance (mill context, structural drawings, table aesthetics).
5. Write `component-principles.md` for tables, forms, calculators, product cards, document rows, navigation.
6. Build `reference-board.md` with approved precedents — dense engineering doc sites, industrial selectors.
7. Produce machine-readable `design-tokens.json` consumed by `components/prototype/`.
8. List rejected patterns: purple SaaS, cream-serif editorial, luxury fashion, unchanged shadcn defaults.

## Required outputs

```
projects/<slug>/design/art-direction.md
projects/<slug>/design/design-tokens.json
projects/<slug>/design/component-principles.md
projects/<slug>/design/reference-board.md
```

Preview route: `/prototype/<slug>/art-direction`.

## Prohibitions

- Do not merely copy the prospect's current Velvet/theme aesthetics.
- Do not invent brand awards, history, or client logos in visual direction.
- Do not produce prose-only direction without JSON tokens.
- Do not use generic AI gradient palettes or Inter-only startup styling.
- Do not implement full pages — tokens and principles only at this stage.
