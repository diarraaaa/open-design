import type { StandaloneRuntimeHandle, StandaloneRuntimeStatus } from "@open-design/standalone";

/** Observe the existing runtime authority; never turn a local remount into eviction. */
export async function observeElectronRuntimeTerminal(input: Readonly<{
  runtime: StandaloneRuntimeHandle;
  isClosing(): boolean;
  waitForRendererReplacement(): Promise<void>;
  onTerminal(observation: Readonly<{ status?: StandaloneRuntimeStatus; error?: unknown }>): void;
}>): Promise<void> {
  while (!input.isClosing()) {
    let error: unknown;
    try { await input.runtime.waitForTerminal(); }
    catch (reason) { error = reason; }
    if (input.isClosing()) return;
    await input.waitForRendererReplacement();
    if (input.isClosing()) return;
    let status: StandaloneRuntimeStatus | undefined;
    try { status = await input.runtime.readStatus(); }
    catch (reason) { error = reason; }
    if (status?.state !== "running") { input.onTerminal({ status, error }); return; }
    // A local generation replacement can briefly retire the old transport.
    await new Promise((done) => setTimeout(done, 100));
  }
}
