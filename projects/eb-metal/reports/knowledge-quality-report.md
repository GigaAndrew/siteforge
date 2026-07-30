# Knowledge quality report — eb-metal

Generated: 2026-07-30T19:21:20.159Z  
Schema version: 1.0.0

## Totals

| Metric | Count |
|---|---|
| Entities | 151 |
| Relationships | 352 |
| Evidence | 203 |
| Conflicts | 0 |
| Candidate patterns | 0 |
| Stale evidence | 0 |
| Critical issues | 0 |
| High issues | 0 |

## Entities by type

| Type | Count |
|---|---|
| Page | 51 |
| Product | 33 |
| DigitalOpportunity | 19 |
| Document | 13 |
| UxIssue | 13 |
| ProductFamily | 4 |
| Technology | 4 |
| ProcessIssue | 3 |
| Company | 1 |
| Industry | 1 |
| Website | 1 |
| Audience | 1 |
| DocumentType | 1 |
| CMS | 1 |
| AccessibilityIssue | 1 |
| PerformanceIssue | 1 |
| SeoIssue | 1 |
| Calculator | 1 |
| NavigationPattern | 1 |

## Relationships by type

| Type | Count |
|---|---|
| PRODUCT_HAS_DOCUMENT | 167 |
| PAGE_LINKS_TO_DOCUMENT | 60 |
| WEBSITE_CONTAINS_PAGE | 51 |
| PRODUCT_BELONGS_TO_FAMILY | 19 |
| COMPANY_HAS_DIGITAL_OPPORTUNITY | 19 |
| PAGE_EXHIBITS_UX_ISSUE | 13 |
| WEBSITE_USES_TECHNOLOGY | 5 |
| COMPANY_OFFERS_PRODUCT_FAMILY | 4 |
| COMPANY_HAS_PROCESS_ISSUE | 3 |
| PROCESS_ISSUE_CREATES_OPPORTUNITY | 3 |
| COMPANY_OPERATES_IN_INDUSTRY | 1 |
| COMPANY_HAS_WEBSITE | 1 |
| COMPANY_SERVES_AUDIENCE | 1 |
| PAGE_EXHIBITS_ACCESSIBILITY_ISSUE | 1 |
| WEBSITE_HAS_PERFORMANCE_ISSUE | 1 |
| PAGE_EXHIBITS_SEO_ISSUE | 1 |
| COMPANY_PROVIDES_CALCULATOR | 1 |
| COMPANY_EXHIBITS_NAVIGATION_PATTERN | 1 |

## Evidence by confidence

| Confidence | Count |
|---|---|
| high | 53 |
| medium | 146 |
| low | 4 |

## Evidence by review status

| Status | Count |
|---|---|
| unreviewed | 203 |

## Visibility classifications

| Visibility | Count |
|---|---|
| shared_unreviewed | 151 |

## Epistemic classes

| Class | Count |
|---|---|
| fact | 105 |
| inference | 1 |
| observation | 25 |
| recommendation | 20 |

## Evidence by source page (top 25)

| Source URL | Evidence count |
|---|---|
| https://ebmetal.us/ | 36 |
| https://ebmetal.us/eb-metal-golf-outing-2024 | 17 |
| https://ebmetal.us/catalog | 15 |
| https://ebmetal.us/material-safety-data-sheet | 15 |
| https://ebmetal.us/ul-test-results | 15 |
| https://ebmetal.us/accessories | 15 |
| https://www.ebmetal.us/ | 11 |
| https://ebmetal.us/home | 2 |
| https://ebmetal.us/information-generale-des-produits | 2 |
| https://ebmetal.us/interior-framing-3 | 2 |
| https://ebmetal.us/interior-framing-2-2 | 2 |
| https://ebmetal.us/shaft-wall-systems-2 | 2 |
| https://ebmetal.us/shaft-wall-systems | 2 |
| https://ebmetal.us/architectural-specifications-2 | 2 |
| https://ebmetal.us/architectural-specifications | 2 |
| https://ebmetal.us/fasteners-screws-and-welds | 2 |
| https://ebmetal.us/typical-wall-and-ceiling-details | 2 |
| https://ebmetal.us/hat-furring-channel-ceiling-spans | 2 |
| https://ebmetal.us/u-channel-ceiling-spans | 2 |
| https://ebmetal.us/brochures | 2 |
| https://ebmetal.us/accessories-2 | 2 |
| https://ebmetal.us/leeds-forms-2 | 2 |
| https://ebmetal.us/leeds-form-nh | 2 |
| https://ebmetal.us/msds | 2 |
| https://ebmetal.us/leeds-form-al | 2 |

