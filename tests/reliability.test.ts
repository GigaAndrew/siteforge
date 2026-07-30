import { describe, expect, it } from "vitest";
import { normalizeUrl } from "@/lib/crawler/normalize";
import {
  normalizeExtractedText,
  printableRatio,
} from "@/lib/crawler/text-normalize";
import {
  classifySourceReliability,
  weightedRecommendationConfidence,
  DEFAULT_RELIABILITY_WEIGHTS,
} from "@/lib/reliability/scores";

describe("URL canonicalization", () => {
  it("collapses www to preferred apex and https", () => {
    const n = normalizeUrl("http://www.ebmetal.us/products/", undefined, {
      preferredHost: "ebmetal.us",
    });
    expect(n).toBe("https://ebmetal.us/products");
  });
});

describe("text normalize", () => {
  it("accepts clean text", () => {
    const r = normalizeExtractedText("EB Metal manufactures steel framing.");
    expect(r.ok).toBe(true);
    expect(r.text).toContain("EB Metal");
  });

  it("rejects NUL-heavy binary-like content", () => {
    const raw = `hello\0\0\0\0\0\0\0\0\0\0world`;
    const r = normalizeExtractedText(raw);
    expect(r.ok).toBe(false);
    expect(r.issues).toContain("likely_binary_or_compressed");
    expect(r.rawPreserved).toBe(true);
  });

  it("does not false-positive on normal unicode prose", () => {
    const r = normalizeExtractedText(
      "EB Metal US is a full line lightweight steel framing manufacturer in Bow NH.",
    );
    expect(r.ok).toBe(true);
    expect(r.issues).not.toContain("likely_binary_or_compressed");
    expect(printableRatio(r.text)).toBeGreaterThan(0.9);
  });
});

describe("forge reliability", () => {
  it("scores engineering table PDF highly", () => {
    const a = classifySourceReliability({
      url: "https://example.com/limiting-height-tables.pdf",
      fileType: "pdf",
      title: "Limiting Height Tables",
    });
    expect(a.sourceClass).toBe("engineering_table_pdf");
    expect(a.reliabilityScore).toBe(
      DEFAULT_RELIABILITY_WEIGHTS.engineering_table_pdf,
    );
  });

  it("scores homepage lower than product page", () => {
    const home = classifySourceReliability({ url: "https://example.com/" });
    const product = classifySourceReliability({
      url: "https://example.com/products/nitrostud",
      title: "NITROSTUD",
    });
    expect(home.reliabilityScore).toBeLessThan(product.reliabilityScore);
  });

  it("computes weighted recommendation confidence", () => {
    const w = weightedRecommendationConfidence([
      { confidence: "high", reliabilityScore: 0.6 },
      { confidence: "medium", reliabilityScore: 0.95 },
    ]);
    expect(w.score).toBeGreaterThan(0);
    expect(["high", "medium", "low"]).toContain(w.label);
  });
});
