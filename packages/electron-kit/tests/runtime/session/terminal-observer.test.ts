import { describe, expect, it, vi } from "vitest";
import type { StandaloneRuntimeHandle, StandaloneRuntimeStatus } from "@open-design/standalone";
import { observeElectronRuntimeTerminal } from "@/runtime/session/terminal-observer.js";

const stopped: StandaloneRuntimeStatus = { state: "stopped", generationId: "generation", bindingDigest: "binding", instanceId: "instance", references: 0 };
function runtime(readStatus: StandaloneRuntimeHandle["readStatus"], waitForTerminal = async () => stopped): StandaloneRuntimeHandle {
  return { readStatus, waitForTerminal, close: async () => stopped, invoke: async () => { throw new Error("not invoked"); } };
}
describe("Electron runtime termination observer", () => {
  it("closes a revoked attachment even while the shared host has another consumer", async () => {
    const failed = { ...stopped, state: "failed" as const, references: 1 }, onTerminal = vi.fn();
    await observeElectronRuntimeTerminal({ runtime: runtime(async () => failed), isClosing: () => false, waitForRendererReplacement: async () => undefined, onTerminal });
    expect(onTerminal).toHaveBeenCalledWith({ status: failed, error: undefined });
  });
  it("waits for its local renderer replacement and rechecks instead of quitting a healthy successor", async () => {
    let closing = false;
    const onTerminal = vi.fn(), readStatus = vi.fn(async () => ({ ...stopped, state: "running" as const }));
    const wait = vi.fn().mockResolvedValueOnce(stopped).mockImplementationOnce(async () => { closing = true; return stopped; });
    let finish!: () => void;
    const replacement = new Promise<void>(done => { finish = done; });
    const observing = observeElectronRuntimeTerminal({ runtime: runtime(readStatus, wait), isClosing: () => closing, waitForRendererReplacement: () => replacement, onTerminal });
    await Promise.resolve();
    expect(readStatus).not.toHaveBeenCalled();
    finish(); await observing;
    expect(readStatus).toHaveBeenCalledOnce(); expect(onTerminal).not.toHaveBeenCalled();
  });
  it("fails closed when both terminal observation and the final runtime read lose transport", async () => {
    const error = new Error("host gone"), onTerminal = vi.fn();
    const unavailable = async (): Promise<StandaloneRuntimeStatus> => { throw error; };
    await observeElectronRuntimeTerminal({ runtime: runtime(unavailable, unavailable), isClosing: () => false, waitForRendererReplacement: async () => undefined, onTerminal });
    expect(onTerminal).toHaveBeenCalledWith({ status: undefined, error });
  });
  it("does not issue another quit after shutdown has begun", async () => {
    const onTerminal = vi.fn(), readStatus = vi.fn(async () => stopped);
    await observeElectronRuntimeTerminal({ runtime: runtime(readStatus), isClosing: () => true, waitForRendererReplacement: async () => undefined, onTerminal });
    expect(onTerminal).not.toHaveBeenCalled(); expect(readStatus).not.toHaveBeenCalled();
  });
});
