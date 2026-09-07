import { mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { expect, it, vi } from "vitest";
import { writeJson } from "../src/fs-io.js";
import { ensureManagedBase } from "../src/store.js";

it("uses distinct atomic write files even within one process and millisecond", async () => {
  const root = await mkdtemp(join(tmpdir(), "download-atomic-"));
  const now = vi.spyOn(Date, "now").mockReturnValue(1);
  try {
    const path = join(root, "value.json");
    await Promise.all(Array.from({ length: 32 }, (_, value) => writeJson(path, { value })));
    expect(JSON.parse(await readFile(path, "utf8")).value).toBeTypeOf("number");
    expect(await readdir(root)).toEqual(["value.json"]);
  } finally { now.mockRestore(); await rm(root, { recursive: true, force: true }); }
});

it("coalesces concurrent base initialization but revalidates ownership afterwards", async () => {
  const root = await mkdtemp(join(tmpdir(), "download-base-"));
  try {
    await Promise.all(Array.from({ length: 32 }, () => ensureManagedBase(root)));
    await writeFile(join(root, ".open-design-download-root.json"), "{}");
    await expect(ensureManagedBase(root)).rejects.toThrow("invalid ownership marker");
  } finally { await rm(root, { recursive: true, force: true }); }
});