## Issues

### orphan-ent-ent_DocumentType_6a74daf6a0617051
- **Severity:** medium
- **Category:** orphan_entities
- **Problem:** Entity DocumentType "pdf" has no relationships
- **Recommended correction:** Attach via extract rules or remove unused entity.
- **Entities:** ent_DocumentType_6a74daf6a0617051

### near-dup-page-home-metal-framing-manufacturer-eb-
- **Severity:** medium
- **Category:** near_duplicates
- **Problem:** Near-duplicate entities for Page:home-metal-framing-manufacturer-eb-metal (2 ids)
- **Recommended correction:** Tighten normalization keys / merge on ingest for cross-page duplicates.
- **Entities:** ent_Page_78008e86f944c338, ent_Page_b695a962fca42c4c

### near-dup-page-accessories-metal-framing-manufactu
- **Severity:** medium
- **Category:** near_duplicates
- **Problem:** Near-duplicate entities for Page:accessories-metal-framing-manufacturer-eb-metal (2 ids)
- **Recommended correction:** Tighten normalization keys / merge on ingest for cross-page duplicates.
- **Entities:** ent_Page_69bdee936569c578, ent_Page_6440b303c1a700b9

### near-dup-page-interior-framing-metal-framing-manu
- **Severity:** medium
- **Category:** near_duplicates
- **Problem:** Near-duplicate entities for Page:interior-framing-metal-framing-manufacturer-eb-metal (3 ids)
- **Recommended correction:** Tighten normalization keys / merge on ingest for cross-page duplicates.
- **Entities:** ent_Page_a171458a61e78396, ent_Page_0beb783f950fd186, ent_Page_277379a8700b75c4

### near-dup-page-architectural-specifications-metal-
- **Severity:** medium
- **Category:** near_duplicates
- **Problem:** Near-duplicate entities for Page:architectural-specifications-metal-framing-manufacturer-eb-metal (2 ids)
- **Recommended correction:** Tighten normalization keys / merge on ingest for cross-page duplicates.
- **Entities:** ent_Page_41c98dda404f5bc2, ent_Page_b75a24b1c044158a

### near-dup-page-exterior-framing-metal-framing-manu
- **Severity:** medium
- **Category:** near_duplicates
- **Problem:** Near-duplicate entities for Page:exterior-framing-metal-framing-manufacturer-eb-metal (2 ids)
- **Recommended correction:** Tighten normalization keys / merge on ingest for cross-page duplicates.
- **Entities:** ent_Page_b84a25f799e672a6, ent_Page_484c87c5687a7718

### near-dup-page-page-not-found-metal-framing-manufa
- **Severity:** medium
- **Category:** near_duplicates
- **Problem:** Near-duplicate entities for Page:page-not-found-metal-framing-manufacturer-eb-metal (3 ids)
- **Recommended correction:** Tighten normalization keys / merge on ingest for cross-page duplicates.
- **Entities:** ent_Page_c7620664a9d1c710, ent_Page_4054fbf2fc8e6b49, ent_Page_43e0559a3273f238

### low-confidence-summary
- **Severity:** low
- **Category:** low_confidence
- **Problem:** 4 evidence records have low confidence
- **Recommended correction:** Manual review before using in pitch claims.
- **Evidence:** ev_f82c2eb579427c34, ev_a0fad283cd197a7b, ev_9575e05d95f80cab, ev_b513ed4ae5b828d2

### crawl-url-failures
- **Severity:** medium
- **Category:** source_url_failures
- **Problem:** 12 crawl URL failures/redirects/downloads recorded
- **Recommended correction:** Treat failed URLs as incomplete evidence; do not elevate related facts to high confidence.


## Export paths

