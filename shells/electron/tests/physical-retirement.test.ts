import { randomUUID } from "node:crypto";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { expect, it, vi } from "vitest";
import { findSidecarProcesses, getSidecarStatus, spawnSidecar, stopSidecars, type SidecarStamp } from "@open-design/sidecar";
import { createStandaloneGenerationBinding, type GenerationRecord } from "@open-design/standalone";
import { bindElectronPhysicalResourceSet, validateElectronPhysicalResourceSet } from "@/adapters/standalone/physical-resources.js";
import { withElectronPhysicalResourceSetGuard } from "@/adapters/standalone/guarded-lifecycle.js";
import declaration from "../config/standalone.json" with { type: "json" };

it("retires real orphaned Closure resources without touching another namespace", async () => {
  const root = await mkdtemp(join(tmpdir(), "electron-physical-retirement-"));
  const scope = { channel: "betahyx", namespace: `retire-${randomUUID()}` };
  const launcherPath = join(root, "launcher.mjs");
  const generation: GenerationRecord = {
    schemaVersion: 4, id: "a".repeat(64), channel: scope.channel,
    releaseVersion: "0.1.0-betahyx.1", standaloneVersion: "0.1.0", sourceCommit: "b".repeat(40),
    minimumShellVersions: { electron: "0.1.0" },
    launcher: { protocol: "standalone-launcher-v1", resourceId: "standalone-launcher", blobSha256: "c".repeat(64), entrypoint: launcherPath, path: launcherPath },
    resources: {
      "standalone-launcher": {
        component: "standalone.launcher", blobSha256: "c".repeat(64), entrypoint: launcherPath, path: launcherPath,
        materialization: { type: "file", entrypoint: "launcher.mjs" }, mediaType: "text/javascript", size: 1, sync: true,
      },
    },
  };
  const resourceSet = bindElectronPhysicalResourceSet(validateElectronPhysicalResourceSet(declaration), createStandaloneGenerationBinding(generation, scope));
  const orphans = resourceSet.resources.filter(({ id }) => id !== "standalone-runtime");
  const peer: SidecarStamp = { ...orphans[0]!.stamp, namespace: `${scope.namespace}-peer` };
  const stamps = [...resourceSet.resources.map(({ stamp }) => stamp), peer];
  try {
    // An absent host must not hide surviving independently stamped resources.
    for (const stamp of [...orphans.map(({ stamp }) => stamp), peer]) {
      await spawnSidecar({
        command: process.execPath,
        args: ["--import", "tsx", fileURLToPath(new URL("./fixtures/physical-resource.ts", import.meta.url))],
        resources: { dataRoot: join(root, "data"), ownerPid: null, port: 0, runtimeRoot: join(root, "runtime") },
        stamp,
      });
      await vi.waitFor(async () => expect(await getSidecarStatus(stamp)).toEqual({ ready: true }), { timeout: 5_000, interval: 25 });
    }
    const certificate = await withElectronPhysicalResourceSetGuard(resourceSet, (guard) => guard.retire());
    expect(certificate.resources).toHaveLength(4);
    for (const { id, result, stamp } of certificate.resources) {
      expect(result.remainingPids).toEqual([]);
      if (id !== "standalone-runtime") expect(result.stoppedPids.length).toBeGreaterThan(0);
      expect(await findSidecarProcesses(stamp)).toEqual([]);
    }
    expect(await getSidecarStatus(peer)).toEqual({ ready: true });
  } finally {
    const cleanup = await stopSidecars(stamps.map((stamp) => ({ stamp })));
    expect(cleanup.remainingPids).toEqual([]);
    await rm(root, { recursive: true, force: true });
  }
}, 20_000);
