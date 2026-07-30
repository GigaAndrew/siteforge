# SiteForge — Agent Operating System

> **Next.js note:** This is not the Next.js you know. Read `node_modules/next/dist/docs/` before assuming old APIs or conventions.

## Product purpose

SiteForge is an internal platform that accepts a public manufacturer website URL, crawls and inventories the company's digital presence, produces evidence-based audits and strategy, and builds polished interactive pitch prototypes — not generic AI websites.

Each prospect lives under `projects/<slug>/`. Shared platform code reads project data via loaders in `lib/project.ts`. Never hardcode prospect-specific strings in shared logic.

## Accuracy and safety rules

1. **Never invent** company facts, product specs, engineering values, certifications, locations, customers, awards, testimonials, revenue, or performance claims.
2. **Every company-specific factual statement** must cite a captured source URL from the crawl corpus.
3. **Label all content** with one of: **fact** (directly observed on source), **observation** (audit finding tied to evidence), **inference** (reasoned conclusion — mark confidence), **recommendation** (proposed action), **prototype** (conceptual demo — not production truth).
4. Store source URLs alongside extracted JSON. Mark uncertain or incomplete findings explicitly.
5. Respect `robots.txt`, use polite crawl delays, crawl public pages only, stay on approved domains.
6. Do not bypass authentication, anti-bot, or access controls. Summarize public content; do not reproduce large copyrighted copy blocks.
7. **Calculator safety:** classify as conceptual (demo data), table-driven (verified published data), or production (manufacturer signoff). Never present conceptual results as approved engineering output.
8. Do not fabricate ROI, implementation cost, or numeric operational benefits without reliable inputs.

## Overwrite policy

Do **not** overwrite artifacts approved at a prior gate without documenting the reason in `projects/<slug>/project-status.md` under **Required revisions** or a **Session note**. Prefer additive edits. When revising, preserve source traceability.

## Configuration locations

| Resource | Path |
|---|---|
| Specialized agents | [`.cursor/agents/`](.cursor/agents/) |
| Reusable skills | [`.cursor/skills/`](.cursor/skills/) |
| Persistent rules | [`.cursor/rules/`](.cursor/rules/) |

## 12 specialized agents — when to delegate

| Agent | Delegate when |
|---|---|
| **orchestrator** | Managing workflow, gate enforcement, status tracking, revision loops, artifact verification — not specialist analysis |
| **research-evidence** | Crawl review, company/product/document inventory, source traceability, confidence ratings |
| **forge-knowledge** | Ingest project artifacts into shared Forge Knowledge graph; provenance, conflicts, candidate patterns, queries |
| **technical-audit** | Tech stack detection, performance, accessibility, SEO, forms, broken links, digital-maturity scoring |
| **ux-strategy** | Audiences, journeys, IA, sitemap, page blueprints, task-oriented UX problems |
| **process-improvement** | Business-process friction mapping, operational benefits, phase recommendations |
| **product-strategy** | Opportunity map, phased roadmap, module scoping and dependencies |
| **brand-art-direction** | Visual direction, tokens, component principles, reference board, industrial brand personality |
| **editorial-design** | Prototype copy, labels, CTAs, disclaimers — no fabricated claims |
| **ui-systems** | Reusable component library and design-system route before full pages |
| **calculator-data** | Calculator opportunities, requirements, demo data, safe prototype logic |
| **frontend-implementation** | Building approved prototype routes after Gate 5 passes — no redesign during build |
| **visual-qa** | Browser-based visual critique at required viewports — independent of implementing agent |

The orchestrator must not perform specialist work when a dedicated agent exists.

## 8 skills

| Skill | Use for |
|---|---|
| **public-website-crawl** | Playwright crawl, URL normalization, incremental JSON storage, screenshots |
| **industrial-website-audit** | Manufacturer positioning, product discovery, technical resources, maturity scoring |
| **manufacturing-art-direction** | Industrial/precise/engineered visual direction; reject generic AI aesthetics |
| **product-catalog-ux** | Structured catalog, filters, product rows/cards, compare workflows |
| **engineering-calculator-ux** | Limiting-height and similar calculator UX with safety classification |
| **submittal-builder-ux** | Package assembly, drawer/sheet patterns, document selection |
| **process-improvement-analysis** | Current vs future process maps tied to digital features |
| **visual-qa** | Screenshot-based critique, severity triage, resolution tracking |
| **forge-knowledge-extract** | Knowledge ingestion, dedup/conflicts, candidate-pattern safeguards |

## Forge Knowledge (post–Gate 2 hook)

Not a separate pitch gate. After inventories + audit exist, run:

