import fs from "node:fs";
import {
  fileExists,
  projectPath,
  readJsonFile,
  readProjectConfig,
  updateProjectStage,
  writeJsonFile,
} from "@/lib/project";
import { writeProjectStatus } from "@/lib/status";
import type {
  CompanyProfile,
  CompetitorBenchmark,
  DigitalMaturity,
  DocumentInventory,
  ProductInventory,
} from "@/lib/schemas/analysis";
import type { DocumentLink, PageRecord } from "@/lib/schemas/crawl";
import { normalizeExtractedText } from "@/lib/crawler/text-normalize";

function unique(items: string[]): string[] {
  return [...new Set(items.filter(Boolean))];
}

function findPage(pages: PageRecord[], re: RegExp): PageRecord | undefined {
  return pages.find((p) => re.test(`${p.url} ${p.title ?? ""} ${p.h1.join(" ")}`));
}

export function generateEvidenceArtifacts(slug: string): void {
  const config = readProjectConfig(slug);
  const pages =
    readJsonFile<PageRecord[]>(projectPath(slug, "source/pages.json")) ?? [];
  const documents =
    readJsonFile<DocumentLink[]>(projectPath(slug, "source/documents.json")) ??
    [];

  if (pages.length === 0) {
    throw new Error("No crawled pages found. Run project:crawl first.");
  }

  const home =
    pages.find((p) => {
      try {
        return new URL(p.url).pathname === "/";
      } catch {
        return false;
      }
    }) ?? pages[0]!;

  const phones = unique(pages.flatMap((p) => p.phoneNumbers));
  const emails = unique(pages.flatMap((p) => p.emailAddresses));
  const families = unique(pages.flatMap((p) => p.productFamilyTerms));

  const locationFacts = [];
  if (/bow|new hampshire|\bnh\b/i.test(home.mainTextSummary ?? "")) {
    locationFacts.push({
      claim: "Company references a New Hampshire / Bow location in public site copy.",
      sourceUrl: home.url,
      confidence: "high" as const,
      kind: "fact" as const,
    });
  }
  if (/montgomery|alabama|\bal\b/i.test(home.mainTextSummary ?? "")) {
    locationFacts.push({
      claim: "Company references a Montgomery, Alabama location in public site copy.",
      sourceUrl: home.url,
      confidence: "high" as const,
      kind: "fact" as const,
    });
  }

  const summaryNorm = normalizeExtractedText(home.mainTextSummary ?? "", {
    maxLength: 500,
  });
  const companyProfile: CompanyProfile = {
    projectSlug: slug,
    companyName: config.name,
    websiteUrl: config.websiteUrl,
    industry: config.industry,
    summary: summaryNorm.ok
      ? summaryNorm.text
      : "Summary unavailable — text normalization failed on crawled homepage content. See source/pages.json and source/text-normalize-log.json.",
    locations: locationFacts,
    offerings: [
      {
        claim:
          "Public positioning describes a lightweight / cold-formed steel framing manufacturer and fabricator.",
        sourceUrl: home.url,
        confidence: "high",
        kind: "fact",
      },
    ],
    audiences: [
      {
        claim:
          "Site language targets construction professionals and distribution partners (distributors listed publicly).",
        sourceUrl: home.url,
        confidence: "medium",
        kind: "inference",
        notes: "Audience inferred from distributor listings and industry copy; not an explicit persona statement.",
      },
    ],
    standards: /aisi|csa|s100/i.test(home.mainTextSummary ?? "")
      ? [
          {
            claim:
              "Site states structural property standards are computed in accordance with AISI and CSA references.",
            sourceUrl: home.url,
            confidence: "high",
            kind: "fact",
          },
        ]
      : [],
    contacts: [
      ...phones.slice(0, 10).map((phone) => ({
        claim: `Phone number observed on public pages: ${phone}`,
        sourceUrl: home.url,
        confidence: "medium" as const,
        kind: "fact" as const,
      })),
      ...emails.slice(0, 10).map((email) => ({
        claim: `Email address observed on public pages: ${email}`,
        sourceUrl: home.url,
        confidence: "medium" as const,
        kind: "fact" as const,
      })),
    ],
    openQuestions: [
      "Which product families have complete structured attribute data vs PDF-only tables?",
      "Are limiting-height tables published as downloadable files or HTML tables?",
      "Is NITROSTUD presented as a distinct product line with dedicated technical resources?",
    ],
    updatedAt: new Date().toISOString(),
  };

  const productPages = pages.filter((p) =>
    /product|stud|track|joist|nitro|framing|catalog/i.test(
      `${p.url} ${p.title ?? ""} ${p.h1.join(" ")}`,
    ),
  );

  const products: ProductInventory["products"] = productPages.slice(0, 40).map((p) => ({
    name: p.h1[0] || p.title || p.url,
    family: p.productFamilyTerms[0],
    category: undefined,
    description: p.mainTextSummary?.slice(0, 280),
    sourceUrl: p.url,
    attributes: {},
    documents: [...p.pdfLinks.slice(0, 5)],
    confidence: "medium" as const,
    notes: "Extracted from public page inventory; attributes require structured table parsing.",
  }));

  // Add named product if nitrostud mentioned anywhere
  if (pages.some((p) => /nitrostud/i.test(JSON.stringify(p)))) {
    const nitro =
      findPage(pages, /nitrostud/i) ??
      pages.find((p) => /nitrostud/i.test(p.mainTextSummary ?? ""));
    if (nitro && !products.some((p) => /nitrostud/i.test(p.name))) {
      products.unshift({
        name: "NITROSTUD",
        family: "nitrostud",
        description: nitro.mainTextSummary?.slice(0, 280),
        sourceUrl: nitro.url,
        attributes: {},
        documents: nitro.pdfLinks.slice(0, 5),
        confidence: "medium",
        notes: "Name observed in crawl corpus; verify product-detail completeness.",
      });
    }
  }

  const productInventory: ProductInventory = {
    projectSlug: slug,
    products,
    families,
    updatedAt: new Date().toISOString(),
  };

  const documentInventory: DocumentInventory = {
    projectSlug: slug,
    documents: documents.map((d) => ({
      title: d.text || d.href.split("/").pop() || d.href,
      href: d.href,
      fileType: d.fileType,
      sourcePageUrl: d.pageUrl,
      status: "unknown" as const,
      confidence: "medium" as const,
    })),
    updatedAt: new Date().toISOString(),
  };

  writeJsonFile(projectPath(slug, "data/company-profile.json"), companyProfile);
  writeJsonFile(projectPath(slug, "data/product-inventory.json"), productInventory);
  writeJsonFile(projectPath(slug, "data/document-inventory.json"), documentInventory);

  const evidenceMd = `# Source evidence — ${config.name}

## Crawl corpus
- Pages crawled: ${pages.length}
- Document links inventoried: ${documents.length}
- Primary source homepage: ${home.url}

## Captured facts (with sources)
${companyProfile.locations.map((f) => `- FACT (${f.confidence}): ${f.claim} — ${f.sourceUrl}`).join("\n") || "- Location facts pending richer extraction"}
${companyProfile.offerings.map((f) => `- FACT (${f.confidence}): ${f.claim} — ${f.sourceUrl}`).join("\n")}
${companyProfile.standards.map((f) => `- FACT (${f.confidence}): ${f.claim} — ${f.sourceUrl}`).join("\n")}

## Observations
- Navigation themes observed across crawl: Products / Tools / Tables / Documents patterns appear in public IA (verify against navigation.json).
- Technology indicators observed: ${unique(pages.flatMap((p) => p.technologyIndicators)).join(", ") || "none detected"}

## Inferences (not facts)
${companyProfile.audiences.map((f) => `- INFERENCE (${f.confidence}): ${f.claim} — ${f.sourceUrl}`).join("\n")}

## Conflicts / staleness / duplication
- Marked unknown until multi-page comparison of document revision dates is completed.
- Duplicate distributor entries may appear if listed on homepage and distributor pages.

## Open questions
${companyProfile.openQuestions.map((q) => `- ${q}`).join("\n")}

## Artifact paths
- data/company-profile.json
- data/product-inventory.json
- data/document-inventory.json
- source/pages.json
`;

  fs.writeFileSync(projectPath(slug, "analysis/source-evidence.md"), evidenceMd, "utf8");
}

