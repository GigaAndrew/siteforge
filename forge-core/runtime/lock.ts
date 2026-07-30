import fs from "node:fs";
import path from "node:path";
import { projectPath } from "@/lib/project";

const STALE_MS = 5 * 60 * 1000;

export type RuntimeLock = {
  slug: string;
  lockPath: string;
  owner: string;
  acquiredAt: string;
};

/**
 * Minimal exclusive lock for local multi-process safety.
 * Uses O_EXCL create; stale locks older than 5 minutes are broken.
 */
export function acquireRuntimeLock(
  slug: string,
  owner = `pid:${process.pid}`,
): RuntimeLock {
  const lockPath = projectPath(slug, "runtime/.run.lock");
  fs.mkdirSync(path.dirname(lockPath), { recursive: true });

  const tryCreate = () => {
    const fd = fs.openSync(lockPath, "wx");
    const payload = {
      owner,
      acquiredAt: new Date().toISOString(),
      pid: process.pid,
    };
    fs.writeFileSync(fd, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
    fs.closeSync(fd);
    return {
      slug,
      lockPath,
      owner,
      acquiredAt: payload.acquiredAt,
    };
  };

  try {
    return tryCreate();
  } catch (err) {
    const code = (err as NodeJS.ErrnoException).code;
    if (code !== "EEXIST") throw err;
    // Stale lock recovery
    try {
      const raw = JSON.parse(fs.readFileSync(lockPath, "utf8")) as {
        acquiredAt?: string;
        pid?: number;
      };
      const age = raw.acquiredAt
        ? Date.now() - new Date(raw.acquiredAt).getTime()
        : Number.POSITIVE_INFINITY;
      const pidAlive =
        typeof raw.pid === "number"
          ? (() => {
              try {
                process.kill(raw.pid, 0);
                return true;
              } catch {
                return false;
              }
            })()
          : false;
      if (age > STALE_MS || !pidAlive) {
        fs.unlinkSync(lockPath);
        return tryCreate();
      }
    } catch {
      /* fall through */
    }
    throw new Error(
      `Runtime lock held for ${slug}. Another siteforge process may be running. If stuck, delete runtime/.run.lock after confirming no process.`,
    );
  }
}

export function releaseRuntimeLock(lock: RuntimeLock): void {
  try {
    if (fs.existsSync(lock.lockPath)) fs.unlinkSync(lock.lockPath);
  } catch {
    /* ignore */
  }
}

export async function withRuntimeLock<T>(
  slug: string,
  fn: () => Promise<T> | T,
): Promise<T> {
  const lock = acquireRuntimeLock(slug);
  try {
    return await fn();
  } finally {
    releaseRuntimeLock(lock);
  }
}

export function withRuntimeLockSync<T>(slug: string, fn: () => T): T {
  const lock = acquireRuntimeLock(slug);
  try {
    return fn();
  } finally {
    releaseRuntimeLock(lock);
  }
}
