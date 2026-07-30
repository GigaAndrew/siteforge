# Live Manufacturer Ingestion

## Create

```bash
npm run project:create -- \
  --name "CEMCO" \
  --url "https://cemcosteel.com/" \
  --slug cemco \
  --industry "Cold-formed steel framing and building products" \
  --max-pages 40 \
  --notes "Live Sprint 6 peer manufacturer for validation cohort. Not synthetic."
```

## Crawl

```bash
npm run project:crawl -- --slug cemco
# or via runtime:
npm run siteforge -- run --slug cemco --mode mixed --max-ticks 20
```

Respect `approvedHosts`, robots.txt, crawl delay, and max pages. Off-host technical portals (e.g. UL Prospector) are excluded.

## Knowledge + normalize

```bash
npm run project:knowledge -- --slug cemco --force
npm run siteforge -- normalize --slug cemco --rebuild
```

## Live cohort default

```bash
npm run siteforge -- benchmark-cohort --live-cohort
npm run siteforge -- benchmark-run --live-cohort --rebuild
```

Synthetic fixtures (notes contain synthetic/fixture or `.example` URL) are excluded from `--live-cohort`.
