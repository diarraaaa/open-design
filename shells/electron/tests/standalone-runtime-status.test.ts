import { describe, expect, it } from "vitest";
import type { LifecycleStatus } from "@open-design/standalone";
import { projectElectronRuntimeStatus } from "@/adapters/standalone/runtime-status.js";

const occupant = (attachmentId: string) => ({ attachmentId, generationId: "generation", shell: { type: attachmentId, version: "1.0.0", buildHash: "a".repeat(64), digest: "b".repeat(64) } });
const status: LifecycleStatus = { scope: { channel: "betahyx", namespace: "test" }, lease: null, bindingDigest: "binding", generationId: "generation", instanceId: "instance", references: 2, state: "running", fence: 1, occupants: [occupant("electron"), occupant("terminal")] };
describe("Electron attachment status", () => {
  it("does not confuse a running sibling generation with its own attachment", () => {
    expect(projectElectronRuntimeStatus(status, "binding", "generation", "electron").state).toBe("running");
    for (const observed of [
      { ...status, bindingDigest: "replacement" },
      { ...status, generationId: "replacement" },
      { ...status, references: 1, occupants: [occupant("terminal")] },
    ]) {
      expect(projectElectronRuntimeStatus(observed, "binding", "generation", "electron")).toMatchObject({ state: "failed", bindingDigest: "binding", generationId: "generation" });
    }
  });
});
