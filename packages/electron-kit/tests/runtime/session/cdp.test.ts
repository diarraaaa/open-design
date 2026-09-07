import { readFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";

import { inspectElectronCdp, parseElectronCdpActivePort } from "@/runtime/session/cdp.js";
vi.mock("node:fs", () => ({ readFileSync: vi.fn() }));
afterEach(() => vi.resetAllMocks());

describe("Electron native CDP discovery", () => {
  it("never discovers a sibling through the pre-isolation bootstrap receipt", () => {
    const root = join("/product", "exact", "channels", "dev", "namespaces", "peer", "electron");
    const app = {
      commandLine: { hasSwitch: () => true, getSwitchValue: (name: string) => name === "remote-debugging-port" ? "0" : "" },
      getPath: (name: string) => name === "sessionData" ? root : "/bootstrap",
    };
    vi.mocked(readFileSync).mockImplementation((file) => String(file) === join(root, "DevToolsActivePort") ? "43124\n/devtools/browser/peer" : "43123\n/devtools/browser/sibling");
    expect(inspectElectronCdp(app)).toMatchObject({ port: 43124 });
    expect(readFileSync).toHaveBeenCalledExactlyOnceWith(join(root, "DevToolsActivePort"), "utf8");
    vi.mocked(readFileSync).mockImplementation(() => { throw new Error("not published"); });
    expect(inspectElectronCdp(app)).toEqual({ state: "starting", transport: "tcp" });
  });
  it("parses Chromium's ephemeral DevToolsActivePort receipt", () => {
    expect(parseElectronCdpActivePort("43123\n/devtools/browser/abc\n")).toEqual({
      state: "ready",
      transport: "tcp",
      address: "127.0.0.1",
      port: 43123,
      discoveryUrl: "http://127.0.0.1:43123",
      browserWebSocketUrl: "ws://127.0.0.1:43123/devtools/browser/abc",
    });
  });

  it("projects disabled and explicit fixed-port launches", () => {
    const disabled = {
      commandLine: { hasSwitch: () => false, getSwitchValue: () => "" },
      getPath: () => "/unused",
    };
    expect(inspectElectronCdp(disabled)).toEqual({ state: "disabled" });

    const fixed = {
      commandLine: {
        hasSwitch: (name: string) => name === "remote-debugging-port",
        getSwitchValue: (name: string) => name === "remote-debugging-port" ? "9222" : "",
      },
      getPath: () => "/unused",
    };
    expect(inspectElectronCdp(fixed)).toMatchObject({ state: "ready", port: 9222 });
  });
});
