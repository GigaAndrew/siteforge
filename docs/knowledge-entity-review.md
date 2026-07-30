# Knowledge entity review (Forge Knowledge MVP)

Review date: 2026-07-30  
Corpus: EB Metal US (`eb-metal`) — 155 entities after first ingestion.

**No schema changes in this pass** unless noted as critical. None were critical.

## Summary judgment

| Area | Verdict |
|---|---|
| Overall model | Usable for second-company ingestion |
| Biggest gap | `UserTask` / `SubmittalWorkflow` / rich `DocumentType` under-extracted |
| Biggest noise risk | `Product` inventory includes many page-title "products" |
| Cross-company normalization | Family terms and document types need shared dictionaries |

## Type-by-type review

### Product family vs product

- **Current:** 10 `ProductFamily`, 33 `Product`
- **Issue:** Too granular / noisy on `Product` — crawl page titles (events, MSDS, accessories) are ingested as products.
- **Family terms** (`stud`, `track`, `nitrostud`, …) are useful but some are generic vocabulary, not formal EB Metal families.
- **Recommendation (later):** Add `productKind: family|sku|page_proxy` property; filter non-product pages in extract. Do not change schema yet.

### Document vs document type

- **Current:** 11 `Document`, 1 `DocumentType` (likely `pdf`)
- **Issue:** DocumentType too broad / underused. Product→document edges (165) fan into few Document nodes (shared PDFs) — good dedup, but type taxonomy missing (limiting-height table, catalog, SDS, etc.).
- **Recommendation:** Expand document-type inference from filename/title heuristics in a future extract pass.

### User task vs workflow

- **Current:** No first-class `UserTask` entities. `SubmittalWorkflow` / `DistributorWorkflow` / `EngineeringWorkflow` largely absent as observed facts.
- **Issue:** Missing for query usefulness (“which tasks are supported?”).
- **Workaround used in demos:** Page proxies + ProcessIssue/UxIssue findings.
- **Recommendation:** Map `strategy/current-journeys.md` / proposed journeys into `UserTask` with epistemic `inference` or `observation`.

### Process issue vs UX issue

- **Current:** 3 `ProcessIssue`, 13 `UxIssue`, plus a11y/SEO/performance singles
- **Issue:** Overlap risk — maturity categories map roughly, but “Calculators” / “Submittal” as process vs UX can duplicate signals under different observationKeys.
- **Verdict:** Acceptable for MVP; normalize observationKey vocabulary before second company to enable fair candidate patterns.

### Digital opportunity vs feature

- **Current:** 19 `DigitalOpportunity` (recommendations); `Feature` entities not emitted
- **Verdict:** Correct separation for now. Opportunities must not be facts. Features can be added when roadmap modules are structured in JSON.

### Calculator vs recommended calculator

- **Current:** 1 `Calculator`, epistemic `recommendation`, `classification: conceptual`
- **Verdict:** Correct. Critical rule is enforced in integrity tests.

### Technical resource vs document

- **Current:** `TechnicalResource` unused; documents cover PDFs/links
- **Verdict:** Slightly duplicative if both exist. Prefer Document + DocumentType until non-file resources (HTML tables, external tools) need a distinct type.

### Website page vs external tool

- **Current:** 51 `Page`; external tools inventoried in crawl JSON but sparsely graphed
- **Issue:** Missing `Integration` / external tool entities for linked calculators/portals.
- **Recommendation:** Promote `source/external-tools.json` into Integration entities on next extract (non-breaking).

## Cross-company normalization risks

1. **Company identity** — legal name vs brand vs domain (`ebmetal.us` vs “EB Metal US”).
2. **Product families** — “stud” vs “Steel Studs” vs manufacturer SKU families.
3. **Observation keys** — maturity category names must stay stable for candidate patterns.
4. **Document types** — file extension alone will not align competitors.

## Missing but valuable (non-blocking)

- `UserTask`
- `SubmittalWorkflow` / `DistributorWorkflow` as observed or recommended
- Richer `DocumentType`
- `Form` entities from `source/forms.json`
- `MarketSegment`

## Difficult to normalize

- Page titles as products
- Audience free-text claims
- Navigation pattern labels (theme strings)

## Critical correctness

None requiring immediate schema change. Conceptual calculator classification is correct. Relationship endpoints resolve.
