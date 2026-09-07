import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";

/** The tools-facing file envelope, without product or lifecycle implementation. */
export async function runShellFileCommand<T>(parse: (value: unknown) => T, execute: (request: T) => Promise<unknown>): Promise<void> {
  const argument = (name: string) => {
    const index = process.argv.indexOf(name), value = index < 0 ? undefined : process.argv[index + 1];
    if (value == null || value.startsWith("--")) throw new Error(`${name} is required`);
    return resolve(value);
  };
  const request = parse(JSON.parse(await readFile(argument("--request"), "utf8")));
  const receiptPath = argument("--receipt");
  const receipt = await execute(request);
  await mkdir(dirname(receiptPath), { recursive: true });
  await writeFile(receiptPath, `${JSON.stringify(receipt, null, 2)}\n`, "utf8");
}
