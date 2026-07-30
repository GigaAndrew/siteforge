import * as cheerio from "cheerio";
import type {
  DocumentLink,
  ExternalTool,
  FormRecord,
  ImageRecord,
  PageRecord,
  TableRecord,
} from "@/lib/schemas/crawl";
import {
  fileTypeFromHref,
  hostAllowed,
  isDocumentHref,
  normalizeUrl,
  pickPreferredHost,
  type CanonicalizeOptions,
} from "@/lib/crawler/normalize";
import { normalizeExtractedText } from "@/lib/crawler/text-normalize";

const PRODUCT_FAMILY_TERMS = [
  "nitrostud",
  "stud",
  "track",
  "joist",
  "furring",
  "channel",
  "clip",
  "angle",
  "header",
  "framing",
];

function unique(items: string[]): string[] {
  return [...new Set(items.filter(Boolean))];
}

function extractPhones(text: string): string[] {
  const matches = text.match(
    /(?:\+?1[-.\s]?)?(?:\(?\d{3}\)?[-.\s]?)\d{3}[-.\s]?\d{4}/g,
  );
  return unique(matches ?? []);
}

function extractEmails(text: string): string[] {
  const matches = text.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi);
  return unique(matches ?? []);
}

export function extractPageRecord(input: {
  url: string;
  html: string;
  /** Prefer Playwright innerText when available — more reliable than cheerio on odd encodings */
  domText?: string;
  statusCode?: number;
  redirectChain?: string[];
  approvedHosts: string[];
  crawledAt?: string;
  textNormalizeLog?: Array<Record<string, unknown>>;
}): {
  page: PageRecord;
  documents: DocumentLink[];
  externalTools: ExternalTool[];
} {
  const canonOpts: CanonicalizeOptions = {
    preferredHost: pickPreferredHost(input.approvedHosts),
    preferHttps: true,
  };
  const $ = cheerio.load(input.html);
  const canonicalBase =
    normalizeUrl(input.url, undefined, canonOpts) ?? input.url;
  const baseUrl = canonicalBase;
  const cheerioText = $("body").text();
  const candidateText =
    input.domText && input.domText.trim().length > 40
      ? input.domText
      : cheerioText;
  const normalized = normalizeExtractedText(candidateText, { maxLength: 600 });
  if (!normalized.ok || normalized.issues.length) {
    input.textNormalizeLog?.push({
      url: baseUrl,
      ok: normalized.ok,
      issues: normalized.issues,
      printableRatio: normalized.printableRatio,
      commonTextRatio: normalized.commonTextRatio,
      rawPreserved: normalized.rawPreserved,
    });
  }
  let text = normalized.text;
  if (!normalized.ok && input.domText && input.domText !== candidateText) {
    const alt = normalizeExtractedText(input.domText, { maxLength: 600 });
    if (alt.ok) {
      text = alt.text;
      input.textNormalizeLog?.push({
        url: baseUrl,
        ok: true,
        issues: alt.issues,
        printableRatio: alt.printableRatio,
        commonTextRatio: alt.commonTextRatio,
        recoveredFromDomText: true,
      });
    }
  }

  const abs = (href: string | undefined) => {
    if (!href) return null;
    return normalizeUrl(href, baseUrl, canonOpts);
  };

  const navigationLinks: string[] = [];
  $("nav a[href], header a[href], .menu a[href], #menu a[href]").each((_, el) => {
    const href = abs($(el).attr("href"));
    if (href) navigationLinks.push(href);
  });

  const internalLinks: string[] = [];
  const externalLinks: string[] = [];
  $("a[href]").each((_, el) => {
    const href = abs($(el).attr("href"));
    if (!href) return;
    if (hostAllowed(href, input.approvedHosts)) internalLinks.push(href);
    else externalLinks.push(href);
  });

  const buttons = unique(
    $("button, [role='button'], .btn, .button")
      .map((_, el) => $(el).text().replace(/\s+/g, " ").trim())
      .get()
      .filter(Boolean),
  );

  const callsToAction = unique(
    $("a.btn, a.button, .cta a, a[class*='cta']")
      .map((_, el) => $(el).text().replace(/\s+/g, " ").trim())
      .get()
      .filter(Boolean),
  );

  const forms: FormRecord[] = $("form")
    .map((_, el) => {
      const form = $(el);
      const fields = form
        .find("input, select, textarea")
        .map((__, field) => {
          const $f = $(field);
          const id = $f.attr("id");
          const label =
            (id ? $(`label[for='${id}']`).first().text() : "") ||
            $f.closest("label").text() ||
            $f.attr("aria-label") ||
            undefined;
          const tag =
            "tagName" in field && typeof field.tagName === "string"
              ? field.tagName.toLowerCase()
              : "input";
          return {
            name: $f.attr("name"),
            type: $f.attr("type") || tag,
            label: label?.replace(/\s+/g, " ").trim() || undefined,
            required: $f.is("[required]"),
            placeholder: $f.attr("placeholder"),
          };
        })
        .get();
      return {
        pageUrl: baseUrl,
        action: form.attr("action"),
        method: form.attr("method") || "get",
        id: form.attr("id"),
        name: form.attr("name"),
        fields,
      };
    })
    .get();

  const tables: TableRecord[] = $("table")
    .map((_, el) => {
      const table = $(el);
      const headers = table
        .find("thead th, tr:first-child th, tr:first-child td")
        .map((__, cell) => $(cell).text().replace(/\s+/g, " ").trim())
        .get();
      const rows = table
        .find("tr")
        .map((__, row) =>
          $(row)
            .find("th,td")
            .map((___, cell) => $(cell).text().replace(/\s+/g, " ").trim())
            .get(),
        )
        .get();
      return {
        pageUrl: baseUrl,
        caption: table.find("caption").text().trim() || undefined,
        headers,
        rowCount: Math.max(0, rows.length - (headers.length ? 1 : 0)),
        sampleRows: rows.slice(1, 6),
      };
    })
    .get();

  const images: ImageRecord[] = $("img")
    .map((_, el) => {
      const img = $(el);
      const src = abs(img.attr("src") || img.attr("data-src") || "") || img.attr("src") || "";
      return {
        pageUrl: baseUrl,
        src,
        alt: img.attr("alt"),
        width: img.attr("width"),
        height: img.attr("height"),
      };
    })
    .get()
    .filter((img) => Boolean(img.src));

  const documents: DocumentLink[] = [];
  $("a[href]").each((_, el) => {
    const hrefAttr = $(el).attr("href");
    const href = abs(hrefAttr);
    if (!href || !isDocumentHref(href)) return;
    documents.push({
      pageUrl: baseUrl,
      href,
      text: $(el).text().replace(/\s+/g, " ").trim() || undefined,
      fileType: fileTypeFromHref(href),
    });
  });

  const externalTools: ExternalTool[] = [];
  for (const href of unique(externalLinks)) {
    try {
      const host = new URL(href).hostname;
      // Inventory likely tools / portals; keep all external for inventory, deep crawl later none
      if (
        /calculator|configurator|portal|locator|map|tool|submittal|bim|cad/i.test(
          href,
        )
      ) {
        externalTools.push({
          pageUrl: baseUrl,
          href,
          host,
          label: undefined,
          notes: "Linked external tool candidate; not deeply crawled.",
        });
      }
    } catch {
      /* ignore */
    }
  }

  const jsonLd: unknown[] = [];
  $('script[type="application/ld+json"]').each((_, el) => {
    const raw = $(el).contents().text();
    try {
      jsonLd.push(JSON.parse(raw));
    } catch {
      jsonLd.push({ parseError: true, raw: raw.slice(0, 200) });
    }
  });

  const technologyIndicators: string[] = [];
  if (/wp-content|wordpress/i.test(input.html)) technologyIndicators.push("WordPress");
  if (/yoast/i.test(input.html)) technologyIndicators.push("Yoast SEO");
  if (/googleapis|gstatic/i.test(input.html)) technologyIndicators.push("Google Fonts/CDN");
  if (/googletagmanager|gtag\(/i.test(input.html)) technologyIndicators.push("Google Tag Manager/Analytics");
  if (/cloudflare/i.test(input.html)) technologyIndicators.push("Cloudflare indicators");

  const lowerText = text.toLowerCase();
  const productFamilyTerms = PRODUCT_FAMILY_TERMS.filter((t) =>
    lowerText.includes(t),
  );

  const pdfLinks = documents.filter((d) => d.fileType === "pdf").map((d) => d.href);
  const wordLinks = documents
    .filter((d) => d.fileType === "doc" || d.fileType === "docx")
    .map((d) => d.href);
  const spreadsheetLinks = documents
    .filter((d) => ["xls", "xlsx", "csv"].includes(d.fileType))
    .map((d) => d.href);
  const cadBimLinks = documents
    .filter((d) => ["dwg", "dxf", "rvt", "ifc"].includes(d.fileType))
    .map((d) => d.href);

  const page: PageRecord = {
    url: baseUrl,
    canonicalUrl:
      abs($('link[rel="canonical"]').attr("href")) ||
      $('meta[property="og:url"]').attr("content") ||
      undefined,
    statusCode: input.statusCode,
    redirectChain: input.redirectChain ?? [],
    title: $("title").first().text().replace(/\s+/g, " ").trim() || undefined,
    metaDescription:
      $('meta[name="description"]').attr("content")?.trim() || undefined,
    h1: unique(
      $("h1")
        .map((_, el) => $(el).text().replace(/\s+/g, " ").trim())
        .get(),
    ),
    h2: unique(
      $("h2")
        .map((_, el) => $(el).text().replace(/\s+/g, " ").trim())
        .get(),
    ),
    h3: unique(
      $("h3")
        .map((_, el) => $(el).text().replace(/\s+/g, " ").trim())
        .get(),
    ),
    mainTextSummary: text
      ? text
      : "[text extraction failed — raw content preserved in crawl logs; confidence degraded]",
    navigationLinks: unique(navigationLinks),
    internalLinks: unique(internalLinks),
    externalLinks: unique(externalLinks),
    buttons,
    callsToAction,
    forms,
    tables,
    images,
    iframes: unique(
      $("iframe[src]")
        .map((_, el) => abs($(el).attr("src")) || $(el).attr("src") || "")
        .get()
        .filter(Boolean),
    ),
    pdfLinks: unique(pdfLinks),
    wordLinks: unique(wordLinks),
    spreadsheetLinks: unique(spreadsheetLinks),
    cadBimLinks: unique(cadBimLinks),
    productIdentifiers: [],
    productFamilyTerms,
    phoneNumbers: extractPhones(text),
    emailAddresses: extractEmails(text),
    locations: [],
    thirdPartyTools: unique(externalTools.map((t) => t.href)),
    jsonLd,
    technologyIndicators: unique(technologyIndicators),
    crawledAt: input.crawledAt ?? new Date().toISOString(),
  };

  return { page, documents, externalTools };
}
