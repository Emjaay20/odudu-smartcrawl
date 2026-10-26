export interface ReleaseVersion {
  version: string;
  prerelease: boolean;
  // Whether the GitHub Release is marked latest, which is when the image is.
  latest: boolean;
  // The tags the image carries, without the repository. A release candidate
  // has only its own: a floating tag must never move to one.
  tags: string[];
}

const RELEASE_TAG = /^v(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(-rc\.[1-9]\d*)?$/u;
const REPOSITORY = /^[a-z0-9.-]+(:\d+)?(\/[a-z0-9._-]+)+$/u;

type Triple = readonly [number, number, number];

function stableTriples(tags: readonly string[], except: string): Triple[] {
  return tags
    .filter((each) => each !== except)
    .flatMap((each) => {
      const match = RELEASE_TAG.exec(each);
      if (match === null || match[4] !== undefined) return [];
      return [[Number(match[1]), Number(match[2]), Number(match[3])] as const];
    });
}

const isNewer = (a: Triple, b: Triple): boolean =>
  a[0] !== b[0] ? a[0] > b[0] : a[1] !== b[1] ? a[1] > b[1] : a[2] > b[2];

// `existing` is the repository's tags. A release moves `latest` only when no
// stable release is newer, and its `X.Y` tag only when no patch of that line is.
export function parseTag(tag: string, existing: readonly string[] = []): ReleaseVersion {
  const match = RELEASE_TAG.exec(tag);
  if (match === null) {
    throw new Error(`${JSON.stringify(tag)} is not a release tag: use vMAJOR.MINOR.PATCH or -rc.N`);
  }
  const [, major = '', minor = '', patch = '', candidate] = match;
  const version = `${major}.${minor}.${patch}${candidate ?? ''}`;
  if (candidate !== undefined) {
    return { version, prerelease: true, latest: false, tags: [version] };
  }
  const self: Triple = [Number(major), Number(minor), Number(patch)];
  const others = stableTriples(existing, tag);
  const newerThan = (among: Triple[]): boolean => among.some((other) => isNewer(other, self));
  const latest = !newerThan(others);
  const lineIsNewest = !newerThan(others.filter((o) => o[0] === self[0] && o[1] === self[1]));
  return {
    version,
    prerelease: false,
    latest,
    tags: [version, ...(lineIsNewest ? [`${major}.${minor}`] : []), ...(latest ? ['latest'] : [])],
  };
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
    `latest=${String(release.latest)}`,
    'tags<<ODUDU_TAGS',
    ...imageTags(repository, release),
    'ODUDU_TAGS',
    '',
  ].join('\n');
}
