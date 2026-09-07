import { copyFile, mkdir } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { build, type BuildOptions } from "esbuild";

/** Build product-owned entrypoints and consume the Sidecar-owned process resource. */
export async function buildElectronStandaloneAuthority(outputRoot: string) {
  const root = resolve(outputRoot);
  await mkdir(root, { recursive: true });
  const hostPath = resolve(root, "standalone-host.mjs");
  const updaterProviderPath = resolve(root, "electron-updater.mjs");
  const supervisorPath = resolve(root, "supervisor.mjs");
  const shared = { bundle: true, format: "esm", platform: "node", target: "node24" } satisfies BuildOptions;
  await Promise.all([
    build({ ...shared, entryPoints: [fileURLToPath(new URL("./updater-provider.ts", import.meta.url))], outfile: updaterProviderPath }),
    build({ ...shared, entryPoints: [fileURLToPath(new URL("./host.ts", import.meta.url))], outfile: hostPath }),
    copyFile(fileURLToPath(import.meta.resolve("@open-design/sidecar/resources/supervisor.mjs")), supervisorPath),
  ]);
  return Object.freeze({
    host: Object.freeze({ name: "standalone-host.mjs", path: hostPath }),
    updaterProvider: Object.freeze({ name: "electron-updater.mjs", path: updaterProviderPath }),
    supervisor: Object.freeze({ name: "supervisor.mjs", path: supervisorPath }),
  });
}
