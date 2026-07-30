import { describe, expect, it } from "vitest";
import {
  hostAllowed,
  normalizeUrl,
  shouldSkipPath,
  fileTypeFromHref,
} from "@/lib/crawler/normalize";
import { parseRobotsTxt, isAllowedByRobots } from "@/lib/crawler/robots";
import { ProjectConfigSchema } from "@/lib/schemas/project";
import {
  commonTextRatio,
  needsTextRepair,
  normalizeExtractedText,
  salvageReadableText,
} from "@/lib/crawler/text-normalize";

describe("normalizeUrl", () => {
  it("strips tracking params and hash", () => {
    const n = normalizeUrl(
      "https://ebmetal.us/products?utm_source=x&id=1#section",
    );
    expect(n).toBe("https://ebmetal.us/products?id=1");
  });

  it("rejects non-http", () => {
    expect(normalizeUrl("javascript:alert(1)")).toBeNull();
  });

  it("collapses www to apex by default", () => {
    expect(normalizeUrl("https://www.ebmetal.us/x")).toBe(
      "https://ebmetal.us/x",
    );
  });
});

describe("hostAllowed", () => {
  it("allows approved hosts", () => {
    expect(
      hostAllowed("https://www.ebmetal.us/x", ["ebmetal.us", "www.ebmetal.us"]),
    ).toBe(true);
    expect(hostAllowed("https://other.com", ["ebmetal.us"])).toBe(false);
  });
});

describe("shouldSkipPath", () => {
  it("skips admin and assets", () => {
    expect(shouldSkipPath("https://ebmetal.us/wp-admin/")).toBe(true);
    expect(shouldSkipPath("https://ebmetal.us/logo.png")).toBe(true);
    expect(shouldSkipPath("https://ebmetal.us/products")).toBe(false);
  });
});

describe("fileTypeFromHref", () => {
  it("detects pdf", () => {
    expect(fileTypeFromHref("https://x.com/a/b.PDF")).toBe("pdf");
  });
});

describe("robots", () => {
  it("parses allow-all yoast style", () => {
    const rules = parseRobotsTxt(`User-agent: *\nDisallow:\nSitemap: https://ebmetal.us/sitemap_index.xml\n`);
    expect(rules.allowAll).toBe(true);
    expect(rules.sitemapUrls[0]).toContain("sitemap");
    expect(isAllowedByRobots("https://ebmetal.us/anything", rules)).toBe(true);
  });
});

describe("ProjectConfigSchema", () => {
  it("parses valid config", () => {
    const cfg = ProjectConfigSchema.parse({
      name: "EB Metal US",
      slug: "eb-metal",
      websiteUrl: "https://www.ebmetal.us/",
      industry: "Cold-formed steel framing",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
    expect(cfg.maxCrawlPages).toBe(75);
  });
});

describe("normalizeExtractedText", () => {
  it("keeps clean English copy", () => {
    const n = normalizeExtractedText(
      "EB Metal US is a full line lightweight steel framing manufacturer.",
    );
    expect(n.ok).toBe(true);
    expect(n.text).toContain("lightweight steel framing");
    expect(n.commonTextRatio).toBeGreaterThan(0.95);
  });

  it("salvages readable copy after binary prefix", () => {
    const garbage =
      "b>j)΄!Pԫ&;\"kB޶}pSVT(wę!j x;-m@JnQ+պכ7MajfJͱ4jѲ撆RxZMz7vIW/dٞТזcZM~jiߒsQzԠ";
    const good =
      "About EB Metal US EB Metal US is a full line lightweight steel framing manufacturer and fabricator with locations in Bow NH.";
    const n = normalizeExtractedText(`${garbage} ${good}`);
    expect(n.ok).toBe(true);
    expect(n.issues).toContain("salvaged_readable_text");
    expect(n.text).toContain("lightweight steel framing");
    expect(n.text).not.toMatch(/޶/);
  });

  it("rejects pure binary-looking content", () => {
    const n = normalizeExtractedText("b>j)΄!Pԫ&kB޶}pSVTպכѲ撆ٞТזߒԠ委应ܢ");
    expect(n.ok).toBe(false);
    expect(n.rawPreserved).toBe(true);
  });

  it("flags summaries that still need repair", () => {
    expect(needsTextRepair("[text extraction failed]")).toBe(true);
    expect(
      needsTextRepair(
        "EB Metal US is a full line lightweight steel framing manufacturer.",
      ),
    ).toBe(false);
  });
});

describe("salvageReadableText", () => {
  it("raises common-text ratio after salvage", () => {
    const mixed =
      "ב՞ߒԠ委应ܢF[ Technical Support: 855-932-6382 Home About EB Metal US EB Metal US is a full line lightweight steel framing manufacturer.";
    const s = salvageReadableText(mixed);
    expect(s.salvaged).toBe(true);
    expect(commonTextRatio(s.text)).toBeGreaterThan(commonTextRatio(mixed));
  });
});
