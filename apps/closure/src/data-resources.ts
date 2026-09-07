/** Product-owned data inputs. Selection and activation belong to the Closure
 * generation; these groups never have their own update pointer. */
export const CLOSURE_DATA_RESOURCES = Object.freeze([
  { id: "skills", inputs: [{ source: "skills", prefix: "" }] },
  { id: "design-templates", inputs: [{ source: "design-templates", prefix: "" }] },
  { id: "design-systems", inputs: [{ source: "design-systems", prefix: "" }] },
  { id: "craft", inputs: [{ source: "craft", prefix: "" }] },
  { id: "plugins", inputs: [{ source: "plugins/_official", prefix: "_official" }, { source: "plugins/registry", prefix: "registry" }] },
  { id: "frames", inputs: [{ source: "assets/frames", prefix: "" }] },
  { id: "community-pets", inputs: [{ source: "assets/community-pets", prefix: "" }] },
  { id: "prompt-templates", inputs: [{ source: "prompt-templates", prefix: "" }] },
  { id: "plugin-previews", inputs: [{ source: "data/plugin-previews", prefix: "" }] },
] as const);
export type ClosureDataResourceId = typeof CLOSURE_DATA_RESOURCES[number]["id"];