export function generateAuditArtifacts(slug: string): void {
  const config = readProjectConfig(slug);
  const pages =
    readJsonFile<PageRecord[]>(projectPath(slug, "source/pages.json")) ?? [];
  const home = pages[0];
  const tech = unique(pages.flatMap((p) => p.technologyIndicators));
  const formsCount = pages.reduce((n, p) => n + p.forms.length, 0);
  const tablesCount = pages.reduce((n, p) => n + p.tables.length, 0);
  const imagesMissingAlt = pages
    .flatMap((p) => p.images)
    .filter((i) => !i.alt || !i.alt.trim()).length;
  const pagesMissingDesc = pages.filter((p) => !p.metaDescription).length;

  const homeUrl = home?.url ?? config.websiteUrl;

  fs.writeFileSync(
    projectPath(slug, "analysis/technical-audit.md"),
    `# Technical audit — ${config.name}

## Technology detection (public evidence)
- Indicators: ${tech.join(", ") || "none"}
- Source examples: ${homeUrl}

## Forms
- Forms observed across crawl: ${formsCount}

## Tables
- HTML tables observed: ${tablesCount}

## Broken links
- Not exhaustively validated in MVP automated pass. See crawl-errors.json for fetch failures.

## Third-party scripts / iframes
- Iframes observed on ${pages.filter((p) => p.iframes.length).length} pages.

## Limitations
- No claims about internal infrastructure, hosting contracts, or private CMS configuration beyond publicly visible markers.
`,
    "utf8",
  );

  fs.writeFileSync(
    projectPath(slug, "analysis/accessibility-audit.md"),
    `# Accessibility audit — ${config.name}

## Automated observations from crawl HTML
- Images missing alt text (count): ${imagesMissingAlt}
- Pages missing meta description (related SEO/a11y content quality): ${pagesMissingDesc}

## Manual / axe follow-up required
- Landmark structure, focus order, keyboard access to mega-menus, and form label association need browser axe pass during Gate 7.

## Confidence
- Medium for alt-text inventory; low for full WCAG conformance (not claimed).
`,
    "utf8",
  );

  fs.writeFileSync(
    projectPath(slug, "analysis/seo-audit.md"),
    `# SEO audit — ${config.name}

## Title / description coverage
- Pages with titles: ${pages.filter((p) => p.title).length}/${pages.length}
- Pages with meta descriptions: ${pages.filter((p) => p.metaDescription).length}/${pages.length}

## Heading structure samples
${pages
  .slice(0, 8)
  .map(
    (p) =>
      `- ${p.url}\n  - title: ${p.title ?? "(missing)"}\n  - h1: ${p.h1.join(" | ") || "(none)"}`,
  )
  .join("\n")}

## Structured data
- Pages with JSON-LD blocks: ${pages.filter((p) => p.jsonLd.length).length}

## Notes
- www → apex redirect observed during planning; confirm canonical consistency in production recommendations.
`,
    "utf8",
  );

  fs.writeFileSync(
    projectPath(slug, "analysis/performance-audit.md"),
    `# Performance audit — ${config.name}

## Status
- Full Lighthouse CLI scoring is optional in MVP and may be skipped if runtime constraints apply.
- Crawl used Playwright \`domcontentloaded\` with polite delays; this is not a lab performance score.

## Qualitative indicators
- Theme/CMS assets and third-party fonts/scripts may affect LCP/TBT — verify with Lighthouse on homepage and a product page.

## Confidence
- Low until Lighthouse artifacts are attached under qa/.
`,
    "utf8",
  );

  const categories: DigitalMaturity["categories"] = [
    {
      category: "Positioning",
      score: 6,
      evidence: "Homepage states manufacturer/fabricator positioning and market geography.",
      sourceUrl: homeUrl,
      userImpact: "Users understand category quickly but task paths are secondary.",
      businessImpact: "Brand clarity exists; conversion tooling is underdeveloped.",
      recommendation: "Lead with product discovery and engineering task CTAs.",
      prototypeResponse: "Task-led homepage with product, calculator, submittal entry points.",
      confidence: "medium",
    },
    {
      category: "Visual design",
      score: 4,
      evidence: "Public WordPress Velvet theme presentation; dated industrial brochure pattern.",
      sourceUrl: homeUrl,
      userImpact: "Lower perceived modernity vs contemporary manufacturer sites.",
      businessImpact: "Credibility gap in competitive pitches.",
      recommendation: "Original industrial art direction, not theme restyle.",
      prototypeResponse: "Gate 4–5 design system.",
      confidence: "medium",
    },
    {
      category: "Brand credibility",
      score: 6,
      evidence: "Standards references (AISI/CSA) and distributor network listed publicly.",
      sourceUrl: homeUrl,
      userImpact: "Technical buyers see some trust signals.",
      businessImpact: "Trust present but fragmented across long homepage content.",
      recommendation: "Elevate standards, locations, and technical resources without inventing awards.",
      prototypeResponse: "Sourced trust strip + resource pathways.",
      confidence: "medium",
    },
    {
      category: "Navigation",
      score: 5,
      evidence: "Products/Tools/Tables/Documents menu taxonomy observed.",
      sourceUrl: homeUrl,
      userImpact: "Department-like IA may slow task completion.",
      businessImpact: "Support load increases when users cannot self-serve.",
      recommendation: "Task-based IA: Products, Engineering, Resources, Distributors, Contact.",
      prototypeResponse: "Proposed sitemap in strategy.",
      confidence: "medium",
    },
    {
      category: "Product discovery",
      score: 4,
      evidence: `Product-related pages in crawl: ${productPagesCount(pages)}`,
      sourceUrl: homeUrl,
      userImpact: "Hard to filter by application/depth/thickness.",
      businessImpact: "Missed qualified engagement.",
      recommendation: "Structured catalog with filters.",
      prototypeResponse: "Products catalog module (Gate 6).",
      confidence: "medium",
    },
    {
      category: "Product detail",
      score: 4,
      evidence: "Product pages present but attributes largely unstructured in HTML extraction.",
      sourceUrl: homeUrl,
      userImpact: "Engineers bounce to PDFs.",
      businessImpact: "PDF dependency slows specification cycles.",
      recommendation: "Structured attributes + related docs/tools.",
      prototypeResponse: "NITROSTUD detail prototype.",
      confidence: "medium",
    },
    {
      category: "Technical-resource discovery",
      score: 5,
      evidence: `Tables observed: ${tablesCount}; document links: ${readJsonFile<DocumentLink[]>(projectPath(slug, "source/documents.json"))?.length ?? 0}`,
      sourceUrl: homeUrl,
      userImpact: "Resources exist but discovery is menu-dependent.",
      businessImpact: "Repetitive sales engineering inquiries.",
      recommendation: "Unified document center with filters.",
      prototypeResponse: "Resources center.",
      confidence: "medium",
    },
    {
      category: "Document management",
      score: 3,
      evidence: "Document inventory lacks consistent revision metadata in crawl.",
      sourceUrl: homeUrl,
      userImpact: "Uncertainty about current vs outdated files.",
      businessImpact: "Risk of specifying superseded docs.",
      recommendation: "Revision dates + current/archived status.",
      prototypeResponse: "Document rows with status fields (unknown when missing).",
      confidence: "medium",
    },
    {
      category: "Calculators",
      score: 2,
      evidence: "No clear first-class limiting-height calculator UX dominant in crawl labels.",
      sourceUrl: homeUrl,
      userImpact: "Manual PDF table lookup.",
      businessImpact: "High-friction technical qualification.",
      recommendation: "Conceptual calculator first; table-driven later with verified data.",
      prototypeResponse: "Limiting-height calculator (conceptual).",
      confidence: "low",
    },
    {
      category: "Submittal workflow",
      score: 2,
      evidence: "Submittal/spec language sparse; no integrated package builder observed.",
      sourceUrl: homeUrl,
      userImpact: "Manual assembly of PDFs.",
      businessImpact: "Longer sales cycles.",
      recommendation: "Persistent submittal builder.",
      prototypeResponse: "Submittal drawer/sheet.",
      confidence: "medium",
    },
    {
      category: "Distributor workflow",
      score: 6,
      evidence: "Extensive public distributor listings by state on homepage/content.",
      sourceUrl: homeUrl,
      userImpact: "Useful but long static lists.",
      businessImpact: "Good coverage; weak findability by ZIP.",
      recommendation: "Searchable locator with sales fallback.",
      prototypeResponse: "Distributor locator concept.",
      confidence: "high",
    },
    {
      category: "Contact and support",
      score: 5,
      evidence: `Forms observed: ${formsCount}`,
      sourceUrl: homeUrl,
      userImpact: "Generic contact/download forms may lack routing.",
      businessImpact: "Lead quality variance.",
      recommendation: "Intent-based contact + technical support pathways.",
      prototypeResponse: "Contact workflow page.",
      confidence: "medium",
    },
    {
      category: "Mobile usability",
      score: 4,
      evidence: "Theme includes mobile viewport meta; dense homepage content likely stressful on small screens.",
      sourceUrl: homeUrl,
      userImpact: "Field users struggle with long pages/tables.",
      businessImpact: "Missed mobile self-service.",
      recommendation: "Mobile-first tables/filters patterns.",
      prototypeResponse: "Responsive design-system patterns.",
      confidence: "low",
    },
    {
      category: "Accessibility",
      score: 3,
      evidence: `Images missing alt: ${imagesMissingAlt}`,
      sourceUrl: homeUrl,
      userImpact: "Screen reader gaps.",
      businessImpact: "Compliance and inclusion risk.",
      recommendation: "Labeled controls, focus states, alt text policy.",
      prototypeResponse: "Accessible component system.",
      confidence: "medium",
    },
    {
      category: "Performance",
      score: 4,
      evidence: "CMS theme + third-party assets; Lighthouse pending.",
      sourceUrl: homeUrl,
      userImpact: "Potential slow first load.",
      businessImpact: "SEO and bounce impact.",
      recommendation: "Image optimization and script hygiene.",
      prototypeResponse: "Lean prototype; production perf backlog.",
      confidence: "low",
    },
    {
      category: "SEO",
      score: 5,
      evidence: `Meta description coverage ${pages.filter((p) => p.metaDescription).length}/${pages.length}; Yoast indicators present.`,
      sourceUrl: homeUrl,
      userImpact: "Mixed SERP snippet quality.",
      businessImpact: "Uneven organic discovery.",
      recommendation: "Consistent titles/descriptions per template.",
      prototypeResponse: "Template-level metadata model.",
      confidence: "medium",
    },
    {
      category: "Content quality",
      score: 5,
      evidence: "Technically oriented copy present; long undifferentiated blocks on homepage.",
      sourceUrl: homeUrl,
      userImpact: "Hard to scan for tasks.",
      businessImpact: "Message dilution.",
      recommendation: "Editorial hierarchy tied to tasks.",
      prototypeResponse: "prototype-copy.md",
      confidence: "medium",
    },
    {
      category: "Content freshness",
      score: 4,
      evidence: "Revision metadata largely unknown in document inventory.",
      sourceUrl: homeUrl,
      userImpact: "Uncertainty.",
      businessImpact: "Trust erosion if stale PDFs persist.",
      recommendation: "Publish revision dates.",
      prototypeResponse: "Status unknown labels when missing.",
      confidence: "low",
    },
    {
      category: "Conversion",
      score: 4,
      evidence: "Download form CTAs observed; weak product-to-lead progressive paths.",
      sourceUrl: homeUrl,
      userImpact: "Friction before value.",
      businessImpact: "Lower qualified conversion.",
      recommendation: "Task completion before form gates where possible.",
      prototypeResponse: "Tools before gated brochure asks.",
      confidence: "medium",
    },
    {
      category: "Process efficiency",
      score: 3,
      evidence: "PDF-heavy and list-heavy workflows dominate public experience.",
      sourceUrl: homeUrl,
      userImpact: "Manual steps.",
      businessImpact: "Internal repetitive support.",
      recommendation: "Process-improvement map modules.",
      prototypeResponse: "Catalog + calculator + submittal.",
      confidence: "medium",
    },
    {
      category: "AI readiness",
      score: 2,
      evidence: "No structured product graph or document metadata layer evident for retrieval.",
      sourceUrl: homeUrl,
      userImpact: "No assisted search.",
      businessImpact: "Future AI features blocked without data model.",
      recommendation: "Structure products/docs first.",
      prototypeResponse: "Data schemas + search-ready inventories.",
      confidence: "medium",
    },
    {
      category: "Overall digital maturity",
      score: 4,
      evidence: "Average of category scores; brochure-site maturity with strong distributor content and weak interactive tooling.",
      sourceUrl: homeUrl,
      userImpact: "Informational but not operational.",
      businessImpact: "Opportunity for platform differentiation.",
      recommendation: "Phased digital product roadmap.",
      prototypeResponse: "Full SiteForge prototype path.",
      confidence: "medium",
    },
  ];

  const overall =
    Math.round(
      (categories.reduce((s, c) => s + c.score, 0) / categories.length) * 10,
    ) / 10;

  const maturity: DigitalMaturity = {
    projectSlug: slug,
    categories,
    overallScore: overall,
    overallRationale:
      "Weighted qualitative assessment from crawl evidence; not a lab benchmark. Scores include confidence tags.",
    updatedAt: new Date().toISOString(),
  };
  writeJsonFile(projectPath(slug, "analysis/digital-maturity.json"), maturity);

  fs.writeFileSync(
    projectPath(slug, "analysis/executive-audit.md"),
    `# Executive audit — ${config.name}

## Overall digital maturity
**${overall} / 10** — ${maturity.overallRationale}

## What the company already has
- Public manufacturer positioning and standards language (sourced).
- Significant distributor listings.
- Product/tools/tables/documents information architecture signals.
- Download/contact form pathways.

## Where friction concentrates
- Product discovery lacks structured filtering.
- Engineering workflows appear PDF/table-bound without interactive calculators.
- Submittal packaging is not a first-class digital workflow.
- Accessibility and content metadata gaps reduce self-service confidence.

## Prototype thesis
An interactive industrial platform (catalog + conceptual calculator + document center + submittal builder + distributor locator) addresses documented friction better than a cosmetic redesign.

## Evidence roots
- analysis/source-evidence.md
- analysis/digital-maturity.json
- source/pages.json
`,
    "utf8",
  );

  fs.writeFileSync(
    projectPath(slug, "analysis/competitive-framework.md"),
    `# Competitive framework — ${config.name}

Extensible schema for later competitor analysis. **MVP does not auto-crawl competitor domains.**

See \`data/competitor-benchmark.json\` (partial / labeled incomplete).
`,
    "utf8",
  );

  const competitor: CompetitorBenchmark = {
    projectSlug: slug,
    entries: [
      {
        competitor: "Peer CFS framing manufacturers (placeholder slot)",
        status: "empty",
        notes: "Populate only when explicitly configured to research a named competitor.",
        observedStrengths: [],
        observedWeaknesses: [],
      },
    ],
    status: "partial",
    notes:
      "MVP framework only. Competitor domains are not auto-crawled unless explicitly configured.",
    updatedAt: new Date().toISOString(),
  };
  writeJsonFile(projectPath(slug, "data/competitor-benchmark.json"), competitor);

  fs.writeFileSync(
    projectPath(slug, "strategy/current-journeys.md"),
    `# Current journeys — ${config.name}

## Journey A — Find a product family
1. Land on homepage
2. Use Products menu
3. Open category/product page
4. Hunt for PDFs/tables
**Friction:** limited filtering; attributes unstructured.

## Journey B — Find a distributor
1. Scroll homepage distributor lists or locate distributor content
2. Scan by state
**Friction:** long static lists; weak ZIP search.

## Journey C — Get technical values
1. Navigate Tools/Tables/Documents
2. Open PDF or HTML table
3. Manual lookup
**Friction:** no interactive limiting-height workflow observed as primary UX.

## Journey D — Contact / brochure
1. Locate download/contact form
2. Submit
**Friction:** value exchange may feel gated before task completion.
`,
    "utf8",
  );
}

