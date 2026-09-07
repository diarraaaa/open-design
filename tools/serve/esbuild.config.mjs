import { build } from "esbuild";

await build({
  banner: {
    js: "#!/usr/bin/env node",
  },
  bundle: true,
  entryPoints: ["./src/index.ts", "./src/standalone-exact-client.ts"],
  format: "esm",
  outdir: "./dist",
  outExtension: { ".js": ".mjs" },
  packages: "external",
  platform: "node",
  target: "node24",
});