- `knowledge/exports/entities-2026-07-30T18-42-08-171Z.jsonl`
- `knowledge/exports/entities-2026-07-30T18-42-08-245Z.jsonl`
- `knowledge/exports/entities-2026-07-30T18-43-21-171Z.jsonl`
- `knowledge/exports/entities-2026-07-30T18-43-21-222Z.jsonl`
- `knowledge/exports/entities-2026-07-30T18-43-36-326Z.jsonl`
- `knowledge/exports/entities-2026-07-30T18-43-36-383Z.jsonl`
- `knowledge/exports/entities-2026-07-30T19-08-40-669Z.jsonl`
- `knowledge/exports/entities-2026-07-30T19-08-40-741Z.jsonl`
- `knowledge/exports/entities-2026-07-30T19-13-27-789Z.jsonl`
- `knowledge/exports/entities-2026-07-30T19-13-27-856Z.jsonl`
- `knowledge/exports/entities-2026-07-30T19-20-20-773Z.jsonl`
- `knowledge/exports/entities-2026-07-30T19-20-20-826Z.jsonl`
- `knowledge/exports/evidence-2026-07-30T18-42-08-171Z.jsonl`
- `knowledge/exports/evidence-2026-07-30T18-42-08-245Z.jsonl`
- `knowledge/exports/evidence-2026-07-30T18-43-21-171Z.jsonl`
- `knowledge/exports/evidence-2026-07-30T18-43-21-222Z.jsonl`
- `knowledge/exports/evidence-2026-07-30T18-43-36-326Z.jsonl`
- `knowledge/exports/evidence-2026-07-30T18-43-36-383Z.jsonl`
- `knowledge/exports/evidence-2026-07-30T19-08-40-669Z.jsonl`
- `knowledge/exports/evidence-2026-07-30T19-08-40-741Z.jsonl`
- `knowledge/exports/evidence-2026-07-30T19-13-27-789Z.jsonl`
- `knowledge/exports/evidence-2026-07-30T19-13-27-856Z.jsonl`
- `knowledge/exports/evidence-2026-07-30T19-20-20-773Z.jsonl`
- `knowledge/exports/evidence-2026-07-30T19-20-20-826Z.jsonl`
- `knowledge/exports/latest.json`
- `knowledge/exports/relationships-2026-07-30T18-42-08-171Z.jsonl`
- `knowledge/exports/relationships-2026-07-30T18-42-08-245Z.jsonl`
- `knowledge/exports/relationships-2026-07-30T18-43-21-171Z.jsonl`
- `knowledge/exports/relationships-2026-07-30T18-43-21-222Z.jsonl`
- `knowledge/exports/relationships-2026-07-30T18-43-36-326Z.jsonl`
- `knowledge/exports/relationships-2026-07-30T18-43-36-383Z.jsonl`
- `knowledge/exports/relationships-2026-07-30T19-08-40-669Z.jsonl`
- `knowledge/exports/relationships-2026-07-30T19-08-40-741Z.jsonl`
- `knowledge/exports/relationships-2026-07-30T19-13-27-789Z.jsonl`
- `knowledge/exports/relationships-2026-07-30T19-13-27-856Z.jsonl`
- `knowledge/exports/relationships-2026-07-30T19-20-20-773Z.jsonl`
- `knowledge/exports/relationships-2026-07-30T19-20-20-826Z.jsonl`
- `knowledge/exports/snapshot-2026-07-30T18-42-08-171Z.json`
- `knowledge/exports/snapshot-2026-07-30T18-42-08-245Z.json`
- `knowledge/exports/snapshot-2026-07-30T18-43-21-171Z.json`
- `knowledge/exports/snapshot-2026-07-30T18-43-21-222Z.json`
- `knowledge/exports/snapshot-2026-07-30T18-43-36-326Z.json`
- `knowledge/exports/snapshot-2026-07-30T18-43-36-383Z.json`
- `knowledge/exports/snapshot-2026-07-30T19-08-40-669Z.json`
- `knowledge/exports/snapshot-2026-07-30T19-08-40-741Z.json`
- `knowledge/exports/snapshot-2026-07-30T19-13-27-789Z.json`
- `knowledge/exports/snapshot-2026-07-30T19-13-27-856Z.json`
- `knowledge/exports/snapshot-2026-07-30T19-20-20-773Z.json`
- `knowledge/exports/snapshot-2026-07-30T19-20-20-826Z.json`

## Readiness notes

- Candidate patterns are expected to be **0** until a second independent company is ingested.
- All factual entities should retain evidence IDs before pitch use.
- Re-run `npm run knowledge:inspect -- --slug eb-metal --strict` after corrections.