```bash
npm run project:knowledge -- --slug <slug>
```

Writes `projects/<slug>/knowledge/*` and merges into shared `knowledge/`.  
Candidate patterns may auto-create when the same normalized observation appears in ≥2 independent projects/companies — always labeled **unapproved**. Human approval required before promotion. Conflicts block auto-promotion.

## 9-gate review process

Gates are sequential. The orchestrator verifies required artifacts exist before advancing. Record approved gates in `projects/<slug>/project-status.md`.

### Gate 1 — Source evidence (`gate_1_source_evidence`)

**Required artifacts:**
- `source/pages.json`, `source/navigation.json`, `source/documents.json`, `source/forms.json`, `source/tables.json`, `source/images.json`, `source/external-tools.json`, `source/crawl-errors.json`
- `screenshots/current/{desktop,tablet,mobile}/` + `screenshots/manifest.json`
- `data/company-profile.json`, `data/product-inventory.json`, `data/document-inventory.json`
- `analysis/source-evidence.md`

### Gate 2 — Audit (`gate_2_audit`)

**Required artifacts:**
- `analysis/executive-audit.md`, `analysis/technical-audit.md`, `analysis/accessibility-audit.md`, `analysis/seo-audit.md`, `analysis/performance-audit.md`
- `analysis/digital-maturity.json`
- `strategy/current-journeys.md`

**Recommended follow-up (Forge Knowledge):**
- `npm run project:knowledge -- --slug <slug>`
- `projects/<slug>/knowledge/extract-manifest.json`
- Shared store under `knowledge/` (CLI/files only in MVP — no dashboard UI)

### Gate 3 — Strategy (`gate_3_strategy`)

**Required artifacts:**
- `strategy/audiences.md`, `strategy/proposed-sitemap.md`, `strategy/proposed-journeys.md`, `strategy/page-blueprints.md`
- `strategy/process-improvement-map.md`, `strategy/opportunity-map.md`, `strategy/product-roadmap.md`

### Gate 4 — Art direction (`gate_4_art_direction`)

**Required artifacts:**
- `design/art-direction.md`, `design/design-tokens.json`, `design/component-principles.md`, `design/reference-board.md`, `design/prototype-copy.md`
- Art-direction preview route: `/prototype/<slug>/art-direction`

### Gate 5 — Design system (`gate_5_design_system`)

**Required artifacts:**
- Reusable components under `components/prototype/`
- Design-system route: `/prototype/<slug>/design-system`
- `qa/visual-qa.md` (design-system review) with critical/high findings resolved
- Design-system screenshots at review viewports

Do not proceed to Gate 6 if the system looks generic or uses unchanged library defaults.

### Gate 6 — Interactive prototype (`gate_6_interactive_prototype`)

**Required artifacts:**
- Prototype routes under `app/prototype/[projectSlug]/` (home, products, product detail, engineering, calculator, resources, submittal, distributors, contact)
- Page components under `components/prototype/`, data from `projects/<slug>/data/`
- Responsive behavior and semantic HTML

Build only after Gates 1–5 pass.

### Gate 7 — Automated QA (`gate_7_automated_qa`)

**Required artifacts:**
- `qa/automated-qa.md` (typecheck, lint, unit tests, a11y checks, broken links, responsive screenshots, Lighthouse where practical)

### Gate 8 — Visual critique (`gate_8_visual_critique`)

**Required artifacts:**
- `qa/visual-qa.md` covering all primary prototype pages at 1440×1000, 1280×800, 768×1024, 390×844
- Critical and high-severity findings fixed; post-fix screenshots captured
- Independent review — no agent approves its own work

### Gate 9 — Pitch package (`gate_9_pitch_package`)

**Required artifacts:**
- `reports/executive-summary.md`, `reports/current-state-audit.md`, `reports/opportunity-summary.md`
- `reports/prototype-walkthrough.md`, `reports/process-improvement-summary.md`
- `reports/implementation-roadmap.md`, `reports/assumptions-and-risks.md`, `reports/pitch-narrative.md`

No fabricated cost or ROI. Use placeholder frameworks with labeled assumptions.

## CLI commands

```bash
npm run project:create -- --name "Company" --url "https://example.com" --slug "company"
npm run project:crawl -- --slug <slug>
npm run project:screenshots -- --slug <slug>
npm run project:audit -- --slug <slug>
npm run project:strategy -- --slug <slug>
npm run project:prototype -- --slug <slug>
npm run project:qa -- --slug <slug>
npm run project:all -- --slug <slug>
```

Scripts resume safely, write incrementally, and update `project-status.md`.
