import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { EventEmitter } from "node:events";
import { afterEach, describe, expect, it } from "vitest";
import { loadElectronCarrierCapsule, prepareElectronCarrierIdentity } from "@/runtime/startup/identity.js";

const roots: string[] = [];
afterEach(async () => { await Promise.all(roots.splice(0).map(root => rm(root, { recursive: true, force: true }))); });
describe("carrier identity before product initialization", () => {
  it.each([true, false])("establishes headless identity synchronously before singleton result %s", async acquired => {
    const root = await mkdtemp(join(tmpdir(), "carrier-identity-")); roots.push(root);
    const calls: string[] = [];
    const pending = prepareElectronCarrierIdentity({
      app: { isReady: () => false, getPreferredSystemLanguages: () => [], commandLine: { appendSwitch() {} },
        setActivationPolicy: policy => { calls.push(policy); }, setName: () => { calls.push("name"); },
        getPath: () => root, setPath: name => { calls.push(name); },
        requestSingleInstanceLock: () => { calls.push("lock"); return acquired; } },
      protocol: { registerSchemesAsPrivileged: () => { calls.push("scheme"); } },
      platform: "darwin", productName: "Test", scheme: "test", channel: "betahyx", namespace: "test-headless",
      preflight: { schemaVersion: 1, atoms: [] }, presentation: "headless",
    });
    expect(calls).toEqual(["prohibited", "name", "scheme", "userData", "sessionData", "logs"]);
    expect((await pending) !== null).toBe(acquired);
    expect(calls.at(-1)).toBe("lock");
  });
  it("does not continue into product startup after quit during module loading", async () => {
    const app = new EventEmitter();
    let complete!: (value: string) => void;
    const pending = loadElectronCarrierCapsule(app, () => new Promise<string>(resolve => { complete = resolve; }));
    app.emit("before-quit");
    complete("late module");
    await expect(pending).rejects.toThrow("startup was cancelled");
    expect(app.listenerCount("before-quit")).toBe(0);
    await expect(loadElectronCarrierCapsule(app, async () => "ready")).resolves.toBe("ready");
    expect(app.listenerCount("before-quit")).toBe(0);
    await expect(loadElectronCarrierCapsule(app, async () => { throw new Error("invalid capsule"); })).rejects.toThrow("invalid capsule");
    expect(app.listenerCount("before-quit")).toBe(0);
  });
});
