---
name: submittal-builder-ux
description: Designs submittal package assembly UX with document selection, package drawer/sheet patterns, and conceptual download flows for manufacturer prototypes. Use when scoping submittal modules, process-improvement maps, or implementing /submittal routes.
---

# Submittal Builder UX

## Workflow

1. Map current submittal friction from audit — manual PDF gathering, version chaos, email back-and-forth.
2. Define item sources: product pages, document center, calculator results — each with add-to-package action.
3. Design package UI: drawer (desktop) / bottom sheet (mobile), named packages (no "Untitled" default).
4. Specify package contents list: product spec sheets, calculations (labeled conceptual), MSDS, details.
5. Blueprint download flow as conceptual PDF/ZIP stub with disclaimer — not production document generation.
6. Include empty package state, remove-item, rename package, and clear-all actions.
7. Document in `strategy/page-blueprints.md` and `process-improvement-map.md`.
8. Implement under `components/submittal/` with data from `projects/<slug>/data/`.

## Required outputs

```
projects/<slug>/strategy/page-blueprints.md (submittal section)
projects/<slug>/strategy/process-improvement-map.md (submittal workflow)
app/prototype/[projectSlug]/submittal/** (Gate 6)
components/submittal/** (Gate 6)
```

## Prohibitions

- Do not generate real submittal PDFs with fabricated engineering values.
- Do not imply manufacturer approval of package contents.
- Do not auto-add documents the user did not select.
- Do not store packages server-side in MVP — client/session state only.
- Do not skip disclaimer that package is a conceptual demo.
