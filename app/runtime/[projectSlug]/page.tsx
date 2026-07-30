import Link from "next/link";
import { notFound } from "next/navigation";
import {
  listProjectSlugs,
  projectPath,
  readJsonFile,
} from "@/lib/project";
import type {
  ApprovalsFile,
  BudgetSnapshot,
  ExecutionGraph,
  RunState,
} from "@/forge-core/state/schemas";
import fs from "node:fs";

type Props = { params: Promise<{ projectSlug: string }> };

function readJsonl(filePath: string, limit = 40): unknown[] {
  if (!fs.existsSync(filePath)) return [];
  return fs
    .readFileSync(filePath, "utf8")
    .split("\n")
    .filter(Boolean)
    .slice(-limit)
    .map((l) => JSON.parse(l));
}

export default async function RuntimeDashboardPage({ params }: Props) {
  const { projectSlug } = await params;
  if (!listProjectSlugs().includes(projectSlug)) notFound();

  const run = readJsonFile<RunState>(
    projectPath(projectSlug, "runtime/run-state.json"),
  );
  const graph = readJsonFile<ExecutionGraph>(
    projectPath(projectSlug, "runtime/execution-graph.json"),
  );
  const budgets = readJsonFile<BudgetSnapshot>(
    projectPath(projectSlug, "runtime/budgets.json"),
  );
  const approvals = readJsonFile<ApprovalsFile>(
    projectPath(projectSlug, "runtime/approvals.json"),
  );
  const events = readJsonl(
    projectPath(projectSlug, "runtime/history/events.jsonl"),
    30,
  );
  const decisions = readJsonl(
    projectPath(projectSlug, "runtime/history/decisions.jsonl"),
    20,
  );

  if (!run || !graph) {
    return (
      <main style={{ padding: 32, fontFamily: "ui-sans-serif, system-ui" }}>
        <h1>Runtime — {projectSlug}</h1>
        <p>No runtime state yet. Run:</p>
        <pre>npm run siteforge -- run --slug {projectSlug}</pre>
        <p>
          <Link href={`/projects/${projectSlug}`}>Back to project</Link>
        </p>
      </main>
    );
  }

  const waiting = approvals?.decisions.filter((d) => d.status === "pending") ?? [];
  const current = graph.nodes.find((n) => n.id === run.currentNodeId);

  return (
    <main
      style={{
        padding: "32px 40px",
        fontFamily: "ui-sans-serif, system-ui",
        maxWidth: 1100,
        margin: "0 auto",
        lineHeight: 1.45,
      }}
    >
      <p style={{ margin: 0 }}>
        <Link href="/">SiteForge</Link> ·{" "}
        <Link href={`/projects/${projectSlug}`}>{projectSlug}</Link> ·{" "}
        <strong>Runtime</strong> (internal)
      </p>
      <h1 style={{ marginTop: 12 }}>Forge Core Runtime — {projectSlug}</h1>

      <section style={{ marginTop: 24 }}>
        <h2>Run status</h2>
        <ul>
          <li>
            Status: <strong>{run.status}</strong>
          </li>
          <li>Mode: {run.approvalMode}</li>
          <li>Current node: {run.currentNodeId ?? "—"}</li>
          <li>Pause reason: {run.pauseReason ?? "—"}</li>
          <li>Active loops: {run.activeLoops.join(", ") || "—"}</li>
        </ul>
        <p>
          <em>Planner:</em> {run.lastPlannerRationale ?? "—"}
        </p>
      </section>

      <section style={{ marginTop: 24 }}>
        <h2>Current node</h2>
        {current ? (
          <pre style={{ background: "#f4f4f5", padding: 12, overflow: "auto" }}>
            {JSON.stringify(current, null, 2)}
          </pre>
        ) : (
          <p>None</p>
        )}
      </section>

      <section style={{ marginTop: 24 }}>
        <h2>Execution graph</h2>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr>
              <th align="left">ID</th>
              <th align="left">Capability</th>
              <th align="left">Status</th>
              <th align="left">Quality</th>
            </tr>
          </thead>
          <tbody>
            {graph.nodes.map((n) => (
              <tr key={n.id} style={{ borderTop: "1px solid #ddd" }}>
                <td>{n.id}</td>
                <td>{n.capability}</td>
                <td>{n.status}</td>
                <td>{n.qualityScore.toFixed(2)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section style={{ marginTop: 24 }}>
        <h2>Quality / approvals</h2>
        <ul>
          {approvals?.decisions.map((d) => (
            <li key={d.key}>
              {d.key}: <strong>{d.status}</strong>
              {d.actor ? ` (${d.actor})` : ""}
            </li>
          ))}
        </ul>
        {waiting.length > 0 && (
          <p>
            Waiting approvals: {waiting.map((w) => w.key).join(", ")}
          </p>
        )}
      </section>

      <section style={{ marginTop: 24 }}>
        <h2>Budgets</h2>
        {budgets ? (
          <ul>
            <li>
              Wall clock: {budgets.wallClockMsUsed} / {budgets.maxWallClockMs} ms
            </li>
            <li>
              Invocations: {budgets.invocationsUsed} / {budgets.maxInvocations}
            </li>
            <li>
              Playwright: {budgets.playwrightLaunchesUsed} /{" "}
              {budgets.maxPlaywrightLaunches}
            </li>
          </ul>
        ) : (
          <p>No budgets</p>
        )}
      </section>

      <section style={{ marginTop: 24 }}>
        <h2>Recent planner decisions</h2>
        <pre style={{ background: "#f4f4f5", padding: 12, overflow: "auto" }}>
          {JSON.stringify(decisions, null, 2)}
        </pre>
      </section>

      <section style={{ marginTop: 24 }}>
        <h2>Event timeline</h2>
        <pre style={{ background: "#f4f4f5", padding: 12, overflow: "auto" }}>
          {JSON.stringify(events, null, 2)}
        </pre>
      </section>
    </main>
  );
}
