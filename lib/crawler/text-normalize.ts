export type TextNormalizeResult = {
  text: string;
  ok: boolean;
  printableRatio: number;
  commonTextRatio: number;
  issues: string[];
  confidencePenalty: number;
  rawPreserved: boolean;
};

/** Decode common HTML entities without pulling in a heavy dependency. */
export function decodeBasicHtmlEntities(input: string): string {
  return input
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&#x([0-9a-f]+);/gi, (_, h: string) => {
      try {
        return String.fromCodePoint(Number.parseInt(h, 16));
      } catch {
        return "";
      }
    })
    .replace(/&#(\d+);/g, (_, d: string) => {
      try {
        return String.fromCodePoint(Number.parseInt(d, 10));
      } catch {
        return "";
      }
    });
}

/** Printable Unicode (excludes C0/C1 controls). Binary-looking pages can still score high. */
export function printableRatio(text: string): number {
  if (!text.length) return 1;
  let printable = 0;
  for (const ch of text) {
    const code = ch.codePointAt(0) ?? 0;
    if (
      code === 9 ||
      code === 10 ||
      code === 13 ||
      (code >= 32 && code !== 127)
    ) {
      printable += 1;
    }
  }
  return printable / text.length;
}

/**
 * Ratio of characters typical of manufacturer English/Latin web copy.
 * High CJK/Cyrillic/private-use density usually means mojibake or binary bleed.
 */
export function commonTextRatio(text: string): number {
  if (!text.length) return 1;
  let common = 0;
  for (const ch of text) {
    const code = ch.codePointAt(0) ?? 0;
    if (
      code === 9 ||
      code === 10 ||
      code === 13 ||
      (code >= 32 && code <= 126) ||
      // Latin-1 supplement letters / common Western European
      (code >= 0xc0 && code <= 0xff && code !== 0xd7 && code !== 0xf7) ||
      // common typographic punctuation
      code === 0x2013 ||
      code === 0x2014 ||
      code === 0x2018 ||
      code === 0x2019 ||
      code === 0x201c ||
      code === 0x201d ||
      code === 0x2026 ||
      code === 0x00a0
    ) {
      common += 1;
    }
  }
  return common / text.length;
}

function hasReplacementChar(text: string): boolean {
  return text.includes("\uFFFD");
}

function hasControlChars(text: string): boolean {
  for (const ch of text) {
    const code = ch.codePointAt(0) ?? 0;
    if (
      (code >= 0 && code <= 8) ||
      code === 0xb ||
      code === 0xc ||
      (code >= 0xe && code <= 0x1f) ||
      code === 0x7f
    ) {
      return true;
    }
  }
  return false;
}

function stripControlChars(text: string): string {
  let out = "";
  for (const ch of text) {
    const code = ch.codePointAt(0) ?? 0;
    if (
      (code >= 0 && code <= 8) ||
      code === 0xb ||
      code === 0xc ||
      (code >= 0xe && code <= 0x1f) ||
      code === 0x7f
    ) {
      continue;
    }
    out += ch;
  }
  return out;
}

/** Rare outside US manufacturer marketing/engineering English. */
export function uncommonCharRatio(text: string): number {
  if (!text.length) return 0;
  let uncommon = 0;
  for (const ch of text) {
    const code = ch.codePointAt(0) ?? 0;
    const common =
      code === 9 ||
      code === 10 ||
      code === 13 ||
      (code >= 32 && code <= 126) ||
      (code >= 0xc0 && code <= 0xff && code !== 0xd7 && code !== 0xf7) ||
      code === 0x2013 ||
      code === 0x2014 ||
      code === 0x2018 ||
      code === 0x2019 ||
      code === 0x201c ||
      code === 0x201d ||
      code === 0x2026 ||
      code === 0x00a0;
    if (!common) uncommon += 1;
  }
  return uncommon / text.length;
}

