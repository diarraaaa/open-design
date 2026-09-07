import { mkdtempSync, mkdirSync, rmSync, symlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { OPEN_DESIGN_DATA_RESOURCE_IDS } from '@open-design/contracts';
import { resolveProductResourceRoots } from '../src/product-resource-paths.js';

const temporary: string[] = [];
afterEach(() => { for (const root of temporary.splice(0)) rmSync(root, { recursive: true, force: true }); });
function fixture() {
  const root = mkdtempSync(join(tmpdir(), 'product-resources-')); temporary.push(root);
  const store = join(root, 'store'); mkdirSync(store);
  const roots = Object.fromEntries(OPEN_DESIGN_DATA_RESOURCE_IDS.map(id => {
    const directory = join(store, id); mkdirSync(directory); return [id, directory];
  }));
  return { root, store, roots, env: { OD_RESOURCE_STORE_ROOT: store, OD_DATA_RESOURCE_ROOTS: JSON.stringify({ schemaVersion: 1, roots }) } };
}
describe('generation-selected product resource paths', () => {
  it('accepts all nine independent roots without imposing a shared resource layout', () => {
    const input = fixture();
    expect(resolveProductResourceRoots(input.env)).toEqual(input.roots);
    expect(resolveProductResourceRoots({})).toBeNull();
  });
  it('rejects missing, unknown and unsupported selections instead of falling back', () => {
    const input = fixture();
    for (const value of ["", "{}", JSON.stringify({ schemaVersion: 2, roots: input.roots }), JSON.stringify({ schemaVersion: 1, roots: { ...input.roots, unknown: input.store } })]) {
      expect(() => resolveProductResourceRoots({ ...input.env, OD_DATA_RESOURCE_ROOTS: value })).toThrow();
    }
    delete input.roots.skills;
    expect(() => resolveProductResourceRoots({ ...input.env, OD_DATA_RESOURCE_ROOTS: JSON.stringify({ schemaVersion: 1, roots: input.roots }) })).toThrow();
  });
  it('rejects relative roots, Store siblings and symlink escapes', () => {
    const input = fixture();
    const outside = join(input.root, 'outside'); mkdirSync(outside);
    const link = join(input.store, 'link'); symlinkSync(outside, link);
    for (const invalid of ['relative', outside, link, input.store]) {
      const roots = { ...input.roots, skills: invalid };
      expect(() => resolveProductResourceRoots({ ...input.env, OD_DATA_RESOURCE_ROOTS: JSON.stringify({ schemaVersion: 1, roots }) })).toThrow();
    }
  });
});
