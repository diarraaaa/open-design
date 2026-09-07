import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { createStandaloneHostConnection, resolveStandaloneRuntimeLayout, validateStandaloneHostConnection } from "../src/index.js";

const scope = { channel: "betahyx", namespace: "shared" };
const layout = resolveStandaloneRuntimeLayout({ namespaceRoot: resolve("namespace"), resourceStoreRoot: resolve("store"), sidecarSupervisorPath: resolve("electron/supervisor.mjs") });
const expected = { scope, layout };

describe("Standalone shared host compatibility", () => {
  it("retains the serving carrier's supervisor without moving shared writable roots", () => {
    const servingLayout = { ...layout, sidecarSupervisorPath: resolve("terminal/supervisor.mjs") };
    const connection = createStandaloneHostConnection(scope, servingLayout);
    expect(validateStandaloneHostConnection(connection, expected).layout).toEqual(servingLayout);
  });
  it.each(["dataRoot", "logsRoot", "resourceStoreRoot", "runtimeRoot"] as const)("rejects conflicting %s", (key) => {
    const connection = createStandaloneHostConnection(scope, { ...layout, [key]: resolve("other") });
    expect(() => validateStandaloneHostConnection(connection, expected)).toThrow(key);
  });
  it("rejects old, foreign and extended contracts", () => {
    const connection = createStandaloneHostConnection(scope, layout);
    for (const input of [null, {}, { ...connection, schemaVersion: 2 }, { ...connection, controlProtocol: "other" },
      { ...connection, scope: { ...scope, namespace: "other" } }, { ...connection, scope: { ...scope, ipc: "escape" } },
      { ...connection, hostPath: "escape" }]) expect(() => validateStandaloneHostConnection(input, expected)).toThrow();
  });
});
