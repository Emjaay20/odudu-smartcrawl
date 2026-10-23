const VERSION = /^\d+\.\d+\.\d+(-rc\.\d+)?$/u;
const PLACEHOLDER = /(\$\{ODUDU_IMAGE:-ghcr\.io\/[\w./-]+:)0\.0\.0\}/gu;

// The compose file in the repository names version 0.0.0; the file attached to
// a release names the version it was published with.
export function stampCompose(compose: string, version: string): string {
  if (!VERSION.test(version)) throw new Error(`${JSON.stringify(version)} is not a version`);
  if (compose.search(PLACEHOLDER) === -1) {
    throw new Error('the compose file has no 0.0.0 placeholder image to replace');
  }
  return compose.replace(PLACEHOLDER, `$1${version}}`);
}
