# Live Peer Selection — Sprint 6

## Selected manufacturer

| Field | Value |
|---|---|
| Company | **CEMCO** |
| Legal/brand | CEMCO — steel framing, metal lath, specialty products |
| Public domain | `https://cemcosteel.com/` |
| Project slug | `cemco` |
| Category | Cold-formed steel framing manufacturer (actual manufacturer, not distributor) |

## Rationale

CEMCO is a U.S. CFS framing manufacturer with public product taxonomy (load-bearing studs/tracks, ViperStud, shaft wall, joists, firestop, metal lath), technical services, architectural support, product catalogs, evaluation/code reports, sound test reports, typical details/Revit files, a **Submittal Creator**, and a **Product Finder**.

This provides strong overlap with SiteForge canonical concepts (Document Center / Technical Resources, Product Catalog, Submittal Workflow, Product Selector, CAD/BIM, Code Report, Engineering Tables) while introducing brand-specific naming (ViperStud, Sure-Span, FireRip) that challenges alias normalization.

## Expected comparable concepts

- Product Catalog / Product Family / Product Detail  
- Technical Resources / Document Center  
- Submittal Workflow (`/submittal-creator/`)  
- Product Selector (`/product-finder`)  
- CAD/BIM Resource (Revit/typical details)  
- Code Report (evaluation reports)  
- Contact / technical support  

## Expected unique / differentiating signals

- Brand-named systems (ViperStud, Sure-Board, ProX Header)  
- Metal lath product lines  
- Firestop specialty products  
- Project profile marketing (SoFi, LAX) — not a capability mapping target  

## Crawl / access assessment

| Check | Result |
|---|---|
| Public homepage | HTTP 200 |
| robots.txt | Allows site crawl; disallows `/wp/wp-admin/` only |
| Sitemap | `https://cemcosteel.com/sitemap_index.xml` |
| Authentication | Not required for public product/resource pages |
| Cloudflare | Present but did **not** hard-block basic fetches (unlike ClarkDietrich) |

## Alternatives not selected

| Candidate | Why not |
|---|---|
| ClarkDietrich (`clarkdietrich.com`) | Cloudflare WAF hard-blocked automated access — prohibited to bypass |
| MarinoWARE (`marinoware.com`) | Strong candidate; CEMCO offered clearer public submittal creator + resource library links for concept overlap |
| Northline Framing | Synthetic fixture — retained for tests only |

## Risks

- Large WordPress catalog; use conservative `maxCrawlPages`  
- External UL Prospector links are off-host — excluded by approvedHosts  
- Dynamic/JS-heavy pages may under-extract without repair  
- Do not claim complete site coverage  
