# Performance audit — EB Metal US

## Status
- Full Lighthouse CLI scoring is optional in MVP and may be skipped if runtime constraints apply.
- Crawl used Playwright `domcontentloaded` with polite delays; this is not a lab performance score.

## Qualitative indicators
- Theme/CMS assets and third-party fonts/scripts may affect LCP/TBT — verify with Lighthouse on homepage and a product page.

## Confidence
- Low until Lighthouse artifacts are attached under qa/.
