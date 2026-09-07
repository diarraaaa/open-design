export type ElectronRendererRecoveryPolicy = Readonly<{
  crashLimit: number;
  windowMs: number;
  cooldownMs: number;
}>;

/** Preserve a bounded crash history across replacement windows. */
export class ElectronRendererCrashBreaker {
  readonly policy: ElectronRendererRecoveryPolicy;
  private crashes: number[] = [];
  private open = false;

  constructor(policy: ElectronRendererRecoveryPolicy) {
    for (const [key, value] of Object.entries(policy)) {
      if (!Number.isSafeInteger(value) || value < 1) throw new Error(`invalid renderer recovery ${key}`);
    }
    if (policy.crashLimit == null || policy.windowMs == null || policy.cooldownMs == null) throw new Error("incomplete renderer recovery policy");
    this.policy = Object.freeze({ ...policy });
  }

  record(now: number): "recover" | "park" | "ignore" {
    if (this.open) return "ignore";
    this.crashes = this.crashes.filter(time => now - time < this.policy.windowMs);
    this.crashes.push(now);
    if (this.crashes.length < this.policy.crashLimit) return "recover";
    this.open = true;
    return "park";
  }

  reset(): void { this.crashes = []; this.open = false; }
}

/** A user retry, cooldown or shutdown wins once and dismisses the native prompt. */
export async function awaitElectronRendererRecoveryDecision(input: Readonly<{
  cooldownMs: number;
  signal: AbortSignal;
  prompt(signal: AbortSignal): Promise<"retry" | "quit">;
}>): Promise<"retry" | "quit"> {
  if (input.signal.aborted) return "quit";
  const prompt = new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;
  let quit!: () => void;
  const shutdown = new Promise<"quit">(done => { quit = () => done("quit"); });
  input.signal.addEventListener("abort", quit, { once: true });
  try {
    return await Promise.race([
      input.prompt(prompt.signal), shutdown,
      new Promise<"retry">(done => { timer = setTimeout(() => done("retry"), input.cooldownMs); }),
    ]);
  } finally {
    if (timer != null) clearTimeout(timer);
    input.signal.removeEventListener("abort", quit);
    prompt.abort();
  }
}
