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

/** Read Electron's native CDP discovery endpoint without inventing another debug protocol. */
export async function inspectElectronCdpStatus(status: unknown): Promise<Readonly<{
  discovery: ElectronCdpDiscovery;
  targets: readonly ElectronCdpTarget[];
}>> {
  const discovery = discoveryFromStatus(status);
  if (discovery.state !== "ready") return Object.freeze({ discovery, targets: Object.freeze([]) });
  let value: unknown[];
  try {
    const response = await fetch(`${discovery.discoveryUrl}/json/list`, { signal: AbortSignal.timeout(2_000) });
    if (!response.ok) throw new Error(`Electron CDP target discovery failed with HTTP ${response.status}`);
    const payload: unknown = await response.json();
    if (!Array.isArray(payload)) throw new Error("Electron CDP target discovery returned a non-array payload");
    value = payload;
  } catch (error) {
    return Object.freeze({ discovery: Object.freeze({ state: "unavailable" as const, discoveryUrl: discovery.discoveryUrl,
      error: error instanceof Error ? error.message : String(error) }), targets: Object.freeze([]) });
  }
  const targets = value.filter((entry): entry is ElectronCdpTarget => {
    const target = record(entry);
    return target != null
      && typeof target.id === "string"
      && typeof target.title === "string"
      && typeof target.type === "string"
      && typeof target.url === "string";
  });
  return Object.freeze({ discovery, targets: Object.freeze(targets) });
}
