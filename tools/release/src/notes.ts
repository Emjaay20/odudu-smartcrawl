const VERSION = /^\d+\.\d+\.\d+(-rc\.\d+)?$/u;
const COMMENT = /<!--[\s\S]*?-->/gu;
const LINK_DEFINITION = /^\[[^\]]+\]:\s/u;

// The body of one version's section of a Keep a Changelog file.
export function releaseNotes(changelog: string, version: string): string {
  if (!VERSION.test(version)) throw new Error(`${JSON.stringify(version)} is not a version`);
  const lines = changelog.split('\n');
  const start = lines.findIndex((line) => line.startsWith(`## [${version}]`));
  if (start === -1) throw new Error(`CHANGELOG.md has no section for ${version}`);
  const rest = lines.slice(start + 1);
  const next = rest.findIndex((line) => line.startsWith('## '));
  const body = (next === -1 ? rest : rest.slice(0, next))
    .filter((line) => !LINK_DEFINITION.test(line))
    .join('\n')
    .replace(COMMENT, '')
    .replace(/\n{3,}/gu, '\n\n')
    .trim();
  if (body === '') throw new Error(`the section for ${version} in CHANGELOG.md is empty`);
  return body;
}
