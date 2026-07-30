# Sprint 2 validation summary — eb-metal

Generated: 2026-07-30T19:21:20.199Z

## Improvements implemented

1. **Text normalization** — control/entity cleanup, uncommon-Unicode detection, readable-text salvage, confidence penalty
2. **DOM text extraction** — strip malformed binary tag names; prefer main/content regions
3. **URL canonicalization** — www/apex, https, trailing slash, tracking params, fragment strip
4. **Crawl retries** — timeouts/5xx/429 with backoff; download/robots skips logged
5. **Crawl health report** — classified failures + live post-repair encoding overlay
6. **Forge Reliability** — source class weights; evidence carries `reliabilityScore`; recommendation weighted confidence
7. **Confidence report** — overall scorecard + distributions
8. **Lessons learned** + **platform/improvements** registry
9. **Knowledge metrics** longitudinal JSON

## Validation snapshot (EB Metal)

| Metric | Value |
|---|---|
| Overall confidence | 88% |
| Live page text ok | 51/51 |
| Company summary normalize ok | true |
| Knowledge inspect critical/high | 0/0 |
| Entities / relationships / evidence | 151 / 352 / 203 |
| Permanent crawl failures | 12 (mostly downloads) |
| Candidate patterns | 0 (expected 0 with one company) |

## What improved vs Sprint 1

| Area | Sprint 1 | Sprint 2 |
|---|---|---|
| Homepage summary trust | Binary garbage in company profile | Salvaged readable English; normalize ok |
| Strict inspect | Failed on high encoding issues | Passes (`critical=0`, `high=0`) |
| Duplicate pages | www vs apex entities | Canonical host collapse (title near-dups remain) |
| Crawl failures | Flat error list | Classified health report; downloads not treated as content |
| Evidence trust | Confidence only | Confidence × source reliability |
| Platform learning | Ad hoc | lessons-learned + improvements registry |

## Remaining risks

- Title-based Page near-duplicates remain (same title, distinct URLs / 404 shells)
- Product inventory still noisy (page proxies)
- DocumentType orphan relationship (medium)
- Site injects binary/corrupt bytes into HTML body — salvage works but origin is upstream
- Single-company candidate patterns unavailable (expected)

## Recommended next sprint

1. Title/URL Page dedupe pass + 404 shell filtering
2. Ingest second CFS manufacturer (do not expand UI)
3. Validate candidate-pattern creation across ≥2 companies
4. Optional: pre-discover document MIME types before `page.goto`
