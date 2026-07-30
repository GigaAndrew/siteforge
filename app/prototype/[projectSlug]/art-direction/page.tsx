import { fileExists, readProjectConfig } from "@/lib/project";
import { readDesignTokens, readTextArtifact } from "@/lib/project-server";
import { notFound } from "next/navigation";
import Link from "next/link";

type Props = { params: Promise<{ projectSlug: string }> };

export default async function ArtDirectionPage({ params }: Props) {
  const { projectSlug } = await params;
  if (!fileExists(projectSlug, "config.json")) notFound();
  const config = readProjectConfig(projectSlug);
  const tokens = readDesignTokens(projectSlug);
  const art = readTextArtifact(projectSlug, "design/art-direction.md");
  const copy = readTextArtifact(projectSlug, "design/prototype-copy.md");
  const color = (tokens?.color ?? {}) as Record<string, string>;

  return (
    <main className="mx-auto w-full max-w-5xl flex-1 px-6 py-10">
      <div className="mb-6 flex items-center justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-[0.14em] text-zinc-500">Gate 4</p>
          <h1 className="text-3xl font-semibold text-zinc-900">
            Art direction — {config.name}
          </h1>
        </div>
        <Link href={`/prototype/${projectSlug}/design-system`} className="text-sm underline">
          Design system →
        </Link>
      </div>

      {!tokens ? (
        <p className="text-sm text-zinc-600">
          Tokens not generated yet. Run <code>npm run project:strategy -- --slug {projectSlug}</code>.
        </p>
      ) : (
        <>
          <section className="mb-8">
            <h2 className="text-lg font-semibold">Color</h2>
            <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4 md:grid-cols-6">
              {Object.entries(color).map(([name, value]) => (
                <div key={name} className="overflow-hidden rounded border border-zinc-200">
                  <div className="h-16" style={{ background: value }} />
                  <div className="px-2 py-1.5 text-xs">
                    <div className="font-medium">{name}</div>
                    <div className="font-mono text-zinc-500">{value}</div>
                  </div>
                </div>
              ))}
            </div>
          </section>
          <section className="grid gap-6 md:grid-cols-2">
            <pre className="overflow-auto whitespace-pre-wrap rounded border border-zinc-200 bg-white p-4 text-xs">
              {art ?? "Missing art-direction.md"}
            </pre>
            <pre className="overflow-auto whitespace-pre-wrap rounded border border-zinc-200 bg-white p-4 text-xs">
              {copy ?? "Missing prototype-copy.md"}
            </pre>
          </section>
        </>
      )}
    </main>
  );
}
