import { mkdir, readFile, writeFile } from "node:fs/promises";
import { isAbsolute, join } from "node:path";

import { findSidecarProcesses } from "@open-design/sidecar";
import { standaloneHostControlRequestTimeoutMs } from "@open-design/standalone";
import runtime from "../../../config/runtime.json" with { type: "json" };
import resourceDeclaration from "../../../config/standalone.json" with { type: "json" };
import { validateElectronPhysicalResourceSet } from "./physical-resources.ts";

// Product control-plane observations shared by dev and installed adapters.
// These projections do not acquire lifecycle authority or retire shared resources.
/** Control-plane availability is not product readiness. */
export async function waitForElectronProductReady(input: Readonly<{
  readStatus(): Promise<unknown>;
  assertAlive(): void;
}>): Promise<unknown> {
  let deadline = Date.now() + 120_000;
  let observedDeadline = false;
  while (Date.now() < deadline) {
    const status = await input.readStatus();
    if (status != null && typeof status === "object" && "state" in status) {
      if (status.state === "running") return status;
      if (status.state === "failed" || status.state === "stopping") throw new Error(`Electron startup ${status.state}`);
      if (!observedDeadline && "startupDeadline" in status && typeof status.startupDeadline === "string") {
        const declared = Date.parse(status.startupDeadline);
        if (!Number.isFinite(declared) || declared > Date.now() + 3_600_000) throw new Error("Electron startup deadline is invalid");
        deadline = declared + 5_000;
        observedDeadline = true;
      }
    }
    input.assertAlive();
    await new Promise((resolveWait) => setTimeout(resolveWait, 150));
  }
  throw new Error("Electron did not become product-ready in time; inspect the Shell and its logs to diagnose startup");
}

// The outer process must outlive its bounded host release and physical cleanup.
const termGraceMs = runtime.shutdown.gracefulTimeoutMs;
if (!Number.isSafeInteger(termGraceMs) || termGraceMs <= standaloneHostControlRequestTimeoutMs({ operation: "lifecycle.release" })) {
  throw new Error("Electron graceful shutdown budget must exceed its host release budget");
}
export const electronGracefulStopOptions = Object.freeze({ termGraceMs });

/** Observe all declared resources; never infer physical exit from attachment counts. */
export async function findElectronRuntimeSurvivors(scope: Readonly<{ channel: string; namespace: string }>): Promise<readonly number[]> {
  const observations = await Promise.all(validateElectronPhysicalResourceSet(resourceDeclaration).resources.map(resource =>
    findSidecarProcesses({ ...resource.stamp, channel: scope.channel, namespace: scope.namespace })));
  return Object.freeze([...new Set(observations.flatMap(processes => processes.map(({ pid }) => pid)))]);
}

type LogRoot = Readonly<{ scope: "shell" | "product"; path: string }>;

function logRoots(value: unknown): readonly LogRoot[] {
  if (!Array.isArray(value)) return [];
  return value.filter((root): root is LogRoot => root != null && typeof root === "object"
    && (root.scope === "shell" || root.scope === "product") && typeof root.path === "string" && isAbsolute(root.path))
    .map(({ scope, path }) => ({ scope, path }));
}

/** Diagnostic locations survive exit; process state and CDP never do. */
export async function observeElectronDiagnostics(controlRuntimeRoot: string, status: unknown): Promise<unknown> {
  const path = join(controlRuntimeRoot, "diagnostic-log-roots.json");
  if (status != null) {
    const roots = logRoots(typeof status === "object" && "logRoots" in status ? status.logRoots : null);
    if (roots.length > 0) {
      await mkdir(controlRuntimeRoot, { recursive: true });
      // Concurrent identical observations are harmless; incomplete reads are
      // treated as unavailable diagnostics, never as lifecycle authority.
      await writeFile(path, JSON.stringify(roots), "utf8");
    }
    return status;
  }
  const roots = await readFile(path, "utf8").then((text) => logRoots(JSON.parse(text))).catch(() => []);
  return Object.freeze({ state: "idle", logRoots: roots });
}