export function isEnglishLikeToken(tok: string): boolean {
  if (!tok) return false;
  if (/^[\d$€£¥%+./:-]+$/.test(tok)) return true;
  if (/^(?:https?:\/\/|www\.)\S+$/i.test(tok)) return true;
  if (/^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/.test(tok)) return true;
  if (/^[A-Za-z][A-Za-z0-9'’&+./-]{0,40}[A-Za-z0-9]?[.:;,!?]?$/.test(tok)) {
    return true;
  }
  if (["&", "-", "—", "/", "|", "•", "(", ")", "[", "]"].includes(tok)) {
    return true;
  }
  return false;
}

/**
 * Drop leading/trailing binary or mojibake bleed; keep readable English span.
 * Used when compressed/corrupt bytes inject opaque content into body text.
 */
export function salvageReadableText(text: string): {
  text: string;
  salvaged: boolean;
} {
  if (!text.length) return { text, salvaged: false };

  const head = text.slice(0, Math.min(240, text.length));
  const needsSalvage =
    uncommonCharRatio(head) >= 0.08 ||
    uncommonCharRatio(text) >= 0.04 ||
    commonTextRatio(head) < 0.9;

  if (!needsSalvage) return { text, salvaged: false };

  const tokens = text.split(/\s+/).filter(Boolean);
  if (tokens.length < 6) return { text, salvaged: false };

  const flags = tokens.map(isEnglishLikeToken);
  let onset = -1;
  for (let i = 0; i <= flags.length - 5; i++) {
    const window = flags.slice(i, i + 5);
    const good = window.filter(Boolean).length;
    if (good >= 4) {
      onset = i;
      break;
    }
  }

  if (onset < 0) {
    // Fall back: first strong English phrase anchors
    const anchors = [
      /About\s+[A-Z]/i,
      /Technical Support/i,
      /REQUEST A SUBMITTAL/i,
      /\bHome\b.*\bProducts\b/i,
      /[A-Z][a-z]+(?:\s+[A-Z][a-z]+){2,}\s+is\s+a\b/,
    ];
    for (const re of anchors) {
      const m = re.exec(text);
      if (m && m.index !== undefined) {
        const sliced = text.slice(m.index).replace(/\s+/g, " ").trim();
        if (sliced.length >= 40) return { text: sliced, salvaged: true };
      }
    }
    return { text, salvaged: false };
  }

  // Drop a few leading weak tokens after onset
  let start = onset;
  while (start < flags.length && !flags[start]) start += 1;

  const salvaged = tokens
    .slice(start)
    .filter((tok, idx) => {
      // keep short connectors; drop long non-english islands
      if (tok.length <= 2) return true;
      return flags[start + idx] || commonTextRatio(tok) >= 0.85;
    })
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();

  if (
    salvaged.length >= 40 &&
    uncommonCharRatio(salvaged) < uncommonCharRatio(text) &&
    commonTextRatio(salvaged) >= 0.9
  ) {
    return { text: salvaged, salvaged: true };
  }

  return { text, salvaged: false };
}

/**
 * Normalize extracted text before inventories/knowledge.
 * On failure: preserve raw, log issues, apply confidence penalty.
 */
export function normalizeExtractedText(
  input: string,
  opts: { maxLength?: number } = {},
): TextNormalizeResult {
  const raw = input ?? "";
  const issues: string[] = [];
  let text = raw;

  if (hasReplacementChar(text)) {
    issues.push("replacement_chars");
    text = text.replaceAll("\uFFFD", "");
  }

  // Strip BOM / zero-width / bidi controls
  text = text
    .replace(/^\uFEFF/, "")
    .replace(/[\u200B-\u200D\u2060\uFEFF]/g, "")
    .replace(/[\u202A-\u202E\u2066-\u2069]/g, "");

  if (hasControlChars(text)) {
    issues.push("control_characters");
    text = stripControlChars(text);
  }

  text = decodeBasicHtmlEntities(text);
  text = text.replace(/\s+/g, " ").trim();

  const ratio = printableRatio(text);
  let common = commonTextRatio(text);
  let uncommon = uncommonCharRatio(text);
  const headUncommon = uncommonCharRatio(text.slice(0, Math.min(240, text.length)));

  if (ratio < 0.7) {
    issues.push("low_printable_ratio");
  }
  if (common < 0.85 && text.length > 20) {
    issues.push("low_common_text_ratio");
  }
  if (headUncommon >= 0.08 || uncommon >= 0.04) {
    issues.push("uncommon_unicode_density");
  }

  let hasNul = false;
  for (const ch of raw) {
    if ((ch.codePointAt(0) ?? 0) === 0) {
      hasNul = true;
      break;
    }
  }
  if (hasNul || ratio < 0.5) {
    issues.push("likely_binary_or_compressed");
  }

  if (
    issues.includes("low_common_text_ratio") ||
    issues.includes("control_characters") ||
    issues.includes("uncommon_unicode_density")
  ) {
    const salvaged = salvageReadableText(text);
    if (salvaged.salvaged) {
      text = salvaged.text;
      common = commonTextRatio(text);
      uncommon = uncommonCharRatio(text);
      issues.push("salvaged_readable_text");
      for (const clear of [
        "low_common_text_ratio",
        "uncommon_unicode_density",
        "control_characters",
      ] as const) {
        const idx = issues.indexOf(clear);
        if (idx >= 0 && uncommon < 0.02 && common >= 0.9) issues.splice(idx, 1);
      }
    }
  }

  const fatal =
    issues.includes("likely_binary_or_compressed") ||
    (common < 0.7 && text.length > 20) ||
    (uncommon >= 0.08 && !issues.includes("salvaged_readable_text")) ||
    ratio < 0.5;

  const ok = !fatal && common >= 0.75 && ratio >= 0.7 && uncommon < 0.05;
  let confidencePenalty = 0;
  if (!ok) confidencePenalty = 0.35;
  else if (issues.includes("salvaged_readable_text")) confidencePenalty = 0.12;
  else if (issues.length) confidencePenalty = 0.1;

  if (!ok) {
    return {
      text: "",
      ok: false,
      printableRatio: ratio,
      commonTextRatio: common,
      issues,
      confidencePenalty,
      rawPreserved: true,
    };
  }

  const max = opts.maxLength ?? 10_000;
  if (text.length > max) text = `${text.slice(0, max)}…`;

  return {
    text,
    ok: true,
    printableRatio: ratio,
    commonTextRatio: common,
    issues,
    confidencePenalty,
    rawPreserved: false,
  };
}

export function degradeConfidence(
  base: "high" | "medium" | "low",
  penalty: number,
): "high" | "medium" | "low" {
  if (penalty >= 0.3) return "low";
  if (penalty >= 0.1) {
    if (base === "high") return "medium";
    return "low";
  }
  return base;
}

/** True when stored summary looks like failed/binary extraction and should be re-fetched. */
export function needsTextRepair(summary: string | undefined | null): boolean {
  if (!summary) return true;
  if (summary.startsWith("[text extraction failed")) return true;
  const n = normalizeExtractedText(summary, { maxLength: 2000 });
  return !n.ok || n.issues.includes("salvaged_readable_text") || n.commonTextRatio < 0.9;
}
