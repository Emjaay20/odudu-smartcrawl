import path from 'node:path';
import { GENERATED_DIRS, generatedFiles } from '../../apps/docs/scripts/generate.js';
import { REPO_ROOT } from './markdown.js';

const APP = path.join(REPO_ROOT, 'apps/docs');

// The paths, from the repository root, that the docs build writes and git
// ignores: what the generator plans, taken without writing anything.
export async function plannedGenerated(): Promise<ReadonlySet<string>> {
  const files = await generatedFiles('planned');
  return new Set([...files.keys()].map((name) => path.join(APP, name)));
}

// Directories of generated files, as absolute paths. One source: the generator's own constant.
export const GENERATED_ROOTS: readonly string[] = GENERATED_DIRS.map((dir) => path.join(APP, dir));

export function underGenerated(absolute: string): boolean {
  return GENERATED_ROOTS.some(
    (root) => absolute === root || absolute.startsWith(`${root}${path.sep}`),
  );
}
