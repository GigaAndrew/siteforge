---
name: industrial-website-audit
description: Produces evidence-based audits of manufacturer websites covering positioning, navigation, product discovery, technical resources, and digital maturity. Use after Gate 1 crawl completes or when audit artifacts are missing for Gate 2.
---

# Industrial Website Audit

## Workflow

1. Load crawl corpus from `projects/<slug>/source/` and evidence JSON from `projects/<slug>/data/`.
2. Detect CMS/framework/stack from public signals (meta tags, asset paths, generator tags).
3. Audit navigation IA, product discovery paths, document/tool findability, forms, and mobile patterns.
4. Run automated checks where practical: axe accessibility, Lighthouse performance, link validation.
5. Score digital maturity (0–10) per category with evidence fields — product data, document management, self-service tools, mobile, SEO, accessibility.
6. Map observed user journeys with friction points (label as observation/inference).
7. Synthesize executive audit linking findings to business impact without inventing ROI.
8. Write all audit markdown and `digital-maturity.json`; update `project-status.md`.

## Required outputs

```
projects/<slug>/analysis/source-evidence.md
projects/<slug>/analysis/technical-audit.md
projects/<slug>/analysis/accessibility-audit.md
projects/<slug>/analysis/seo-audit.md
projects/<slug>/analysis/performance-audit.md
projects/<slug>/analysis/executive-audit.md
projects/<slug>/analysis/digital-maturity.json
projects/<slug>/strategy/current-journeys.md
```

Run via: `npm run project:audit -- --slug <slug>`.

## Prohibitions

- Do not claim internal infrastructure knowledge beyond public observations.
- Do not invent analytics, traffic, or conversion data.
- Do not recommend features without citing observed friction.
- Do not omit unavailable checks — mark them explicitly.
- Do not reproduce large blocks of copyrighted site copy.
