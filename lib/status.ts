import fs from "node:fs";
import { projectPath } from "@/lib/project";

export type StatusSection = {
  currentPhase: string;
  completedArtifacts: string[];
  blockers: string[];
  openQuestions: string[];
  qaFailures: string[];
  requiredRevisions: string[];
  approvedGates: string[];
};

const EMPTY: StatusSection = {
  currentPhase: "created",
  completedArtifacts: [],
  blockers: [],
  openQuestions: [],
  qaFailures: [],
  requiredRevisions: [],
  approvedGates: [],
};

function renderStatus(slug: string, status: StatusSection): string {
  const list = (items: string[]) =>
    items.length ? items.map((i) => `- ${i}`).join("\n") : "- None";

  return `# Project status: ${slug}

## Current phase
${status.currentPhase}

## Completed artifacts
${list(status.completedArtifacts)}

## Blockers
${list(status.blockers)}

## Open questions
${list(status.openQuestions)}

## QA failures
${list(status.qaFailures)}

## Required revisions
${list(status.requiredRevisions)}

## Approved gates
${list(status.approvedGates)}

## Last updated
${new Date().toISOString()}
`;
}

export function writeProjectStatus(slug: string, status: Partial<StatusSection>): void {
  const merged: StatusSection = { ...EMPTY, ...status };
  fs.writeFileSync(
    projectPath(slug, "project-status.md"),
    renderStatus(slug, merged),
    "utf8",
  );
}

export function appendStatusNote(slug: string, note: string): void {
  const file = projectPath(slug, "project-status.md");
  const existing = fs.existsSync(file) ? fs.readFileSync(file, "utf8") : "";
  fs.writeFileSync(
    file,
    `${existing.trim()}\n\n### Session note\n${note}\n`,
    "utf8",
  );
}
