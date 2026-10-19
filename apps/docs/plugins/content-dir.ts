import path from 'node:path';

export const DEFAULT_CONTENT = 'content/en';
const FIXTURE_ROOT = 'node_modules/.cache/';

// A build may be pointed at another docs tree only for a test, which keeps its
// tree under the build cache; a deploy that inherits the variable by mistake
// would otherwise publish a fixture.
export function contentDir(override: string | undefined): string {
  if (override === undefined || override === '') return DEFAULT_CONTENT;
  const normalised = path.posix.normalize(override.split(path.sep).join('/'));
  if (!normalised.startsWith(FIXTURE_ROOT) || normalised.includes('..')) {
    throw new Error(`DOCS_CONTENT must name a directory under ${FIXTURE_ROOT}, got ${override}`);
  }
  return normalised;
}
