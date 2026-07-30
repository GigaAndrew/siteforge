"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

const DEPTHS = [
  "audit_only",
  "homepage_concept",
  "core_website_concept",
  "website_plus_interactive_tools",
  "full_digital_platform_concept",
] as const;

const MODULES = [
  "product_catalog",
  "product_detail",
  "calculator",
  "document_center",
  "submittal_builder",
  "distributor_locator",
  "project_workspace",
  "contact_workflow",
  "ai_search_concept",
] as const;

export function CreateProjectForm() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [modules, setModules] = useState<string[]>([
    "product_catalog",
    "product_detail",
    "calculator",
    "document_center",
    "submittal_builder",
    "distributor_locator",
    "contact_workflow",
  ]);

  function toggleModule(mod: string) {
    setModules((prev) =>
      prev.includes(mod) ? prev.filter((m) => m !== mod) : [...prev, mod],
    );
  }

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const form = new FormData(e.currentTarget);
    const payload = {
      name: String(form.get("name") || ""),
      websiteUrl: String(form.get("websiteUrl") || ""),
      industry: String(form.get("industry") || ""),
      slug: String(form.get("slug") || ""),
      maxCrawlPages: Number(form.get("maxCrawlPages") || 75),
      prototypeDepth: String(form.get("prototypeDepth") || DEPTHS[3]),
      modules,
      notes: String(form.get("notes") || ""),
    };

    startTransition(async () => {
      const res = await fetch("/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = (await res.json()) as { error?: string; slug?: string };
      if (!res.ok) {
        setError(data.error || "Failed to create project");
        return;
      }
      router.push(`/projects/${data.slug}`);
      router.refresh();
    });
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4 rounded border border-zinc-300 bg-white p-5">
      <h2 className="text-lg font-semibold text-zinc-900">Create project</h2>
      {error ? (
        <p className="rounded border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-800" role="alert">
          {error}
        </p>
      ) : null}
      <div className="grid gap-4 md:grid-cols-2">
        <label className="block text-sm">
          <span className="mb-1 block font-medium text-zinc-800">Company name</span>
          <input name="name" required className="w-full rounded border border-zinc-300 px-3 py-2" />
        </label>
        <label className="block text-sm">
          <span className="mb-1 block font-medium text-zinc-800">Website URL</span>
          <input name="websiteUrl" type="url" required placeholder="https://" className="w-full rounded border border-zinc-300 px-3 py-2" />
        </label>
        <label className="block text-sm">
          <span className="mb-1 block font-medium text-zinc-800">Industry</span>
          <input name="industry" required className="w-full rounded border border-zinc-300 px-3 py-2" />
        </label>
        <label className="block text-sm">
          <span className="mb-1 block font-medium text-zinc-800">Project slug</span>
          <input name="slug" pattern="[a-z0-9]+(?:-[a-z0-9]+)*" placeholder="eb-metal" className="w-full rounded border border-zinc-300 px-3 py-2" />
        </label>
        <label className="block text-sm">
          <span className="mb-1 block font-medium text-zinc-800">Max crawl pages</span>
          <input name="maxCrawlPages" type="number" min={1} max={200} defaultValue={75} className="w-full rounded border border-zinc-300 px-3 py-2" />
        </label>
        <label className="block text-sm">
          <span className="mb-1 block font-medium text-zinc-800">Prototype depth</span>
          <select name="prototypeDepth" defaultValue={DEPTHS[3]} className="w-full rounded border border-zinc-300 px-3 py-2">
            {DEPTHS.map((d) => (
              <option key={d} value={d}>{d}</option>
            ))}
          </select>
        </label>
      </div>
      <fieldset>
        <legend className="mb-2 text-sm font-medium text-zinc-800">Desired modules</legend>
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {MODULES.map((mod) => (
            <label key={mod} className="flex items-center gap-2 text-sm text-zinc-700">
              <input
                type="checkbox"
                checked={modules.includes(mod)}
                onChange={() => toggleModule(mod)}
              />
              {mod}
            </label>
          ))}
        </div>
      </fieldset>
      <label className="block text-sm">
        <span className="mb-1 block font-medium text-zinc-800">Notes</span>
        <textarea name="notes" rows={3} className="w-full rounded border border-zinc-300 px-3 py-2" />
      </label>
      <button
        type="submit"
        disabled={pending}
        className="rounded bg-zinc-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
      >
        {pending ? "Creating…" : "Create project"}
      </button>
    </form>
  );
}
