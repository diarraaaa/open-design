import { canonicalJson, validateStandaloneScope, type StandaloneScope } from "./protocol.js";
import { STANDALONE_HOST_CONTROL_ACTION } from "./host-control.js";
import { validateStandaloneRuntimeLayout, type StandaloneRuntimeLayout } from "./runtime-layout-capability.js";

export type StandaloneHostConnection = Readonly<{
  schemaVersion: 1;
  controlProtocol: typeof STANDALONE_HOST_CONTROL_ACTION;
  scope: StandaloneScope;
  layout: StandaloneRuntimeLayout;
}>;

export function createStandaloneHostConnection(scope: StandaloneScope, layout: StandaloneRuntimeLayout): StandaloneHostConnection {
  return Object.freeze({ schemaVersion: 1, controlProtocol: STANDALONE_HOST_CONTROL_ACTION,
    scope: Object.freeze({ ...validateStandaloneScope(scope) }), layout: validateStandaloneRuntimeLayout(layout) });
}

/**
 * Compatibility within an independently discovered, principal-scoped host.
 * This is not executable authentication or physical-retirement evidence.
 * Writable roots must match; the serving host retains its verified supervisor.
 */
export function validateStandaloneHostConnection(
  input: unknown,
  expected: Readonly<{ scope: StandaloneScope; layout: StandaloneRuntimeLayout }>,
): StandaloneHostConnection {
  if (input == null || typeof input !== "object" || Array.isArray(input)) throw new Error("Standalone host connection is invalid");
  const value = input as StandaloneHostConnection;
  if (JSON.stringify(Object.keys(value).sort()) !== JSON.stringify(["controlProtocol", "layout", "schemaVersion", "scope"])) throw new Error("Standalone host connection fields are invalid");
  if (value.schemaVersion !== 1 || value.controlProtocol !== STANDALONE_HOST_CONTROL_ACTION) throw new Error("Standalone host connection protocol is unsupported");
  if (value.scope == null || JSON.stringify(Object.keys(value.scope).sort()) !== JSON.stringify(["channel", "namespace"])) throw new Error("Standalone host connection scope is invalid");
  const valid = createStandaloneHostConnection(value.scope, value.layout);
  const wanted = createStandaloneHostConnection(expected.scope, expected.layout);
  if (canonicalJson(valid.scope) !== canonicalJson(wanted.scope)) throw new Error("Standalone host connection escaped its scope");
  for (const key of ["dataRoot", "logsRoot", "resourceStoreRoot", "runtimeRoot"] as const) {
    if (valid.layout[key] !== wanted.layout[key]) throw new Error(`Standalone host connection conflicts with ${key}`);
  }
  return valid;
}
