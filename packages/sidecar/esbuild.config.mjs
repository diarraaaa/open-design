import { build } from "esbuild";

const shared = {
  bundle: true,
  format: "esm",
  platform: "node",
  target: "node24",
};

await Promise.all([
  build({ ...shared, packages: "external", entryPoints: ["./src/index.ts"], outfile: "./dist/index.mjs" }),
  build({ ...shared, packages: "external", entryPoints: ["./src/authority.ts"], outfile: "./dist/authority.mjs" }),
  // A relocatable process resource: carriers copy these bytes, never compile
  // Sidecar private source or supply a separate workspace dependency graph.
  build({ ...shared, entryPoints: ["./src/supervisor.ts"], outfile: "./dist/supervisor.mjs" }),
]);
