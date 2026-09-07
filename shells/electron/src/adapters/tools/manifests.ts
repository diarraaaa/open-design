import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";

import { validateElectronShellManifest, type ElectronShellManifest } from "@open-design/electron-kit/contracts";
import { createElectronReleaseManifest, createElectronSceneManifest, type ElectronReleaseIdentityRegistry } from "../../composition/release-identity.ts";

type SceneRequest = Readonly<{ schemaVersion: 1; operation: "electron.scene-manifest.resolve"; buildHash: string; manifestFile: string }>;
type ReleaseRequest = Readonly<Omit<SceneRequest, "operation"> & { operation: "electron.release-manifest.resolve"; channel: string; releaseVersion: string }>;

function parse(value: unknown, release: boolean): SceneRequest | ReleaseRequest {
  if (value == null || typeof value !== "object" || Array.isArray(value)) throw new Error("Electron manifest request is invalid");
  const input = value as Record<string, unknown>;
  const keys = release ? ["buildHash", "channel", "manifestFile", "operation", "releaseVersion", "schemaVersion"] : ["buildHash", "manifestFile", "operation", "schemaVersion"];
  if (JSON.stringify(Object.keys(input).sort()) !== JSON.stringify(keys)) throw new Error("Electron manifest request fields are invalid");
  if (input.schemaVersion !== 1 || input.operation !== (release ? "electron.release-manifest.resolve" : "electron.scene-manifest.resolve")
    || typeof input.buildHash !== "string" || !/^[a-f0-9]{64}$/u.test(input.buildHash)
    || typeof input.manifestFile !== "string" || resolve(input.manifestFile) !== input.manifestFile
    || (release && (typeof input.channel !== "string" || typeof input.releaseVersion !== "string"))) throw new Error("Electron manifest request is invalid");
  return Object.freeze(input) as SceneRequest | ReleaseRequest;
}

export const parseElectronSceneManifestRequest = (value: unknown): SceneRequest => parse(value, false) as SceneRequest;
export const parseElectronReleaseManifestRequest = (value: unknown): ReleaseRequest => parse(value, true) as ReleaseRequest;

export async function executeElectronManifest(request: SceneRequest | ReleaseRequest) {
  const base = validateElectronShellManifest(JSON.parse(await readFile(new URL("../../../config/shell.json", import.meta.url), "utf8")) as ElectronShellManifest);
  const manifest = request.operation === "electron.scene-manifest.resolve"
    ? createElectronSceneManifest(base, request.buildHash)
    : createElectronReleaseManifest(base, JSON.parse(await readFile(new URL("../../../config/release-identities.json", import.meta.url), "utf8")) as ElectronReleaseIdentityRegistry, request);
  await mkdir(dirname(request.manifestFile), { recursive: true });
  await writeFile(request.manifestFile, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
  if (request.operation === "electron.scene-manifest.resolve") return Object.freeze({
    schemaVersion: 1, operation: "electron.scene-manifest", manifestFile: request.manifestFile, shell: manifest.shell,
  });
  return Object.freeze({ schemaVersion: 1, operation: "electron.release-manifest", channel: manifest.channel, releaseVersion: manifest.version,
    identity: { appId: manifest.appId, executableName: manifest.executableName, namespace: manifest.namespace, productName: manifest.productName },
    manifestFile: request.manifestFile, shell: manifest.shell,
  });
}
