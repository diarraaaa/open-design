import { createHash } from "node:crypto";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import JSZip from "jszip";
import { standaloneTreeSha256 } from "@open-design/standalone";
import { buildElectronCapsule } from "@/distribution/capsule.js";
import { assertElectronCapsuleCompatibility, validateElectronCapsuleManifest } from "@/contracts/capsule.js";

const roots: string[] = [];
afterEach(async () => { await Promise.all(roots.splice(0).map(root => rm(root, { recursive: true, force: true }))); });
async function fixture() {
  const root = await mkdtemp(join(tmpdir(), "electron-capsule-")); roots.push(root);
  const entryPath = join(root, "entry.ts");
  await writeFile(entryPath, 'export const createElectronCapsuleDefinition = () => ({ title: "first" });');
  return { root, entryPath, outputRoot: join(root, "first"), target: "darwin-arm64" as const, version: "1.0.0", minimumCarrierVersion: "1.0.0", providedShellVersion: "2.0.0" };
}
describe("independent Capsule build", () => {
  it("binds deterministic module bytes and tree separately from compatibility metadata", async () => {
    const input = await fixture(), first = await buildElectronCapsule(input);
    const second = await buildElectronCapsule({ ...input, outputRoot: join(input.root, "second"), version: "1.0.1" });
    expect(second.manifest.archive).toEqual(first.manifest.archive);
    expect(second.manifest.version).not.toBe(first.manifest.version);
    const bytes = await readFile(first.archivePath), zip = await JSZip.loadAsync(bytes);
    expect(Object.keys(zip.files)).toEqual(["capsule.cjs"]);
    const module = await zip.file("capsule.cjs")!.async("nodebuffer");
    expect(first.manifest.archive).toEqual({ sha256: createHash("sha256").update(bytes).digest("hex"), size: bytes.byteLength,
      treeSha256: standaloneTreeSha256([{ path: "capsule.cjs", sha256: createHash("sha256").update(module).digest("hex"), size: module.byteLength }]) });
    await writeFile(input.entryPath, 'export const createElectronCapsuleDefinition = () => ({ title: "changed" });');
    const changed = await buildElectronCapsule({ ...input, outputRoot: join(input.root, "changed") });
    expect(changed.manifest.archive.sha256).not.toBe(first.manifest.archive.sha256);
    await expect(buildElectronCapsule(input)).rejects.toThrow();
    expect(await readFile(first.archivePath)).toEqual(bytes);
  });
  it("rejects unsupported protocols, platform targets, fields and carrier floors", async () => {
    const input = await fixture(), { manifest } = await buildElectronCapsule(input);
    for (const invalid of [{ ...manifest, target: "linux-x64" }, { ...manifest, entrypoint: "../main.cjs" },
      { ...manifest, schemaVersion: 2 }, { ...manifest, latest: "anything" }, { ...manifest, archive: { ...manifest.archive, size: -1 } }]) {
      expect(() => validateElectronCapsuleManifest(invalid)).toThrow();
    }
    expect(() => assertElectronCapsuleCompatibility(manifest, { target: "darwin-arm64", version: "1.0.0" })).not.toThrow();
    expect(() => assertElectronCapsuleCompatibility(manifest, { target: "win32-x64", version: "1.0.0" })).toThrow();
    expect(() => assertElectronCapsuleCompatibility(manifest, { target: "darwin-arm64", version: "0.9.0" })).toThrow();
  });
});
