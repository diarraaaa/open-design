import { describe, expect, it } from "vitest";
import { exactStorageObject } from "../src/exact-storage.js";

const digest = "a".repeat(64);
const release = { channel: "betahyx", releaseVersion: "0.1.0-betahyx.1" } as const;

describe("exact distribution object identity", () => {
  it("separates immutable versions, targets and explicitly mutable pointers", () => {
    expect(exactStorageObject({ ...release, kind: "release-head" })).toEqual({ key: "betahyx/0.1.0-betahyx.1/channel-head.json", mutable: false });
    expect(exactStorageObject({ channel: release.channel, kind: "channel-head" })).toEqual({ key: "betahyx/latest/channel-head.json", mutable: true });
    for (const target of ["darwin-arm64", "darwin-x64", "win32-x64"] as const) {
      expect(exactStorageObject({ ...release, kind: "metadata", target, lane: "content" })).toEqual({ key: `betahyx/${release.releaseVersion}/${target}/content-metadata.json`, mutable: false });
      expect(exactStorageObject({ ...release, kind: "accepted", target, digest })).toEqual({ key: `betahyx/accepted/electron/${target}/${release.releaseVersion}-${digest}.json`, mutable: false });
      expect(exactStorageObject({ channel: release.channel, kind: "accepted-head", target }).mutable).toBe(true);
    }
  });

  it("shares bytes across versions without sharing channel or target scope", () => {
    const artifact = { channel: "betahyx", kind: "artifact", target: "darwin-arm64", component: "electron-capsule", digest, file: "capsule.zip" } as const;
    const first = exactStorageObject(artifact);
    expect(first).toEqual({ key: `betahyx/artifacts/darwin-arm64/electron-capsule/${digest}/capsule.zip`, mutable: false });
    expect(exactStorageObject({ ...artifact, channel: "stable" }).key).not.toBe(first.key);
    expect(exactStorageObject({ ...artifact, target: "darwin-x64" }).key).not.toBe(first.key);
    expect(exactStorageObject({ channel: "betahyx", kind: "resource", target: "common", resource: "design-systems", digest })).toEqual({ key: `betahyx/artifacts/common/resources/design-systems/${digest}/resource.zip`, mutable: false });
  });

  it.each(["../stable", "a/b", "a\\b", "%2f", ".", "", "a?b", "a#b"])("rejects unsafe scope %s before constructing any URL", (channel) => {
    expect(() => exactStorageObject({ channel, kind: "channel-head" })).toThrow();
  });

  it("rejects unsupported targets, malformed digests and unknown operations at runtime", () => {
    const artifact = { channel: "betahyx", kind: "artifact", target: "darwin-arm64", component: "electron-carrier", digest, file: "Open Design.dmg" } as const;
    expect(exactStorageObject(artifact).key).toContain("Open Design.dmg");
    for (const mutation of [{ target: "linux-x64" }, { target: "common" }, { component: "unknown" }, { digest: "z".repeat(64) }, { file: "../outside" }, { kind: "delete" }]) {
      expect(() => exactStorageObject({ ...artifact, ...mutation } as never)).toThrow();
    }
    expect(() => exactStorageObject({ ...release, kind: "metadata", target: "darwin-arm64", lane: "capsule" } as never)).toThrow();
  });
});
