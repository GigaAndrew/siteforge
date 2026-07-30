/**
 * URL normalization helpers for same-domain cutting.
 */

const TRACKING_PARAMS = new Set([
  "utm_source",
  "utm_medium",
  "utm_campaign",
  "utm_term",
  "utm_content",
  "gclid",
  "fbclid",
  "mc_cid",
  "mc_eid",
  "_ga",
  "ref",
  "source",
]);

const SKIP_PATH_PATTERNS = [
  /\/wp-admin/i,
  /\/wp-login/i,
  /\/login/i,
  /\/logout/i,
  /\/account/i,
  /\/cart/i,
  /\/checkout/i,
  /\/my-account/i,
  /\/feed\/?$/i,
  /\/xmlrpc\.php/i,
  /\.(jpg|jpeg|png|gif|webp|svg|css|js|ico|woff2?)(\?|$)/i,
];

export type CanonicalizeOptions = {
  /** Preferred hostname, e.g. ebmetal.us (apex) */
  preferredHost?: string;
  /** Force https when host is approved */
  preferHttps?: boolean;
};

export function pickPreferredHost(approvedHosts: string[]): string | undefined {
  if (!approvedHosts.length) return undefined;
  const apex = approvedHosts.find((h) => !h.toLowerCase().startsWith("www."));
  return (apex ?? approvedHosts[0])?.toLowerCase();
}

export function normalizeUrl(
  raw: string,
  base?: string,
  opts: CanonicalizeOptions = {},
): string | null {
  try {
    const url = new URL(raw, base);
    if (!["http:", "https:"].includes(url.protocol)) return null;

    if (opts.preferHttps !== false) {
      url.protocol = "https:";
    }

    // Strip fragment/anchors
    url.hash = "";

    // www vs apex
    if (opts.preferredHost) {
      const host = url.hostname.toLowerCase();
      const preferred = opts.preferredHost.toLowerCase();
      const hostBare = host.replace(/^www\./, "");
      const prefBare = preferred.replace(/^www\./, "");
      if (hostBare === prefBare) {
        url.hostname = preferred;
      }
    } else {
      // default: collapse www → apex
      if (url.hostname.toLowerCase().startsWith("www.")) {
        url.hostname = url.hostname.slice(4);
      }
    }

    const params = new URLSearchParams(url.search);
    for (const key of [...params.keys()]) {
      if (TRACKING_PARAMS.has(key.toLowerCase())) params.delete(key);
    }
    url.search = params.toString() ? `?${params.toString()}` : "";

    if (url.pathname !== "/" && url.pathname.endsWith("/")) {
      url.pathname = url.pathname.slice(0, -1);
    }

    return url.toString();
  } catch {
    return null;
  }
}

export function hostAllowed(url: string, approvedHosts: string[]): boolean {
  try {
    const host = new URL(url).hostname.toLowerCase().replace(/^www\./, "");
    return approvedHosts
      .map((h) => h.toLowerCase().replace(/^www\./, ""))
      .includes(host);
  } catch {
    return false;
  }
}

export function shouldSkipPath(url: string): boolean {
  try {
    const { pathname } = new URL(url);
    return SKIP_PATH_PATTERNS.some((re) => re.test(pathname));
  } catch {
    return true;
  }
}

export function isDocumentHref(href: string): boolean {
  return /\.(pdf|docx?|xlsx?|csv|dwg|dxf|rvt|ifc)(\?|$)/i.test(href);
}

export function fileTypeFromHref(href: string):
  | "pdf"
  | "doc"
  | "docx"
  | "xls"
  | "xlsx"
  | "csv"
  | "dwg"
  | "dxf"
  | "rvt"
  | "ifc"
  | "other" {
  const m = href.toLowerCase().match(/\.([a-z0-9]+)(?:\?|$)/);
  const ext = m?.[1];
  switch (ext) {
    case "pdf":
      return "pdf";
    case "doc":
      return "doc";
    case "docx":
      return "docx";
    case "xls":
      return "xls";
    case "xlsx":
      return "xlsx";
    case "csv":
      return "csv";
    case "dwg":
      return "dwg";
    case "dxf":
      return "dxf";
    case "rvt":
      return "rvt";
    case "ifc":
      return "ifc";
    default:
      return "other";
  }
}

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function classifyFetchError(message: string): {
  retryable: boolean;
  kind: "redirect_loop" | "timeout" | "rate_limit" | "download" | "http" | "other";
} {
  const m = message.toLowerCase();
  if (/download is starting/.test(m)) return { retryable: false, kind: "download" };
  if (/429|rate.?limit|too many requests/.test(m))
    return { retryable: true, kind: "rate_limit" };
  if (/timeout|timed out|net::err_timed_out/.test(m))
    return { retryable: true, kind: "timeout" };
  if (/redirect/.test(m)) return { retryable: true, kind: "redirect_loop" };
  if (/net::err_|econnreset|socket/.test(m)) return { retryable: true, kind: "other" };
  return { retryable: false, kind: "other" };
}
