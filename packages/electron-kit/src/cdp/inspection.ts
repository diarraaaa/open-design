export type ElectronCdpDiscovery = Readonly<{
  state: "ready";
  discoveryUrl: string;
}> | Readonly<{ state: "disabled" | "starting" }>
  | Readonly<{ state: "unavailable"; discoveryUrl: string; error: string }>;

export type ElectronCdpTarget = Readonly<{
  id: string;
  title: string;
  type: string;
  url: string;
  webSocketDebuggerUrl?: string;
}>;

function record(value: unknown): Record<string, unknown> | null {
  return value != null && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : null;
}

function discoveryFromStatus(status: unknown): ElectronCdpDiscovery {
  const cdp = record(record(status)?.cdp);
  if (cdp?.state === "ready" && typeof cdp.discoveryUrl === "string") {
    return Object.freeze({ state: "ready", discoveryUrl: cdp.discoveryUrl });
  }
  return Object.freeze({ state: cdp?.state === "starting" ? "starting" : "disabled" });
}

/** Shared native discovery for observational inspect and CDP control. */
export async function listElectronCdpTargets(discoveryUrl: string, signal: AbortSignal): Promise<readonly ElectronCdpTarget[]> {
  const response = await fetch(`${discoveryUrl}/json/list`, { redirect: "error", signal });
  if (!response.ok) throw new Error(`Electron CDP target discovery failed with HTTP ${response.status}`);
  const payload: unknown = await response.json();
  if (!Array.isArray(payload)) throw new Error("Electron CDP target discovery returned a non-array payload");
  return Object.freeze(payload.flatMap((entry) => {
    const target = record(entry);
    if (target == null || typeof target.id !== "string" || typeof target.title !== "string"
      || typeof target.type !== "string" || typeof target.url !== "string") return [];
    return [Object.freeze({ id: target.id, title: target.title, type: target.type, url: target.url,
      ...(typeof target.webSocketDebuggerUrl === "string" ? { webSocketDebuggerUrl: target.webSocketDebuggerUrl } : {}),
    })];
  }));
}

/** Read Electron's native CDP discovery endpoint without inventing another debug protocol. */
export async function inspectElectronCdpStatus(status: unknown): Promise<Readonly<{
  discovery: ElectronCdpDiscovery;
  targets: readonly ElectronCdpTarget[];
}>> {
  const discovery = discoveryFromStatus(status);
  if (discovery.state !== "ready") return Object.freeze({ discovery, targets: Object.freeze([]) });
  try {
    const targets = await listElectronCdpTargets(discovery.discoveryUrl, AbortSignal.timeout(2_000));
    return Object.freeze({ discovery, targets });
  } catch (error) {
    return Object.freeze({ discovery: Object.freeze({ state: "unavailable" as const, discoveryUrl: discovery.discoveryUrl,
      error: error instanceof Error ? error.message : String(error) }), targets: Object.freeze([]) });
  }
}
