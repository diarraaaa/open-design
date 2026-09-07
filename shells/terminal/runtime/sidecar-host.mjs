import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

import { bootstrapSidecarProcess, invokeSidecar, SidecarFactory } from "@open-design/sidecar";

const CONFIG_ENV = "OD_TERMINAL_SIDECAR_CONFIG_V1";

function readConfig() {
  const serialized = process.env[CONFIG_ENV];
  if (serialized == null) throw new Error(`${CONFIG_ENV} is required`);
  const value = JSON.parse(serialized);
  if (
    value?.schemaVersion !== 1
    || typeof value.storeRoot !== "string"
    || typeof value.standaloneEntrypoint !== "string"
    || typeof value.runtimeRoot !== "string"
    || typeof value.sidecarHost !== "string"
    || !/^[a-z0-9]{1,12}$/.test(value.channel)
    || !/^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/.test(value.namespace)
  ) throw new Error("Terminal Sidecar configuration is invalid");
  return Object.freeze({
    schemaVersion: 1,
    storeRoot: resolve(value.storeRoot),
    standaloneEntrypoint: resolve(value.standaloneEntrypoint),
    runtimeRoot: resolve(value.runtimeRoot),
    sidecarHost: resolve(value.sidecarHost),
    channel: value.channel,
    namespace: value.namespace,
    layout: value.layout,
  });
}

class TerminalSidecarRuntime {
  constructor(config, standalone) {
    this.scope = Object.freeze({ channel: config.channel, namespace: config.namespace });
    this.layout = standalone.validateStandaloneRuntimeLayout(config.layout);
    if (this.layout.resourceStoreRoot !== config.storeRoot) throw new Error("Terminal layout escaped its Store root");
    this.lifecycle = new standalone.StandaloneHostLifecycle(this.scope, {
      statePort: new standalone.StandaloneHostLifecycleLedger(config.storeRoot, this.scope),
    });
    const updater = new standalone.StandaloneHostControlUpdater("electron", this.scope, (request) => invokeSidecar({
      ...this.scope, source: "standalone", mode: "runtime", app: "electron-updater",
    }, standalone.STANDALONE_HOST_CONTROL_ACTION, request, { timeoutMs: standalone.standaloneHostControlRequestTimeoutMs(request) }));
    this.control = new standalone.StandaloneHostRuntime({
      scope: this.scope,
      lifecycle: this.lifecycle,
      updater: (shellType) => shellType === "electron" ? updater : undefined,
      capabilities: () => standalone.createStandaloneShellCapabilityRouter([
        standalone.createStandaloneRuntimeLayoutCapabilityHandler({ layout: this.layout, scope: this.scope }),
        standalone.createStandaloneShellUpdaterCapabilityHandler(updater),
      ]),
      resolveGeneration: async (binding) => {
        const launcherBytes = await readFile(binding.launcher.path);
        if (createHash("sha256").update(launcherBytes).digest("hex") !== binding.launcher.blobSha256) {
          throw new Error("materialized Standalone launcher failed Sidecar handoff binding");
        }
        return standalone.resolveStandaloneGenerationHandoff(await import(pathToFileURL(binding.launcher.path).href));
      },
    });
  }

}

const config = readConfig();
const standalone = await import(pathToFileURL(config.standaloneEntrypoint).href);
const stamp = Object.freeze({
  channel: config.channel,
  namespace: config.namespace,
  source: "standalone",
  mode: "runtime",
  app: "standalone",
});
if (await bootstrapSidecarProcess(stamp, {
  dataRoot: config.storeRoot,
  ownerPid: null,
  port: 0,
  runtimeRoot: config.runtimeRoot,
})) process.exit(0);
let runtime = null;
const client = SidecarFactory.create({
  handlers: {
    [standalone.STANDALONE_HOST_CONTROL_ACTION]: async (input) => {
      if (runtime == null) throw new Error("Terminal Sidecar runtime is not ready");
      return await runtime.control.request(input);
    },
  },
  lifecycle: {
    async start(resources) {
      if (resolve(resources.dataRoot ?? "") !== config.storeRoot) {
        throw new Error("Terminal Sidecar data root differs from its launch contract");
      }
      runtime = new TerminalSidecarRuntime(config, standalone);
      return runtime;
    },
    async status(active) {
      return {
        bootstrapPid: Number.parseInt(process.env.OD_TERMINAL_BOOTSTRAP_PID ?? "0", 10) || null,
        control: "ready",
        connection: standalone.createStandaloneHostConnection(active.scope, active.layout),
        dataRoot: client.resources.dataRoot,
        generationPid: client.resources.pid,
        hostPid: process.pid,
        runtimeRoot: client.resources.runtimeRoot,
        layout: active.layout,
        lifecycle: await active.lifecycle.status(),
      };
    },
    async stop() { runtime = null; },
  },
});
if (JSON.stringify(client.stamp) !== JSON.stringify(stamp)) {
  throw new Error("Terminal Sidecar configuration differs from its process stamp");
}
await client.start();
await client.waitUntilStopped();
