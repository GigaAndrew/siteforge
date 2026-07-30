import Link from "next/link";
import {
  readProjectConfig,
  fileExists,
  projectPath,
} from "@/lib/project";
import fs from "node:fs";
import { notFound } from "next/navigation";

type Props = { params: Promise<{ projectSlug: string }> };

export default async function ProjectDetailPage({ params }: Props) {
  const { projectSlug } = await params;
  if (!fileExists(projectSlug, "config.json")) notFound();
  const config = readProjectConfig(projectSlug);
  const statusPath = projectPath(projectSlug, "project-status.md");
  const status = fs.existsSync(statusPath)
    ? fs.readFileSync(statusPath, "utf8")
    : "No status file yet.";

  const checks = [
    ["Crawl", fileExists(projectSlug, "source/pages.json")],
    ["Screenshots", fileExists(projectSlug, "screenshots/manifest.json")],
    ["Evidence", fileExists(projectSlug, "analysis/source-evidence.md")],
    ["Audit", fileExists(projectSlug, "analysis/executive-audit.md")],
    ["Strategy", fileExists(projectSlug, "strategy/proposed-sitemap.md")],
    ["Art direction", fileExists(projectSlug, "design/design-tokens.json")],
  ] as const;

  return (
    <main className="mx-auto w-full max-w-4xl flex-1 px-6 py-10">
      <p className="text-xs uppercase tracking-[0.14em] text-zinc-500">Project</p>
      <h1 className="mt-2 text-3xl font-semibold text-zinc-900">{config.name}</h1>
      <p className="mt-1 text-sm text-zinc-600">
        {config.websiteUrl} · {config.industry} · stage: {config.stage}
      </p>

      <div className="mt-6 flex flex-wrap gap-2 text-sm">
        <Link href={`/runtime/${projectSlug}`} className="rounded border border-zinc-300 px-3 py-1.5">
          Runtime dashboard
        </Link>
        <Link href={`/prototype/${projectSlug}`} className="rounded border border-zinc-300 px-3 py-1.5">
          Prototype hub
        </Link>
        <Link href={`/prototype/${projectSlug}/art-direction`} className="rounded border border-zinc-300 px-3 py-1.5">
          Art direction
        </Link>
        <Link href={`/prototype/${projectSlug}/design-system`} className="rounded border border-zinc-300 px-3 py-1.5">
          Design system
        </Link>
        <Link href="/" className="rounded border border-zinc-300 px-3 py-1.5">
          Dashboard
        </Link>
      </div>

      <section className="mt-8">
        <h2 className="text-lg font-semibold">Artifact checklist</h2>
        <ul className="mt-3 grid gap-2 sm:grid-cols-2">
          {checks.map(([label, ok]) => (
            <li key={label} className="rounded border border-zinc-200 px-3 py-2 text-sm">
              <span className={ok ? "text-green-800" : "text-zinc-500"}>
                {ok ? "Ready" : "Pending"} — {label}
              </span>
            </li>
          ))}
        </ul>
      </section>

      <section className="mt-8">
        <h2 className="text-lg font-semibold">CLI</h2>
        <pre className="mt-3 overflow-x-auto rounded border border-zinc-200 bg-zinc-50 p-4 text-xs leading-relaxed text-zinc-800">{`npm run project:crawl -- --slug ${projectSlug}
npm run project:screenshots -- --slug ${projectSlug}
npm run project:audit -- --slug ${projectSlug}
npm run project:strategy -- --slug ${projectSlug}
npm run project:all -- --slug ${projectSlug}`}</pre>
      </section>

      <section className="mt-8">
        <h2 className="text-lg font-semibold">project-status.md</h2>
        <pre className="mt-3 overflow-x-auto whitespace-pre-wrap rounded border border-zinc-200 bg-white p-4 text-xs text-zinc-800">
          {status}
        </pre>
      </section>
    </main>
  );
}