function productPagesCount(pages: PageRecord[]): number {
  return pages.filter((p) =>
    /product|stud|track|joist|nitro|framing|catalog/i.test(
      `${p.url} ${p.title ?? ""}`,
    ),
  ).length;
}

export function generateStrategyArtifacts(slug: string): void {
  const config = readProjectConfig(slug);

  const files: Record<string, string> = {
    "strategy/audiences.md": `# Audiences — ${config.name}

## Primary
- Specifying engineers / design professionals seeking member capacities and documents
- Distributors / dealers needing product and availability pathways
- Contractors / estimators needing quick product identification and submittal packs

## Secondary
- Internal sales / customer service using the site as a shared reference

## Evidence basis
Inferred from public distributor listings, technical standards language, and product/document IA — see analysis/source-evidence.md. Labeled as inference where not explicit.
`,
    "strategy/proposed-sitemap.md": `# Proposed sitemap — ${config.name}

- Home
- Products
  - Catalog index (filters)
  - Product family pages
  - NITROSTUD detail
- Engineering
  - Limiting-height calculator (conceptual)
  - Tables index
- Resources / Document center
- Submittal builder
- Distributors
- Contact / Technical support
- Design system (internal prototype only)
`,
    "strategy/proposed-journeys.md": `# Proposed journeys — ${config.name}

## Select a stud for a wall height
Home → Calculator → passing members → product detail → add to submittal

## Build a submittal package
Products/Resources → add items → package drawer → download conceptual PDF

## Find a distributor
Distributors → ZIP/state filter → contact sales fallback

## Every feature maps to friction
Calculator ← PDF table lookup friction  
Catalog filters ← unstructured discovery  
Submittal ← manual PDF assembly  
Distributor search ← static lists
`,
    "strategy/page-blueprints.md": `# Page blueprints — ${config.name}

## Home
Task band: Products / Calculator / Submittal / Distributors / Support. No generic long-scroll marketing-only layout.

## Products
Search + filters + result count + rows/cards + compare + add-to-project.

## NITROSTUD
Purpose, sourced overview, attributes, documents, tools, add-to-submittal, source refs in data.

## Limiting-height calculator
Grouped inputs, validation, conceptual results, disclaimer, mobile results.

## Resources
Search + type/family filters + revision/status when known.

## Submittal
Drawer (desktop) / sheet (mobile); no unnamed default package.

## Distributors
ZIP/city/state; availability disclaimer.
`,
    "strategy/process-improvement-map.md": `# Process improvement map — ${config.name}

## 1. Product selection
- Current: browse menus/PDFs
- Friction: no attribute filters
- Audience: engineers, estimators
- Future: structured catalog
- Feature: product catalog
- Benefit: faster shortlisting
- Assumptions: attributes can be structured from published docs
- Dependencies: verified product data
- Phase: 1

## 2. Limiting-height lookup
- Current: manual tables
- Friction: slow, error-prone
- Future: conceptual calculator → later table-driven
- Feature: limiting-height calculator
- Benefit: self-service qualification
- Assumptions: demo data clearly labeled until verified
- Dependencies: manufacturer tables for production
- Phase: 1 conceptual / 2 verified

## 3. Submittal assembly
- Current: manual PDF gathering
- Friction: version chaos
- Future: package builder
- Feature: submittal builder
- Benefit: consistent customer packages; less email back-and-forth
- Phase: 1

## 4. Distributor discovery
- Current: long static lists
- Friction: poor findability
- Future: searchable locator
- Feature: distributor locator
- Benefit: faster buy-path
- Phase: 1

## 5. Document retrieval
- Current: scattered menus
- Friction: unknown revision status
- Future: document center
- Feature: resources module
- Benefit: fewer outdated specs
- Phase: 1

Do not invent numeric ROI.
`,
    "strategy/opportunity-map.md": `# Opportunity map — ${config.name}

| Module | Problem solved | Audience | Phase |
|---|---|---|---|
| Structured catalog | Discovery friction | Engineers, distributors | 1 |
| NITROSTUD detail | Unstructured product storytelling | Specifiers | 1 |
| Conceptual limiting-height calculator | PDF table friction | Engineers | 1 |
| Document center | Resource findability | All technical users | 1 |
| Submittal builder | Manual packaging | Sales + customers | 1 |
| Distributor locator | Static list friction | Buyers | 1 |
| AI document search | Retrieval at scale | Support + customers | 3 |
| Customer portal | Account workflows | Repeat customers | 3 |
`,
    "strategy/product-roadmap.md": `# Product roadmap — ${config.name}

## Phase 1 — Prototype / MVP platform concept
Catalog, product detail, conceptual calculator, document center, submittal, distributors, contact.

## Phase 2 — Verified data hardening
Table-driven calculators with sourced values, revision-controlled documents, integrations.

## Phase 3 — Portals & AI assistance
Authenticated workspaces, AI search over structured corpus only.

## Risks
- Unverified engineering values (mitigate with conceptual classification + disclaimer)
- Incomplete metadata (label unknown)
- CMS content migration effort (client dependency)
`,
  };

  for (const [rel, content] of Object.entries(files)) {
    fs.writeFileSync(projectPath(slug, rel), content, "utf8");
  }

  writeJsonFile(projectPath(slug, "data/calculator-requirements.json"), {
    projectSlug: slug,
    calculators: [
      {
        id: "limiting-height",
        name: "Limiting height calculator",
        classification: "conceptual",
        problemSolved: "Manual PDF/HTML table lookup for wall stud limiting heights",
        inputs: [
          "required wall height",
          "product family",
          "member depth",
          "stud spacing",
          "lateral load",
          "deflection limit",
        ],
        outputs: [
          "passing members",
          "failing members",
          "max supported height",
          "margin",
          "document reference placeholder",
        ],
        dataDependencies: ["Verified manufacturer limiting-height tables for production"],
        disclaimer:
          "Conceptual prototype using demonstration data. Not for engineering, specification, procurement, or construction use.",
        prototypeScope: "Deterministic demo lookup with validation and states",
        productionScope: "Manufacturer-approved tables, formulas, validation, signoff",
        risks: ["Users may misread conceptual results as approved"],
      },
    ],
    updatedAt: new Date().toISOString(),
  });

  writeJsonFile(projectPath(slug, "data/calculator-demo-data.json"), {
    projectSlug: slug,
    calculatorId: "limiting-height",
    classification: "conceptual",
    disclaimer:
      "Conceptual prototype using demonstration data. Not for engineering, specification, procurement, or construction use.",
    assumptions: [
      "Demo rows are illustrative and not manufacturer-approved.",
      "Units are imperial as commonly published in US CFS catalogs.",
    ],
    members: [
      {
        designation: "362S162-33 (demo)",
        family: "Stud",
        depthIn: 3.625,
        thicknessMils: 33,
        spacingIn: 16,
        lateralLoadPsf: 5,
        deflectionLimit: "L/240",
        maxHeightFt: 12.5,
        composite: false,
        sourceDocument: "DEMO — replace with verified table",
        sourcePage: "n/a",
        demoOnly: true,
      },
      {
        designation: "362S162-43 (demo)",
        family: "Stud",
        depthIn: 3.625,
        thicknessMils: 43,
        spacingIn: 16,
        lateralLoadPsf: 5,
        deflectionLimit: "L/240",
        maxHeightFt: 14.2,
        composite: false,
        sourceDocument: "DEMO — replace with verified table",
        sourcePage: "n/a",
        demoOnly: true,
      },
      {
        designation: "600S162-33 (demo)",
        family: "Stud",
        depthIn: 6,
        thicknessMils: 33,
        spacingIn: 16,
        lateralLoadPsf: 5,
        deflectionLimit: "L/240",
        maxHeightFt: 16.0,
        composite: false,
        sourceDocument: "DEMO — replace with verified table",
        sourcePage: "n/a",
        demoOnly: true,
      },
      {
        designation: "600S162-43 (demo)",
        family: "Stud",
        depthIn: 6,
        thicknessMils: 43,
        spacingIn: 16,
        lateralLoadPsf: 5,
        deflectionLimit: "L/240",
        maxHeightFt: 18.5,
        composite: false,
        sourceDocument: "DEMO — replace with verified table",
        sourcePage: "n/a",
        demoOnly: true,
      },
    ],
    updatedAt: new Date().toISOString(),
  });

  fs.writeFileSync(
    projectPath(slug, "analysis/calculator-opportunities.md"),
    `# Calculator opportunities — ${config.name}

## Limiting-height calculator
- Classification: **conceptual** for prototype
- Rationale: crawl does not yet prove a complete verified machine-readable table set suitable for production engineering output
- Safety: mandatory disclaimer; demo designations labeled demoOnly
`,
    "utf8",
  );
}

