import Link from "next/link";
import { fileExists, readProjectConfig } from "@/lib/project";
import { notFound } from "next/navigation";

type Props = { params: Promise<{ projectSlug: string }> };

export default async function PrototypeHubPage({ params }: Props) {
  const { projectSlug } = await params;
  if (!fileExists(projectSlug, "config.json")) notFound();
  const config = readProjectConfig(projectSlug);

  return (
    <main className="mx-auto w-full max-w-3xl flex-1 px-6 py-10">
      <h1 className="text-3xl font-semibold text-zinc-900">
        Prototype — {config.name}
      </h1>
      <p className="mt-2 text-sm text-zinc-600">
        Full interactive routes unlock after Gate 5 design-system visual QA.
      </p>
      <ul className="mt-6 space-y-2 text-sm">
        <li>
          <Link className="underline" href={`/prototype/${projectSlug}/art-direction`}>
            Art direction preview
          </Link>
        </li>
        <li>
          <Link className="underline" href={`/prototype/${projectSlug}/design-system`}>
            Design system
          </Link>
        </li>
      </ul>
      <p className="mt-10 text-xs text-zinc-500">
        Unofficial redesign concept prepared for private business-development
        discussion. Not affiliated with or endorsed by the referenced company.
      </p>
    </main>
  );
}
