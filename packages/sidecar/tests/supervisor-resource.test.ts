import { execFileSync } from "node:child_process";
import { mkdtemp, readFile, rm, copyFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import { build } from "esbuild";
import { expect, it } from "vitest";

it("ships a relocatable supervisor resource with only Node builtin imports", async () => {
  const packageRoot = fileURLToPath(new URL("../", import.meta.url));
  execFileSync(process.execPath, ["esbuild.config.mjs"], { cwd: packageRoot, stdio: "pipe" });
  const root = await mkdtemp(join(tmpdir(), "sidecar-resource-"));
  try {
    const path = join(root, "supervisor.mjs");
    await copyFile(fileURLToPath(import.meta.resolve("@open-design/sidecar/resources/supervisor.mjs")), path);
    const result = await build({ entryPoints: [path], bundle: true, platform: "node", format: "esm", packages: "external", write: false, metafile: true });
    const imports = Object.values(result.metafile!.outputs).flatMap((output) => output.imports);
    expect(imports.length).toBeGreaterThan(0);
    expect(imports.every((entry) => entry.external && entry.path.startsWith("node:"))).toBe(true);
    expect(await readFile(path, "utf8")).toContain("sidecar supervisor failed to spawn target");
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