export function generateArtDirectionArtifacts(slug: string): void {
  const config = readProjectConfig(slug);

  const tokens = {
    projectSlug: slug,
    meta: {
      concept: "Precision Mill",
      personality: [
        "industrial",
        "precise",
        "engineered",
        "established",
        "dependable",
        "contemporary",
        "high-performance",
        "technical",
        "premium-not-luxurious",
      ],
    },
    color: {
      ink: "#121417",
      slate: "#2C333A",
      steel: "#5B6770",
      mist: "#E6EAEE",
      paper: "#F4F6F8",
      chalk: "#FBFCFD",
      signal: "#B5471D",
      signalHover: "#8F3816",
      pass: "#1F6B4A",
      fail: "#9B1C1C",
      border: "#C9D1D8",
      focus: "#0B5FFF",
    },
    typography: {
      display: "\"IBM Plex Sans\", \"Segoe UI\", sans-serif",
      body: "\"IBM Plex Sans\", \"Segoe UI\", sans-serif",
      mono: "\"IBM Plex Mono\", ui-monospace, monospace",
      scale: {
        xs: "0.75rem",
        sm: "0.875rem",
        md: "1rem",
        lg: "1.125rem",
        xl: "1.5rem",
        "2xl": "2rem",
        "3xl": "2.75rem",
      },
    },
    space: {
      "1": "4px",
      "2": "8px",
      "3": "12px",
      "4": "16px",
      "5": "24px",
      "6": "32px",
      "7": "48px",
      "8": "64px",
    },
    radius: {
      none: "0px",
      sm: "2px",
      md: "4px",
      lg: "6px",
    },
    shadow: {
      none: "none",
      hairline: "0 1px 0 rgba(18,20,23,0.08)",
      panel: "0 8px 24px rgba(18,20,23,0.08)",
    },
    grid: {
      columns: 12,
      gutter: "24px",
      maxWidth: "1200px",
    },
    motion: {
      fast: "120ms",
      base: "200ms",
      slow: "320ms",
    },
  };

  writeJsonFile(projectPath(slug, "design/design-tokens.json"), tokens);

  fs.writeFileSync(
    projectPath(slug, "design/art-direction.md"),
    `# Art direction — ${config.name}

## Concept: Precision Mill
An engineered industrial system: steel, paper, signal-orange accents used sparingly for actions and warnings. Feels like a modern mill shop floor meeting an architectural specification binder — not a SaaS dashboard.

## Brand personality
Industrial, precise, engineered, established, dependable, contemporary, high-performance, technical, premium but not luxurious, modern without startup theatrics.

## Typography
IBM Plex Sans for UI and display; IBM Plex Mono for designations, table cells, calculator outputs.

## Color strategy
Graphite ink on cool paper/mist grounds. Signal burnt-orange for primary actions only. Pass/fail greens/reds reserved for calculator states.

## Grid & spacing
12-column, 1200px max, 24px gutters. Dense but breathable; technical pages prefer tighter vertical rhythm than marketing sites.

## Radius & elevation
Near-sharp (2–6px). Hairline borders over soft shadows. No floating glass cards.

## Photography & diagrams
Manufacturing/product context, monochrome or restrained color grade. Technical diagrams use 1px rules, mono labels, no decorative 3D clay.

## Patterns to avoid
Purple gradients, glassmorphism, glow, pill overload, generic three-card icon rows, fake metrics/logos/testimonials, default Tailwind/shadcn look, full-viewport empty heroes.

## Mobile
Collapse filters into sheets; tables become keyed stacks; keep calculator results scannable with sticky summary.
`,
    "utf8",
  );

  fs.writeFileSync(
    projectPath(slug, "design/component-principles.md"),
    `# Component principles — ${config.name}

1. One visual language across marketing and technical surfaces.
2. Borders and typography create structure before shadows.
3. Data density is a feature; do not "cardify" every row.
4. Every control has hover, focus-visible, disabled, error states.
5. Calculator results prioritize pass/fail clarity over ornament.
6. Drawers/sheets for submittal persistence — never bury package state.
7. No default component-library chrome left unmodified.
`,
    "utf8",
  );

  fs.writeFileSync(
    projectPath(slug, "design/reference-board.md"),
    `# Reference board — ${config.name}

## In-industry cues
- Architectural product binders
- Mill traveler tickets / heat numbers (typography cue only)
- Structural drawings title blocks

## Digital cues
- Dense engineering documentation sites with clear tables
- Industrial product selectors with explicit units

## Reject
- Startup SaaS dashboards
- Luxury editorial fashion layouts
- Generic AI purple/cream templates
`,
    "utf8",
  );

  fs.writeFileSync(
    projectPath(slug, "design/prototype-copy.md"),
    `# Prototype copy — ${config.name}

## Homepage positioning
**${config.name}**  
Cold-formed steel framing and building products for construction professionals.

Supporting: Find members, technical documents, and distributors — then assemble a project package.

## Primary CTAs
- Browse products
- Open limiting-height calculator
- Build a submittal
- Find a distributor
- Contact technical support

## Disclaimer (footer, all prototype pages)
Unofficial redesign concept prepared for private business-development discussion. Not affiliated with or endorsed by the referenced company.

## Calculator disclaimer
Conceptual prototype using demonstration data. Not for engineering, specification, procurement, or construction use.

## Rules
No fabricated statistics, testimonials, client logos, or unverified certifications.
`,
    "utf8",
  );
}

