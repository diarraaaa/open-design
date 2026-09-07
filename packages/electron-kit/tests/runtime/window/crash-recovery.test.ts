import { afterEach, describe, expect, it, vi } from "vitest";
import { awaitElectronRendererRecoveryDecision, ElectronRendererCrashBreaker } from "@/runtime/window/crash-recovery.js";

afterEach(() => vi.useRealTimers());
describe("renderer crash recovery policy", () => {
  const policy = { crashLimit: 5, windowMs: 60000, cooldownMs: 300000 };
  it("recovers isolated crashes and parks the fifth crash without an unbounded loop", () => {
    const breaker = new ElectronRendererCrashBreaker(policy);
    for (let index = 0; index < 4; index++) expect(breaker.record(index)).toBe("recover");
    expect(breaker.record(4)).toBe("park"); expect(breaker.record(5)).toBe("ignore");
    breaker.reset(); expect(breaker.record(6)).toBe("recover");
  });
  it("expires old crashes and rejects invalid policy", () => {
    const breaker = new ElectronRendererCrashBreaker(policy);
    for (let index = 0; index < 8; index++) expect(breaker.record(index * 60000)).toBe("recover");
    expect(() => new ElectronRendererCrashBreaker({ ...policy, crashLimit: 0 })).toThrow("invalid renderer recovery");
  });
  it("retries after cooldown and aborts the outstanding native prompt", async () => {
    vi.useFakeTimers(); let promptSignal: AbortSignal | undefined;
    const result = awaitElectronRendererRecoveryDecision({ cooldownMs: 300000, signal: new AbortController().signal,
      prompt: signal => { promptSignal = signal; return new Promise(() => undefined); } });
    await vi.advanceTimersByTimeAsync(300000);
    await expect(result).resolves.toBe("retry"); expect(promptSignal?.aborted).toBe(true); expect(vi.getTimerCount()).toBe(0);
  });
  it("lets an explicit retry win without waiting for cooldown", async () => {
    vi.useFakeTimers();
    await expect(awaitElectronRendererRecoveryDecision({ cooldownMs: 300000, signal: new AbortController().signal, prompt: async () => "retry" })).resolves.toBe("retry");
    expect(vi.getTimerCount()).toBe(0);
  });
  it("cancels prompt and passive recovery when shutdown begins", async () => {
    vi.useFakeTimers(); const shutdown = new AbortController(); let promptSignal: AbortSignal | undefined;
    const result = awaitElectronRendererRecoveryDecision({ cooldownMs: 300000, signal: shutdown.signal,
      prompt: signal => { promptSignal = signal; return new Promise(() => undefined); } });
    shutdown.abort(); await expect(result).resolves.toBe("quit"); expect(promptSignal?.aborted).toBe(true); expect(vi.getTimerCount()).toBe(0);
  });
});
