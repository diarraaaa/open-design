import { readFileSync } from "node:fs";
import { join } from "node:path";

export type ElectronCdpDiscovery =
  | Readonly<{ state: "disabled" }>
  | Readonly<{ state: "starting"; transport: "tcp" }>
  | Readonly<{
      state: "ready";
      transport: "tcp";
      address: string;
      port: number;
      discoveryUrl: string;
      browserWebSocketUrl: string | null;
    }>;

export type ElectronCdpApp = Readonly<{
  commandLine: Readonly<{
    getSwitchValue(name: string): string;
    hasSwitch(name: string): boolean;
  }>;
  getPath(name: "sessionData"): string;
}>;

function tcpUrl(address: string, port: number): string {
  const host = address.includes(":") && !address.startsWith("[") ? `[${address}]` : address;
  return `http://${host}:${port}`;
}

export function parseElectronCdpActivePort(value: string, address = "127.0.0.1"): ElectronCdpDiscovery {
  const [rawPort, rawBrowserPath] = value.trim().split(/\r?\n/u, 2);
  const port = Number(rawPort);
  if (!Number.isSafeInteger(port) || port < 1 || port > 65535) throw new Error("Electron CDP active port is invalid");
  const browserPath = rawBrowserPath?.trim();
  if (browserPath != null && browserPath.length > 0 && !browserPath.startsWith("/")) {
    throw new Error("Electron CDP browser path is invalid");
  }
  const discoveryUrl = tcpUrl(address, port);
  return Object.freeze({
    state: "ready",
    transport: "tcp",
    address,
    port,
    discoveryUrl,
    browserWebSocketUrl: browserPath == null || browserPath.length === 0
      ? null
      : `ws://${address.includes(":") && !address.startsWith("[") ? `[${address}]` : address}:${port}${browserPath}`,
  });
}

/** Project Electron's native remote-debugging switches without owning CDP. */
export function inspectElectronCdp(app: ElectronCdpApp): ElectronCdpDiscovery {
  if (!app.commandLine.hasSwitch("remote-debugging-port")) return Object.freeze({ state: "disabled" });
  const address = app.commandLine.getSwitchValue("remote-debugging-address") || "127.0.0.1";
  const requested = app.commandLine.getSwitchValue("remote-debugging-port");
  if (requested !== "0") return parseElectronCdpActivePort(requested, address);
  // A bootstrap-root receipt can belong to another namespace. Never use it as
  // a fallback; preflight must establish the isolated path before Chromium.
  try {
    return parseElectronCdpActivePort(readFileSync(join(app.getPath("sessionData"), "DevToolsActivePort"), "utf8"), address);
  } catch { /* Chromium may not have published this namespace's receipt yet. */ }
  return Object.freeze({ state: "starting", transport: "tcp" });
}
