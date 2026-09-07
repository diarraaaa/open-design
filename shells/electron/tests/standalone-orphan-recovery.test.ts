import { beforeEach, describe, expect, it, vi } from "vitest";
import type { StandaloneHostLifecycleLedger } from "@open-design/standalone";
import type { ElectronPhysicalResourceSetGuard } from "@/adapters/standalone/guarded-lifecycle.js";

const authority = vi.hoisted(() => ({ find: vi.fn(), status: vi.fn(), stop: vi.fn() }));
vi.mock("@open-design/sidecar/authority", () => ({ findSidecarProcesses: authority.find }));
vi.mock("@open-design/standalone", () => ({ StandaloneHostLifecycle: class {
  status = authority.status;
  stop = authority.stop;
} }));
import { retireElectronOrphanedRuntime } from "@/adapters/standalone/orphan-recovery.js";

const scope = { channel: "betahyx", namespace: "orphan-test" };
function fixture(transition: unknown = null) {
  const retire = vi.fn(async () => undefined), readOrInitial = vi.fn(async () => ({ transition }));
  return { retire, readOrInitial, input: { scope, stamp: { ...scope, source: "standalone", mode: "runtime", app: "standalone" },
    guard: { retire } as unknown as ElectronPhysicalResourceSetGuard,
    ledger: { readOrInitial } as unknown as StandaloneHostLifecycleLedger } };
}
describe("Electron orphan recovery", () => {
  beforeEach(() => { vi.clearAllMocks(); authority.find.mockResolvedValue([]); authority.status.mockResolvedValue({ state: "running", fence: 7 }); });
  it("retires the whole physical set before stopping the abandoned logical instance", async () => {
    const f = fixture();
    await expect(retireElectronOrphanedRuntime(f.input)).resolves.toBe(true);
    expect(f.retire).toHaveBeenCalledOnce(); expect(authority.stop).toHaveBeenCalledWith(7);
    expect(f.retire.mock.invocationCallOrder[0]).toBeLessThan(f.readOrInitial.mock.invocationCallOrder[0]!);
    expect(f.readOrInitial.mock.invocationCallOrder[0]).toBeLessThan(authority.stop.mock.invocationCallOrder[0]!);
  });
  it("does not replace a live but unresponsive host or touch its ledger", async () => {
    authority.find.mockResolvedValue([{ pid: 42 }]); const f = fixture();
    await expect(retireElectronOrphanedRuntime(f.input)).resolves.toBe(false);
    expect(f.retire).not.toHaveBeenCalled(); expect(f.readOrInitial).not.toHaveBeenCalled();
  });
  it("preserves a durable transition for explicit recovery after physical cleanup", async () => {
    const f = fixture({ kind: "shell-install", phase: "stopped-sealed" });
    await expect(retireElectronOrphanedRuntime(f.input)).resolves.toBe(true);
    expect(f.retire).toHaveBeenCalledOnce(); expect(authority.status).not.toHaveBeenCalled(); expect(authority.stop).not.toHaveBeenCalled();
  });
  it("does not write logical state if retirement reports survivors", async () => {
    const f = fixture(); f.retire.mockRejectedValue(new Error("survivor"));
    await expect(retireElectronOrphanedRuntime(f.input)).rejects.toThrow("survivor");
    expect(f.readOrInitial).not.toHaveBeenCalled(); expect(authority.stop).not.toHaveBeenCalled();
  });
});
