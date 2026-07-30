# Confidence report — EB Metal US

Generated: 2026-07-30T20:33:38.323Z

## Overall confidence score

`██████████████████░░` 88%

| Component | Score |
|---|---|
| Crawler quality | `█████████████████░░░` 87% |
| Knowledge quality | `█████████████████░░░` 84% |
| Narrative / summary text quality | `██████████████████░░` 90% |
| Avg evidence reliability | `███████████████░░░░░` 76% |
| Evidence completeness | `████████████████████` 100% |

## Entity confidence distribution

| Epistemic class | Count |
|---|---|
| fact | 105 |
| inference | 1 |
| observation | 25 |
| recommendation | 20 |

## Evidence confidence distribution

| Confidence | Count |
|---|---|
| high | 53 |
| medium | 146 |
| low | 4 |

## Lowest-confidence findings

- `ev_f82c2eb579427c34` (reliability 1) No clear first-class limiting-height calculator UX dominant in crawl labels.
- `ev_a0fad283cd197a7b` (reliability 0.6) Theme includes mobile viewport meta; dense homepage content likely stressful on small screens.
- `ev_9575e05d95f80cab` (reliability 0.6) CMS theme + third-party assets; Lighthouse pending.
- `ev_b513ed4ae5b828d2` (reliability 0.6) Revision metadata largely unknown in document inventory.

## Unsupported recommendations

_None — all recommendations carry evidence IDs_

## Recommendation weighted confidence (sample)

| Recommendation | Score | Label |
|---|---|---|
| Gate 4–5 design system. | 0.644 | medium |
| Proposed sitemap in strategy. | 0.42 | low |
| Products catalog module (Gate 6). | 0.42 | low |
| NITROSTUD detail prototype. | 0.42 | low |
| Resources center. | 0.42 | low |
| Document rows with status fields (unknown when missing). | 0.42 | low |
| Limiting-height calculator (conceptual). | 0.4 | low |
| Submittal drawer/sheet. | 0.42 | low |
| Contact workflow page. | 0.42 | low |
| Responsive design-system patterns. | 0.24 | low |
| Accessible component system. | 0.42 | low |
| Lean prototype; production perf backlog. | 0.24 | low |
| Template-level metadata model. | 0.42 | low |
| prototype-copy.md | 0.42 | low |
| Status unknown labels when missing. | 0.24 | low |

## Extraction quality

- Company summary normalize ok: **true**
- Issues: none
- Text normalize log present: true

## Crawler quality

- Attempted 64, succeeded 51, failures 12, live encoding ok 51/51, crawl-time encoding failures 43, canonical duplicates collapsed 430

## Knowledge quality

- Critical issues: 0
- High issues: 0
- See `reports/knowledge-quality-report.md`

## Narrative quality

Homepage-derived summary text is printable and usable.

## Recommendations for improving confidence

1. Re-crawl with Sprint 2 crawler (Playwright `innerText` + text normalize) if summary still fails.
2. Attach DocumentType relationships to reduce orphan medium issues.
3. Deduplicate Page entities via canonical URLs (Sprint 2 crawler collapses www/apex).
4. Raise product inventory precision (exclude event/MSDS page proxies).
5. Add second independent CFS manufacturer before treating candidate patterns as signals.