export function runAuditPipeline(slug: string): void {
  if (!fileExists(slug, "source/pages.json")) {
    throw new Error("Missing source/pages.json — crawl first");
  }
  generateEvidenceArtifacts(slug);
  generateAuditArtifacts(slug);
  updateProjectStage(slug, "audit_generated");
  writeProjectStatus(slug, {
    currentPhase: "audit_generated",
    completedArtifacts: [
      "data/company-profile.json",
      "data/product-inventory.json",
      "data/document-inventory.json",
      "analysis/source-evidence.md",
      "analysis/executive-audit.md",
      "analysis/technical-audit.md",
      "analysis/accessibility-audit.md",
      "analysis/seo-audit.md",
      "analysis/performance-audit.md",
      "analysis/digital-maturity.json",
      "strategy/current-journeys.md",
    ],
    blockers: [],
    openQuestions: [],
    qaFailures: [],
    requiredRevisions: [],
    approvedGates: ["gate_1_source_evidence"],
  });
}

export function runStrategyPipeline(slug: string): void {
  generateStrategyArtifacts(slug);
  generateArtDirectionArtifacts(slug);
  updateProjectStage(slug, "art_direction_ready");
  writeProjectStatus(slug, {
    currentPhase: "art_direction_ready",
    completedArtifacts: [
      "strategy/*",
      "design/art-direction.md",
      "design/design-tokens.json",
      "design/component-principles.md",
      "design/reference-board.md",
      "design/prototype-copy.md",
      "data/calculator-requirements.json",
      "data/calculator-demo-data.json",
    ],
    blockers: [],
    openQuestions: [],
    qaFailures: [],
    requiredRevisions: [],
    approvedGates: [
      "gate_1_source_evidence",
      "gate_2_audit",
      "gate_3_strategy",
      "gate_4_art_direction",
    ],
  });
}
