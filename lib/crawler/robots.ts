export type RobotsRules = {
  allowAll: boolean;
  disallow: string[];
  sitemapUrls: string[];
};

export async function fetchRobotsTxt(
  origin: string,
): Promise<RobotsRules> {
  try {
    const res = await fetch(new URL("/robots.txt", origin).toString(), {
      redirect: "follow",
      headers: { "User-Agent": "SiteForgeBot/0.1 (+local research)" },
    });
    if (!res.ok) {
      return { allowAll: true, disallow: [], sitemapUrls: [] };
    }
    const text = await res.text();
    return parseRobotsTxt(text);
  } catch {
    return { allowAll: true, disallow: [], sitemapUrls: [] };
  }
}

export function parseRobotsTxt(text: string): RobotsRules {
  const lines = text.split(/\r?\n/);
  let inStar = false;
  const disallow: string[] = [];
  const sitemapUrls: string[] = [];

  for (const raw of lines) {
    const line = raw.split("#")[0]?.trim() ?? "";
    if (!line) continue;
    const [keyRaw, ...rest] = line.split(":");
    const key = keyRaw?.trim().toLowerCase();
    const value = rest.join(":").trim();
    if (key === "user-agent") {
      inStar = value === "*";
    } else if (key === "sitemap" && value) {
      sitemapUrls.push(value);
    } else if (inStar && key === "disallow") {
      if (value) disallow.push(value);
    }
  }

  return {
    allowAll: disallow.length === 0 || (disallow.length === 1 && disallow[0] === ""),
    disallow,
    sitemapUrls,
  };
}

export function isAllowedByRobots(url: string, rules: RobotsRules): boolean {
  if (rules.allowAll) return true;
  try {
    const path = new URL(url).pathname;
    for (const rule of rules.disallow) {
      if (!rule) continue;
      if (path.startsWith(rule)) return false;
    }
    return true;
  } catch {
    return false;
  }
}
