import type { CapabilityHandler } from "@/forge-core/capabilities/types";

const handlers = new Map<string, CapabilityHandler>();
let bootstrapped = false;
/** Serializes bootstrap; survives parallel vitest contention. */
let bootstrapPromise: Promise<void> | null = null;
let bootstrapEpoch = 0;

export function registerCapability(handler: CapabilityHandler): void {
  const name = handler.descriptor.name;
  if (!name || !/^[a-z][a-z0-9._-]*$/i.test(name)) {
    throw new Error(`Invalid capability name: ${name}`);
  }
  if (handlers.has(name)) {
    throw new Error(`Duplicate capability registration: ${name}`);
  }
  const normalized: CapabilityHandler = {
    ...handler,
    descriptor: {
      ...handler.descriptor,
      version: handler.descriptor.version ?? "1.0.0",
      available: handler.descriptor.available !== false,
    },
  };
  handlers.set(name, normalized);
}

export function getCapability(name: string): CapabilityHandler | undefined {
  return handlers.get(name);
}

export function listCapabilities(): CapabilityHandler[] {
  return [...handlers.values()];
}

export function clearRegistryForTests(): void {
  handlers.clear();
  bootstrapped = false;
  bootstrapPromise = null;
  bootstrapEpoch += 1;
}

export async function ensureCapabilitiesRegistered(): Promise<void> {
  if (bootstrapped && handlers.size > 0) return;
  const epoch = bootstrapEpoch;
  if (!bootstrapPromise) {
    bootstrapPromise = (async () => {
      const { registerAllCapabilities } = await import(
        "@/forge-core/capabilities/register-all"
      );
      // A parallel clearRegistryForTests() invalidates this attempt.
      if (epoch !== bootstrapEpoch) return;
      registerAllCapabilities();
      if (epoch === bootstrapEpoch) bootstrapped = true;
    })().catch((err) => {
      if (epoch === bootstrapEpoch) {
        bootstrapPromise = null;
        bootstrapped = false;
      }
      throw err;
    });
  }
  await bootstrapPromise;
  if ((!bootstrapped || handlers.size === 0) && epoch !== bootstrapEpoch) {
    return ensureCapabilitiesRegistered();
  }
}
