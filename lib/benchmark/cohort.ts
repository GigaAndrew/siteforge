import { listProjectSlugs, readProjectConfig } from "@/lib/project";
import { isSyntheticFixture } from "@/lib/benchmark/observe";

/**
 * Live cohort selection — excludes synthetic fixtures by default.
 */
export function listLiveProjectSlugs(): string[] {
  return listProjectSlugs().filter((slug) => !isSyntheticFixture(slug));
}

export function listSyntheticProjectSlugs(): string[] {
  return listProjectSlugs().filter((slug) => isSyntheticFixture(slug));
}

export function cohortLabel(slugs: string[]): {
  label: string;
  live: string[];
  synthetic: string[];
  mixed: boolean;
} {
  const live = slugs.filter((s) => !isSyntheticFixture(s));
  const synthetic = slugs.filter((s) => isSyntheticFixture(s));
  const mixed = live.length > 0 && synthetic.length > 0;
  let label: string;
  if (mixed) {
    label =
      "Mixed live+synthetic cohort — synthetic evidence must not be treated as market proof";
  } else if (synthetic.length && !live.length) {
    label = "Synthetic validation cohort — not live market evidence";
  } else if (live.length === 2) {
    label = "Live two-company validation cohort — not an industry benchmark";
  } else if (live.length > 2) {
    label = `Live ${live.length}-company validation cohort — not an industry benchmark`;
  } else {
    label = "Single-company validation run";
  }
  return { label, live, synthetic, mixed };
}

export function describeProjectRole(slug: string): {
  slug: string;
  name: string;
  synthetic: boolean;
  role: "live" | "synthetic_fixture";
} {
  let name = slug;
  try {
    name = readProjectConfig(slug).name;
  } catch {
    /* ignore */
  }
  const synthetic = isSyntheticFixture(slug);
  return {
    slug,
    name,
    synthetic,
    role: synthetic ? "synthetic_fixture" : "live",
  };
}
