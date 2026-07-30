#!/usr/bin/env tsx
/**
 * Forge Core Runtime CLI
 *
 * siteforge run|pause|resume|status|inspect|graph|history|replay|approve|reject|cancel|reset-node
 */
import fs from "node:fs";
import {
  approve,
  cancelRun,
  getStatus,
  initRun,
  pauseRun,
  reject,
  resetNode,
  resumeRun,
  runUntilPause,
} from "@/forge-core/runtime/controller";
import { ensureCapabilitiesRegistered, listCapabilities } from "@/forge-core/capabilities/registry";
import { readDecisions, readEvents } from "@/forge-core/history/log";
import { loadGraph, loadRunState } from "@/forge-core/state/persist";
import type { ApprovalMode } from "@/forge-core/state/schemas";
import { projectPath } from "@/lib/project";

function arg(flag: string): string | undefined {
  const idx = process.argv.indexOf(flag);
  if (idx === -1) return undefined;
  return process.argv[idx + 1];
}

function usage(): never {
  console.error(`Usage:
  npx tsx scripts/siteforge.ts <command> --slug <slug> [options]

Commands:
  run         Initialize (if needed) and run until pause/complete
  pause       Pause a running/idle run
  resume      Resume after pause or approval
  status      Show run status summary
  inspect     Show capabilities + current node detail
  graph       Print execution graph
  history     Show recent events/decisions
  replay      Print decision log (planner rationale)
  approve     --key strategy.accept|prototype.approve|pitch.approve
  reject      --key <approvalKey>
  cancel      Cancel run
  reset-node  --node <nodeId>
  normalize              --slug <project> [--dry-run] [--rebuild]
  normalization-status   --slug <project>
  normalization-review   --slug <project>
  normalization-confirm  --slug <project> --mapping <id> --concept <id>
  compare                --slugs a,b
  seed-peer              Seed second-manufacturer fixture + normalize
  benchmark-list
  benchmark-inspect      --benchmark <id>
  benchmark-run          --slug <p> | --slugs a,b [--benchmark <id>] [--dry-run] [--rebuild]
  benchmark-rebuild      --slug <p> | --slugs a,b [--benchmark <id>]
  benchmark-status       --slug <project>
  benchmark-report       --slug <project>
  benchmark-compare      --slugs a,b
  benchmark-approve      --key <approvalKey> [--benchmark <id>]
  benchmark-seed

Options:
  --slug <slug>
  --mode auto|mixed|strict
  --goal "..."
  --reset
  --force
  --max-ticks <n>
  --actor <name>
  --reason <text>
`);
  process.exit(1);
}

const NORMALIZATION_COMMANDS = new Set([
  "normalize",
  "normalization-status",
  "normalization-review",
  "normalization-confirm",
  "compare",
  "seed-peer",
]);

const BENCHMARK_COMMANDS = new Set([
  "benchmark-list",
  "benchmark-inspect",
  "benchmark-run",
  "benchmark-rebuild",
  "benchmark-status",
  "benchmark-report",
  "benchmark-compare",
  "benchmark-approve",
  "benchmark-seed",
]);

