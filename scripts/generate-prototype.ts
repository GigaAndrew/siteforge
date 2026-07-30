#!/usr/bin/env tsx
/**
 * Thin prototype generator (Sprint 3). Full Gate 6 pages remain out of scope.
 */
import { generateThinPrototype } from "@/lib/prototype/thin";

function arg(flag: string): string | undefined {
  const idx = process.argv.indexOf(flag);
  if (idx === -1) return undefined;
  return process.argv[idx + 1];
}

async function main() {
  const slug = arg("--slug");
  if (!slug) {
    console.error("Usage: npm run project:prototype -- --slug <slug>");
    process.exit(1);
  }
  const result = generateThinPrototype(slug);
  if (!result.ok) {
    console.error(result.message);
    process.exit(1);
  }
  console.log(JSON.stringify(result, null, 2));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
