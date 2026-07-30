# Lessons learned — eb-metal

Generated: 2026-07-30T20:33:38.330Z

| Area | Lesson | Severity | Frequency | Recommended action | Affects future projects |
|---|---|---|---|---|---|
| Extraction | Cheerio body text can surface non-printable/compressed-looking content; prefer Playwright innerText + normalizeExtractedText before inventories. | high | observed on first EB Metal homepage summary | Keep dual-path extraction; fail closed on low printable ratio. | yes |
| Crawler | www vs apex and tracking params created duplicate Page entities and inflated near-dup metrics. | medium | multiple page pairs in Sprint 1 graph | Always canonicalize with preferredHost before seen-set and entity IDs. | yes |
| Crawler | PDF/download navigations appear as failures; classify and skip document hrefs rather than counting as content failures. | medium | 12 download blocks / 12 failures | Maintain document skip + health report categories. | yes |
| Knowledge | Homepage-backed claims need lower reliability weight than engineering tables/product sheets. | medium | systemic | Forge Reliability defaults; inherit into recommendation confidence. | yes |
| Knowledge | DocumentType and CMS entities were created without relationships (orphan medium issues). | low | 2 orphan types in inspect | Emit HAS_TYPE / USES_CMS relationships in extract. | yes |
| Product taxonomy | Page-title products (events, MSDS) pollute Product entities. | medium | ongoing in product-inventory | Add productKind filter in analyzer before knowledge ingest. | yes |
| UX / Design | Gate discipline (design-system before full prototype) prevented generic AI UI — keep as platform rule. | info | process | Retain Gate 5 stop condition in orchestrator. | yes |
| Process | Strict inspect failing on high extraction issues is desirable — blocks false confidence. | info | each inspect --strict | Keep --strict in second-company checklist. | yes |
| Graph schema | UserTask / SubmittalWorkflow under-extracted; not blocking but limits query demos. | low | query demonstration gaps | Map journeys markdown into UserTask inferences in a later sprint. | yes |
| Automation | Report generation should be one command after crawl/audit/knowledge. | low | ops | `npm run knowledge:platform-reports` (this script). | yes |

## Potential new graph entity types

- UserTask (from journeys)
- Form (from source/forms.json)
- Integration (from external-tools.json)

## Potential normalization improvements

- Shared CFS product-family dictionary
- Semantic document-type classifier beyond file extension

## Potential automation opportunities

- Auto-run platform reports at end of `project:all`
- Fail CI on `knowledge:inspect --strict` for release branches
