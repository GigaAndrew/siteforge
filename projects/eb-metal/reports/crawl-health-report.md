# Crawl health report — eb-metal

Generated: 2026-07-30T19:08:31.464Z
Refreshed: 2026-07-30T20:33:38.317Z

| Metric | Value |
|---|---|
| Start URL | https://ebmetal.us/ |
| Preferred host | ebmetal.us |
| Pages attempted | 64 |
| Pages succeeded (canonical) | 51 |
| Retries | 0 |
| Retry successes | 0 |
| Permanent failures | 12 |
| Robots skipped | 0 |
| Document links skipped | 438 |
| Download blocked | 12 |
| Encoding failures (crawl-time) | 43 |
| Encoding failures (live post-repair) | 0 |
| Encoding salvages (live) | 0 |
| Canonical page duplicates collapsed | 430 |
| Queue duplicate URLs skipped | — |

## Permanent failure samples

- `download` https://ebmetal.us/architectural-specifications-2/architectural-specifications-2 — page.goto: Download is starting Call log:   - navigating to "https://ebmetal.us/architectural-specifications-2/architectural-specifications-2", waiting until "d
- `download` https://ebmetal.us/accessories/acier-plat-janvier-2015 — page.goto: Download is starting Call log:   - navigating to "https://ebmetal.us/accessories/acier-plat-janvier-2015", waiting until "domcontentloaded" 
- `download` https://ebmetal.us/accessories/baguette-en-l-pour-isolant-rigide — page.goto: Download is starting Call log:   - navigating to "https://ebmetal.us/accessories/baguette-en-l-pour-isolant-rigide", waiting until "domcontentloaded"
- `download` https://ebmetal.us/accessories/barre-en-z-trouee-janvier-2015 — page.goto: Download is starting Call log:   - navigating to "https://ebmetal.us/accessories/barre-en-z-trouee-janvier-2015", waiting until "domcontentloaded" 
- `download` https://ebmetal.us/accessories/bridging-clip-janvier-2015 — page.goto: Download is starting Call log:   - navigating to "https://ebmetal.us/accessories/bridging-clip-janvier-2015", waiting until "domcontentloaded" 
- `download` https://ebmetal.us/accessories/coin-de-fer-90-degre-janvier-2015 — page.goto: Download is starting Call log:   - navigating to "https://ebmetal.us/accessories/coin-de-fer-90-degre-janvier-2015", waiting until "domcontentloaded"
- `download` https://ebmetal.us/accessories/fourrure-porteuse-janvier-2015_1 — page.goto: Download is starting Call log:   - navigating to "https://ebmetal.us/accessories/fourrure-porteuse-janvier-2015_1", waiting until "domcontentloaded" 
- `download` https://ebmetal.us/accessories/fourrure-porteuse-janvier-2015 — page.goto: Download is starting Call log:   - navigating to "https://ebmetal.us/accessories/fourrure-porteuse-janvier-2015", waiting until "domcontentloaded" 
- `download` https://ebmetal.us/accessories/fourrure-porteuse-g90 — page.goto: Download is starting Call log:   - navigating to "https://ebmetal.us/accessories/fourrure-porteuse-g90", waiting until "domcontentloaded" 
- `download` https://ebmetal.us/accessories/joint-de-controle-093 — page.goto: Download is starting Call log:   - navigating to "https://ebmetal.us/accessories/joint-de-controle-093", waiting until "domcontentloaded" 
- `download` https://ebmetal.us/accessories/sabliere-trouee-janvier-2015 — page.goto: Download is starting Call log:   - navigating to "https://ebmetal.us/accessories/sabliere-trouee-janvier-2015", waiting until "domcontentloaded" 
- `download` https://ebmetal.us/msds/sds-vertical — page.goto: Download is starting Call log:   - navigating to "https://ebmetal.us/msds/sds-vertical", waiting until "domcontentloaded" 

## Notes

- Permanent failures are primarily download navigations (PDFs / CAD) — expected when links are discovered as pages.
- Live encoding metrics reflect `repair-page-text` + salvage normalization after Sprint 2 hardening.
