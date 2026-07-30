# SiteForge

Internal platform for converting a public manufacturer website URL into evidence-based audits, digital strategy, original art direction, and interactive pitch prototypes.

This is not a generic AI website builder. Recommendations must solve documented problems. Company facts require source URLs.

## Architecture

- **Next.js App Router** dashboard and prototype routes
- **`projects/<slug>/`** isolated prospect data (JSON + Markdown)
- **Playwright** crawl + screenshots
- **Zod** schemas for stored artifacts
- **Cursor agents / skills / rules** enforce stage gates and specialist roles
- **Forge Core Runtime** (`forge-core/`) graph-driven orchestrator — see [docs/runtime-architecture.md](./docs/runtime-architecture.md)
- CLI scripts under `scripts/` for local pipeline execution

## Installation

```bash
npm install
npx playwright install chromium
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Environment

- Node 20+
- npm
- Network access for crawling public sites
- Chromium via Playwright

## Cursor operating system

See [AGENTS.md](./AGENTS.md).

- Agents: `.cursor/agents/`
- Skills: `.cursor/skills/`
- Rules: `.cursor/rules/`

## Stage gates

1. Source evidence  
2. Audit  
3. Strategy  
4. Art direction  
5. Design system (+ visual QA)  
6. Interactive prototype  
7. Automated QA  
8. Visual critique  
9. Pitch package  

Do not skip gates. Do not build the full prototype before Gate 5 passes.

## Commands

### Forge Core Runtime (preferred)

```bash
npm run siteforge -- run --slug eb-metal --mode mixed
npm run siteforge -- status --slug eb-metal
npm run siteforge -- approve --slug eb-metal --key strategy.accept
npm run siteforge -- resume --slug eb-metal
npm run siteforge -- approve --slug eb-metal --key prototype.approve
npm run siteforge -- resume --slug eb-metal
npm run siteforge -- approve --slug eb-metal --key pitch.approve
npm run siteforge -- resume --slug eb-metal
npm run siteforge -- graph --slug eb-metal
npm run siteforge -- history --slug eb-metal
npm run siteforge -- replay --slug eb-metal
```

Internal dashboard: [/runtime/eb-metal](http://localhost:3000/runtime/eb-metal)

### Legacy capability CLIs

```bash
npm run project:create -- --name "EB Metal US" --url "https://www.ebmetal.us/" --slug "eb-metal" --industry "Cold-formed steel framing"
npm run project:crawl -- --slug eb-metal
npm run project:screenshots -- --slug eb-metal
npm run project:audit -- --slug eb-metal
npm run project:strategy -- --slug eb-metal
npm run project:prototype -- --slug eb-metal
npm run project:qa -- --slug eb-metal
npm run project:all -- --slug eb-metal
```

`project:all` resumes safely and does not erase approved artifacts. Prefer `siteforge run` for orchestrated execution.

## Data storage & traceability

- Crawl: `projects/<slug>/source/`
- Analysis: `projects/<slug>/analysis/`
- Strategy: `projects/<slug>/strategy/`
- Design: `projects/<slug>/design/`
- Facts in `data/*.json` include `sourceUrl` / confidence / kind

## Forge Knowledge

Shared industry intelligence (CLI/files only in MVP):

```bash
npm run project:knowledge -- --slug eb-metal
npm run project:knowledge -- --slug eb-metal --dry-run
npm run knowledge:query -- --company eb-metal
npm run knowledge:query -- --industry "cold-formed steel"
npm run knowledge:query -- --entity-type Calculator
npm run knowledge:query -- --candidate-patterns
npm run knowledge:inspect -- --slug eb-metal
npm run knowledge:inspect -- --slug eb-metal --strict
npm run knowledge:reports -- --slug eb-metal
npm run knowledge:platform-reports -- --slug eb-metal
npm run project:repair-text -- --slug eb-metal
npm run project:repair-text -- --slug eb-metal --all
```

- Project slice: `projects/<slug>/knowledge/`
- Shared store: `knowledge/` (entities, relationships, evidence, patterns, indexes, exports, conflicts, audit)
- Platform reports: `projects/<slug>/reports/` (confidence, crawl-health, lessons-learned, reliability, knowledge-metrics)
- Internal improvements registry: `platform/improvements/`
- Schema version + migrations: `knowledge/schemas/MIGRATIONS.md`
- Candidate patterns require ≥2 independent projects/companies and stay unapproved until human promotion
- Never auto-promote single-company observations to industry conclusions

## Calculator safety

Classifications: conceptual · table-driven · production engineering.

Never invent formulas or engineering values. Conceptual calculators must show:

> Conceptual prototype using demonstration data. Not for engineering, specification, procurement, or construction use.

## Legal / crawl considerations

- Respect `robots.txt`
- Polite delays
- Public pages only
- Stay on approved hosts
- Do not bypass auth/anti-bot
- Summarize content; do not dump copyrighted copy
- Prototype footer disclaimer required

## Add another prospect

1. Create project via dashboard or `project:create`
2. Crawl → screenshots → audit → strategy
3. Pass design-system visual QA
4. Then build prototype routes

## Add a calculator type

1. Extend `data/calculator-requirements.json`
2. Follow `.cursor/skills/engineering-calculator-ux`
3. Classify correctly; add unit tests for deterministic logic

## Add an industry template

Reuse skills (industrial audit, manufacturing art direction, catalog UX). Do not copy another client's `calibration`-style private figures — SiteForge keeps project folders isolated.

## Scripts quality

```bash
npm run typecheck
npm run lint
npm run test
npm run build
```

## Current limitations

- Full Lighthouse pass optional / may be deferred
- Competitor crawl not automatic
- Gate 6 full prototype deferred until Gate 5 visual QA approval
- Conceptual calculator uses demo data only
