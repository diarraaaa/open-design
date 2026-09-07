import { execFileSync } from "node:child_process";
import { expect, it } from "vitest";

it("loads tool-facing source adapters through native Node without a test resolver", () => {
  const modules = ["standalone/observation", "standalone/build", "standalone/installation", "standalone/assemble-installation", "tools/dev-tool", "tools/pack-tool", "tools/runtime-tool", "tools/scene-tool", "tools/distribution-tool", "tools/manifests"].map(name =>
    new URL(`../src/adapters/${name}.ts`, import.meta.url).href);
  expect(() => execFileSync(process.execPath, ["--input-type=module", "-e",
    `await Promise.all(${JSON.stringify(modules)}.map(url => import(url)));`,
  ], { stdio: "pipe", timeout: 10000 })).not.toThrow();
});
