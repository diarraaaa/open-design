/** Object naming only. Eligibility, signatures, CAS and publication authority
 * remain in tools-release, not this pure domain primitive. */
export type ExactStorageTarget = "darwin-arm64" | "darwin-x64" | "win32-x64";
export type ExactStorageComponent = "electron-carrier" | "electron-capsule" | "terminal" | "daemon" | "web" | "closure" | "standalone-launcher";
type Version = Readonly<{ releaseVersion: string }>;
export type ExactStorageObjectInput = Readonly<{ channel: string }> & (
  | Readonly<{ kind: "channel-head" }>
  | (Version & Readonly<{ kind: "release-head" }>)
  | (Version & Readonly<{ kind: "metadata"; target: ExactStorageTarget; lane: "content" | "electron" | "terminal" }>)
  | Readonly<{ kind: "artifact"; target: ExactStorageTarget | "common"; component: ExactStorageComponent; digest: string; file: string }>
  | Readonly<{ kind: "resource"; target: ExactStorageTarget | "common"; resource: string; digest: string }>
  | (Version & Readonly<{ kind: "accepted"; target: ExactStorageTarget; digest: string }>)
  | Readonly<{ kind: "accepted-head"; target: ExactStorageTarget }>
);

function segment(value: string): string {
  if (typeof value !== "string" || !/^[A-Za-z0-9][A-Za-z0-9._ -]*$/u.test(value) || value.endsWith(" ") || value.endsWith(".")) throw new Error("unsafe exact object path segment");
  return value;
}
function target(value: string, common = false): string {
  if (!["darwin-arm64", "darwin-x64", "win32-x64", ...(common ? ["common"] : [])].includes(value)) throw new Error("unsupported exact object target");
  return value;
}
function digest(value: string): string {
  if (typeof value !== "string" || !/^[a-f0-9]{64}$/u.test(value)) throw new Error("invalid exact object digest");
  return value;
}

/** Unescaped object keys; URL adapters encode their segments once. Only the
 * two named pointer operations may mutate existing object bytes. */
export function exactStorageObject(input: ExactStorageObjectInput): Readonly<{ key: string; mutable: boolean }> {
  const channel = segment(input.channel);
  let suffix: string;
  let mutable = false;
  switch (input.kind) {
    case "channel-head": suffix = "latest/channel-head.json"; mutable = true; break;
    case "release-head": suffix = `${segment(input.releaseVersion)}/channel-head.json`; break;
    case "metadata": {
      if (!["content", "electron", "terminal"].includes(input.lane)) throw new Error("unsupported exact metadata lane");
      suffix = `${segment(input.releaseVersion)}/${target(input.target)}/${input.lane}-metadata.json`; break;
    }
    case "artifact": {
      if (!["electron-carrier", "electron-capsule", "terminal", "daemon", "web", "closure", "standalone-launcher"].includes(input.component)) throw new Error("unsupported exact artifact component");
      if (input.target === "common" && !["closure", "standalone-launcher"].includes(input.component)) throw new Error("component requires a platform target");
      suffix = `artifacts/${target(input.target, true)}/${input.component}/${digest(input.digest)}/${segment(input.file)}`; break;
    }
    case "resource": suffix = `artifacts/${target(input.target, true)}/resources/${segment(input.resource)}/${digest(input.digest)}/resource.zip`; break;
    case "accepted": suffix = `accepted/electron/${target(input.target)}/${segment(input.releaseVersion)}-${digest(input.digest)}.json`; break;
    case "accepted-head": suffix = `accepted/electron/${target(input.target)}/latest.json`; mutable = true; break;
    default: throw new Error("unsupported exact object kind");
  }
  return Object.freeze({ key: `${channel}/${suffix}`, mutable });
}
