import { CreateProjectForm } from "@/components/siteforge/CreateProjectForm";
import { getProjectSummaries } from "@/lib/project-server";
import Link from "next/link";

export default function HomePage() {
  const projects = getProjectSummaries();

  return (
    <main className="mx-auto w-full max-w-5xl flex-1 px-6 py-10">
      <header className="mb-10 border-b border-zinc-300 pb-6">
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-zinc-500">
          Internal platform
        </p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight text-zinc-900">
          SiteForge
        </h1>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-zinc-600">
          Automated website audit and interactive pitch prototype system for
          manufacturer prospects. Evidence first. Prototype after gates.
        </p>
      </header>

      <section className="mb-10">
        <h2 className="mb-3 text-lg font-semibold text-zinc-900">Projects</h2>
        {projects.length === 0 ? (
          <p className="text-sm text-zinc-600">No projects yet.</p>
        ) : (
          <ul className="divide-y divide-zinc-200 rounded border border-zinc-300 bg-white">
            {projects.map((p) => (
              <li key={p.config.slug} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
                <div>
                  <Link
                    href={`/projects/${p.config.slug}`}
                    className="font-medium text-zinc-900 underline-offset-2 hover:underline"
                  >
                    {p.config.name}
                  </Link>
                  <p className="text-xs text-zinc-500">
                    {p.config.slug} · {p.config.stage} · {p.config.industry}
                  </p>
                </div>
                <div className="flex gap-2 text-xs">
                  <Link
                    href={`/prototype/${p.config.slug}/design-system`}
                    className="rounded border border-zinc-300 px-2 py-1 text-zinc-700"
                  >
                    Design system
                  </Link>
                  <Link
                    href={`/prototype/${p.config.slug}/art-direction`}
                    className="rounded border border-zinc-300 px-2 py-1 text-zinc-700"
                  >
                    Art direction
                  </Link>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <CreateProjectForm />
    </main>
  );
}
