---
name: public-website-crawl
description: Crawls public manufacturer websites with Playwright, normalizes URLs, stores incremental JSON inventories, and captures responsive screenshots. Use when starting a new prospect, refreshing source evidence, or when Gate 1 crawl artifacts are missing.
---

# Public Website Crawl

## Workflow

1. Read `projects/<slug>/config.json` for `websiteUrl`, `approvedHosts`, `maxCrawlPages`, `crawlDelayMs`.
2. Fetch and respect `robots.txt` for the approved host set.
3. Start BFS crawl from homepage; normalize URLs (strip tracking params, canonicalize www/non-www).
4. Skip login, admin, cart, account, and off-domain pages except external-tool inventory.
5. For each HTML page: extract title, headings, nav, links, forms, tables, images, phones, emails, PDF links, product terms.
6. Write incrementally after each page — do not hold entire corpus in memory until end.
7. Continue after per-page failures; log errors to `source/crawl-errors.json`.
8. Capture screenshots at desktop (1440×1000), tablet (768×1024), mobile (390×844) for key page types.
9. Update `project-status.md` and set stage to `evidence_collected`.

## Required outputs

```
projects/<slug>/source/pages.json
projects/<slug>/source/navigation.json
projects/<slug>/source/documents.json
projects/<slug>/source/forms.json
projects/<slug>/source/tables.json
projects/<slug>/source/images.json
projects/<slug>/source/external-tools.json
projects/<slug>/source/crawl-errors.json
projects/<slug>/screenshots/current/{desktop,tablet,mobile}/
projects/<slug>/screenshots/manifest.json
```

Run via: `npm run project:crawl -- --slug <slug>` then `npm run project:screenshots -- --slug <slug>`.

## Prohibitions

- Do not bypass robots.txt, rate limits, or authentication walls.
- Do not crawl competitor domains unless explicitly configured.
- Do not deep-crawl external tools — inventory URL and label only.
- Do not store full page HTML bodies — extract structured fields only.
- Do not exceed `maxCrawlPages` without orchestrator approval.
