import { NextResponse } from "next/server";
import {
  ensureProjectDirs,
  hostsFromUrl,
  listProjectSlugs,
  projectPath,
  slugify,
  writeProjectConfig,
} from "@/lib/project";
import { writeProjectStatus } from "@/lib/status";
import {
  ModuleOptionSchema,
  PrototypeDepthSchema,
} from "@/lib/schemas/project";
import fs from "node:fs";
import { z } from "zod";

const BodySchema = z.object({
  name: z.string().min(1),
  websiteUrl: z.string().url(),
  industry: z.string().min(1),
  slug: z.string().optional(),
  maxCrawlPages: z.number().int().positive().max(200).default(75),
  prototypeDepth: PrototypeDepthSchema.default(
    "website_plus_interactive_tools",
  ),
  modules: z.array(ModuleOptionSchema).default([]),
  notes: z.string().default(""),
});

export async function GET() {
  return NextResponse.json({ slugs: listProjectSlugs() });
}

export async function POST(request: Request) {
  try {
    const json = await request.json();
    const body = BodySchema.parse(json);
    const slug = body.slug && body.slug.length > 0 ? body.slug : slugify(body.name);

    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) {
      return NextResponse.json({ error: "Invalid slug" }, { status: 400 });
    }
    if (fs.existsSync(projectPath(slug, "config.json"))) {
      return NextResponse.json({ error: "Project already exists" }, { status: 409 });
    }

    const now = new Date().toISOString();
    ensureProjectDirs(slug);
    writeProjectConfig({
      name: body.name,
      slug,
      websiteUrl: body.websiteUrl,
      approvedHosts: hostsFromUrl(body.websiteUrl),
      industry: body.industry,
      maxCrawlPages: body.maxCrawlPages,
      crawlDelayMs: 750,
      prototypeDepth: body.prototypeDepth,
      modules: body.modules,
      notes: body.notes,
      stage: "created",
      createdAt: now,
      updatedAt: now,
    });
    writeProjectStatus(slug, {
      currentPhase: "created",
      completedArtifacts: ["config.json", "project-status.md"],
      blockers: [],
      openQuestions: [],
      qaFailures: [],
      requiredRevisions: [],
      approvedGates: [],
    });

    return NextResponse.json({ slug }, { status: 201 });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Invalid request" },
      { status: 400 },
    );
  }
}
