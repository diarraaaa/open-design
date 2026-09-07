import { execFileSync } from "node:child_process";
import { expect, it } from "vitest";

it("loads tool-facing source adapters through native Node without a test resolver", () => {
  const modules = ["observation", "build", "installation"].map(name =>
    new URL(`../src/adapters/standalone/${name}.ts`, import.meta.url).href);
  expect(() => execFileSync(process.execPath, ["--input-type=module", "-e",
    `await Promise.all(${JSON.stringify(modules)}.map(url => import(url)));`,
  ], { stdio: "pipe", timeout: 10000 })).not.toThrow();
});
