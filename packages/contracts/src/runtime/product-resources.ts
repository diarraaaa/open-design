/** Product data groups, selected together by a Closure generation. Paths are
 * supplied by the runtime owner; this contract neither acquires nor activates. */
export const OPEN_DESIGN_DATA_RESOURCE_IDS = Object.freeze([
  "skills", "design-templates", "design-systems", "craft", "plugins",
  "frames", "community-pets", "prompt-templates", "plugin-previews",
] as const);
export type OpenDesignDataResourceId = typeof OPEN_DESIGN_DATA_RESOURCE_IDS[number];
export const OPEN_DESIGN_DATA_RESOURCE_ROOTS_ENV = "OD_DATA_RESOURCE_ROOTS";
export type OpenDesignDataResourceRoots = Readonly<{
  schemaVersion: 1;
  roots: Readonly<Record<OpenDesignDataResourceId, string>>;
}>;

export function validateOpenDesignDataResourceRoots(input: unknown): OpenDesignDataResourceRoots {
  const object = (value: unknown): Record<string, unknown> => {
    if (value == null || typeof value !== "object" || Array.isArray(value)) throw new Error("invalid product resource roots");
    return value as Record<string, unknown>;
  };
  const value = object(input), roots = object(value.roots);
  if (value.schemaVersion !== 1 || Object.keys(value).sort().join(",") !== "roots,schemaVersion"
    || Object.keys(roots).sort().join(",") !== [...OPEN_DESIGN_DATA_RESOURCE_IDS].sort().join(",")) {
    throw new Error("product resource roots require the complete versioned data set");
  }
  for (const id of OPEN_DESIGN_DATA_RESOURCE_IDS) {
    if (typeof roots[id] !== "string" || !roots[id].length || roots[id].includes("\0")) throw new Error(`invalid product resource root: ${id}`);
  }
  return Object.freeze({ schemaVersion: 1, roots: Object.freeze({ ...roots }) as OpenDesignDataResourceRoots["roots"] });
}
