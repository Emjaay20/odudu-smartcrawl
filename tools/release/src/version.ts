export interface ReleaseVersion {
  version: string;
  prerelease: boolean;
  // The tags the image carries, without the repository. A release candidate
  // has only its own: a floating tag must never move to one.
  tags: string[];
}

const RELEASE_TAG = /^v(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(-rc\.[1-9]\d*)?$/u;
const REPOSITORY = /^[a-z0-9.-]+(:\d+)?(\/[a-z0-9._-]+)+$/u;

export function parseTag(tag: string): ReleaseVersion {
  const match = RELEASE_TAG.exec(tag);
  if (match === null) {
    throw new Error(`${JSON.stringify(tag)} is not a release tag: use vMAJOR.MINOR.PATCH or -rc.N`);
  }
  const [, major = '', minor = '', patch = '', candidate] = match;
  const version = `${major}.${minor}.${patch}${candidate ?? ''}`;
  if (candidate !== undefined) return { version, prerelease: true, tags: [version] };
  return { version, prerelease: false, tags: [version, `${major}.${minor}`, 'latest'] };
}

export function imageTags(repository: string, release: ReleaseVersion): string[] {
  const lower = repository.toLowerCase();
  if (!REPOSITORY.test(lower)) {
    throw new Error(`${JSON.stringify(repository)} is not a repository path without a tag`);
  }
  return release.tags.map((tag) => `${lower}:${tag}`);
}

// The format GitHub Actions reads from $GITHUB_OUTPUT.
export function githubOutput(repository: string, release: ReleaseVersion): string {
  return [
    `version=${release.version}`,
    `prerelease=${String(release.prerelease)}`,
    'tags<<ODUDU_TAGS',
    ...imageTags(repository, release),
    'ODUDU_TAGS',
    '',
  ].join('\n');
}