async function main() {
  const command = process.argv[2];
  if (!command || command.startsWith("--")) usage();

  if (NORMALIZATION_COMMANDS.has(command)) {
    const { runNormalizationCommand } = await import(
      "@/scripts/normalize-knowledge"
    );
    await runNormalizationCommand(command);
    return;
  }

  if (BENCHMARK_COMMANDS.has(command)) {
    const { runBenchmarkCommand } = await import("@/scripts/benchmark");
    await runBenchmarkCommand(command);
    return;
  }

  const slug = arg("--slug");
  if (!slug) {
    console.error("--slug required");
    usage();
  }
  // Validate early (path traversal / invalid identifiers)
  const { assertValidProjectSlug } = await import("@/lib/project");
  assertValidProjectSlug(slug);

  const mode = (arg("--mode") as ApprovalMode | undefined) ?? undefined;
  const maxTicks = arg("--max-ticks") ? Number(arg("--max-ticks")) : undefined;

  switch (command) {
    case "run": {
      // Offline QA is opt-in via SITEFORGE_QA_ALLOW_OFFLINE=1 — never defaulted
      initRun({
        slug,
        approvalMode: mode,
        goal: arg("--goal"),
        reset: process.argv.includes("--reset"),
      });
      const result = await runUntilPause({
        slug,
        approvalMode: mode,
        goal: arg("--goal"),
        maxTicks,
        force: process.argv.includes("--force"),
      });
      console.log(JSON.stringify(result, null, 2));
      if (result.status === "waiting_approval") {
        console.log(
          `\nPaused for approval. Use:\n  npm run siteforge -- approve --slug ${slug} --key <key>\n  npm run siteforge -- resume --slug ${slug}`,
        );
      }
      break;
    }
    case "pause":
      pauseRun(slug, arg("--reason") ?? "user_pause");
      console.log("Paused");
      break;
    case "resume": {
      const result = await resumeRun(slug, { maxTicks });
      console.log(JSON.stringify(result, null, 2));
      break;
    }
    case "status": {
      const s = getStatus(slug);
      console.log(
        JSON.stringify(
          {
            status: s.run?.status,
            currentNodeId: s.run?.currentNodeId,
            pauseReason: s.run?.pauseReason,
            approvalMode: s.run?.approvalMode,
            rationale: s.run?.lastPlannerRationale,
            budgets: s.budgets,
            approvals: s.approvals?.decisions,
            nodes: s.graph?.nodes.map((n) => ({
              id: n.id,
              capability: n.capability,
              status: n.status,
            })),
          },
          null,
          2,
        ),
      );
      break;
    }
    case "inspect": {
      await ensureCapabilitiesRegistered();
      const run = loadRunState(slug);
      const graph = loadGraph(slug);
      const node = graph?.nodes.find((n) => n.id === run?.currentNodeId);
      console.log(
        JSON.stringify(
          {
            run,
            currentNode: node ?? null,
            capabilities: listCapabilities().map((c) => c.descriptor.name),
          },
          null,
          2,
        ),
      );
      break;
    }
    case "graph": {
      const graph = loadGraph(slug);
      if (!graph) {
        console.error("No graph");
        process.exit(1);
      }
      console.log(JSON.stringify(graph, null, 2));
      break;
    }
    case "history": {
      console.log(
        JSON.stringify(
          {
            events: readEvents(slug, 50),
            decisions: readDecisions(slug, 30),
          },
          null,
          2,
        ),
      );
      break;
    }
    case "replay": {
      const decisions = readDecisions(slug, 200);
      for (const d of decisions) {
        console.log(
          `[${d.at}] ${d.action} score=${d.score} node=${d.nodeId ?? "-"} cap=${d.capability ?? "-"}\n  ${d.rationale}`,
        );
      }
      break;
    }
    case "approve": {
      const key = arg("--key");
      if (!key) {
        console.error("--key required");
        process.exit(1);
      }
      approve(slug, key, { actor: arg("--actor"), reason: arg("--reason") });
      console.log(`Approved ${key}`);
      break;
    }
    case "reject": {
      const key = arg("--key");
      if (!key) {
        console.error("--key required");
        process.exit(1);
      }
      reject(slug, key, { actor: arg("--actor"), reason: arg("--reason") });
      console.log(`Rejected ${key}`);
      break;
    }
    case "cancel":
      cancelRun(slug);
      console.log("Cancelled");
      break;
    case "reset-node": {
      const node = arg("--node");
      if (!node) {
        console.error("--node required");
        process.exit(1);
      }
      resetNode(slug, node);
      console.log(`Reset ${node}`);
      break;
    }
    default:
      usage();
  }

  // Ensure runtime dir noted
  if (!fs.existsSync(projectPath(slug, "runtime"))) {
    /* ok */
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
