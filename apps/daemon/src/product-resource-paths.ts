import fs from 'node:fs';
import path from 'node:path';
import {
  OPEN_DESIGN_DATA_RESOURCE_ROOTS_ENV,
  validateOpenDesignDataResourceRoots,
  type OpenDesignDataResourceRoots,
} from '@open-design/contracts';

/** Resolve only a complete generation-selected set, never silently fall back to
 * bundled data when an explicit selection is malformed or escapes its Store. */
export function resolveProductResourceRoots(
  env: NodeJS.ProcessEnv = process.env,
): OpenDesignDataResourceRoots['roots'] | null {
  const encoded = env[OPEN_DESIGN_DATA_RESOURCE_ROOTS_ENV];
  if (encoded === undefined) return null;
  const selection = validateOpenDesignDataResourceRoots(JSON.parse(encoded));
  const store = env.OD_RESOURCE_STORE_ROOT;
  if (!store || !path.isAbsolute(store)) throw new Error('product resources require an absolute authorized Store');
  const base = fs.realpathSync(store);
  for (const [id, root] of Object.entries(selection.roots)) {
    if (!path.isAbsolute(root) || path.normalize(root) !== root) throw new Error(`product resource root must be absolute and normalized: ${id}`);
    const resolved = fs.realpathSync(root), relative = path.relative(base, resolved);
    if (!relative || relative === '..' || relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative)
      || !fs.statSync(resolved).isDirectory()) throw new Error(`product resource root escapes its Store: ${id}`);
  }
  return selection.roots;
}
