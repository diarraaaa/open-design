import { describe, expect, it, vi } from "vitest";

import { StandaloneHostControlUpdater, createStandaloneHostUpdaterHandler, initialShellUpdaterSnapshot, type StandaloneHostControlRequest } from "../src/index.js";

const scope = Object.freeze({ channel: "betahyx", namespace: "shared" });
const identity = { type: "terminal", version: "0.1.0", buildHash: "a".repeat(64), digest: "b".repeat(64) };

describe("Standalone host updater client", () => {
  it("serves an isolated provider without exposing lifecycle or another scope", async () => {
    const snapshot = initialShellUpdaterSnapshot("electron");
    const result = { outcome: "accepted" as const, snapshot };
    const provider = {
      shellType: "electron",
      readSnapshot: vi.fn(async () => snapshot),
      waitForChange: vi.fn(async () => snapshot),
      invoke: vi.fn(async () => result),
      confirmInstalled: vi.fn(async () => result),
    };
    const handler = createStandaloneHostUpdaterHandler(scope, provider);
    const client = new StandaloneHostControlUpdater("electron", scope, handler);
    expect(await client.readSnapshot()).toEqual(snapshot);
    expect(await client.waitForChange(0, 100)).toEqual(snapshot);
    expect(provider.waitForChange).toHaveBeenCalledWith(0, 100);
    expect(await client.invoke("check")).toEqual(result);
    expect(provider.invoke).toHaveBeenCalledWith("check");
    expect(await client.confirmInstalled({ ...identity, type: "electron" })).toEqual(result);
    vi.clearAllMocks();
    for (const request of [
      { schemaVersion: 1, operation: "lifecycle.status", scope },
      { schemaVersion: 1, operation: "transition.begin", scope, kind: "shell-install", options: {} },
      { schemaVersion: 1, operation: "updater.read", scope, shellType: "terminal" },
      { schemaVersion: 1, operation: "updater.read", scope: { ...scope, namespace: "other" }, shellType: "electron" },
    ] as const) await expect(handler(request)).rejects.toThrow();
    for (const method of [provider.readSnapshot, provider.waitForChange, provider.invoke, provider.confirmInstalled]) expect(method).not.toHaveBeenCalled();
    provider.readSnapshot.mockResolvedValue(initialShellUpdaterSnapshot("terminal"));
    await expect(client.readSnapshot()).rejects.toThrow("Shell type");
  });

  it.each(["electron", "terminal"])("dispatches every finite updater operation for %s", async (shellType) => {
    const snapshot = initialShellUpdaterSnapshot(shellType);
    const transport = vi.fn(async (request: StandaloneHostControlRequest) => {
      return request.operation === "updater.read" || request.operation === "updater.wait"
        ? snapshot : { outcome: "accepted", snapshot };
    });
    const client = new StandaloneHostControlUpdater(shellType, scope, transport);
    expect(await client.readSnapshot()).toEqual(snapshot);
    expect(await client.waitForChange(0, 100)).toEqual(snapshot);
    expect(await client.invoke("check")).toEqual({ outcome: "accepted", snapshot });
    expect(await client.confirmInstalled({ ...identity, type: shellType })).toEqual({ outcome: "accepted", snapshot });
    expect(transport.mock.calls.map(([request]) => request.operation)).toEqual([
      "updater.read", "updater.wait", "updater.invoke", "updater.confirm-installed",
    ]);
    for (const [request] of transport.mock.calls) expect(request).toMatchObject({ schemaVersion: 1, scope, shellType });
  });

  it("rejects cross-Shell responses on every operation", async () => {
    const snapshot = initialShellUpdaterSnapshot("electron");
    const client = new StandaloneHostControlUpdater("terminal", scope, async (request) => {
      return request.operation === "updater.read" || request.operation === "updater.wait"
        ? snapshot : { outcome: "accepted", snapshot };
    });
    for (const call of [() => client.readSnapshot(), () => client.waitForChange(0, 100), () => client.invoke("check"), () => client.confirmInstalled(identity)]) {
      await expect(call()).rejects.toThrow("Shell type");
    }
  });

  it("rejects a foreign installed proof before transport", async () => {
    const transport = vi.fn();
    const client = new StandaloneHostControlUpdater("terminal", scope, transport);
    await expect(client.confirmInstalled({ ...identity, type: "electron" })).rejects.toThrow();
    expect(transport).not.toHaveBeenCalled();
  });
});
