import { describe, expect, it } from 'vitest';
import { githubOutput, imageTags, parseTag } from '#/version';

describe('parseTag', () => {
  it('gives a stable release its full, minor and latest tags', () => {
    expect(parseTag('v1.2.3')).toEqual({
      version: '1.2.3',
      prerelease: false,
      latest: true,
      tags: ['1.2.3', '1.2', 'latest'],
    });
  });

  it('gives a release candidate only its own tag, never latest', () => {
    expect(parseTag('v0.1.0-rc.4')).toEqual({
      version: '0.1.0-rc.4',
      prerelease: true,
      latest: false,
      tags: ['0.1.0-rc.4'],
    });
  });

  it.each([
    'v1.2',
    '1.2.3',
    'v01.2.3',
    'v1.2.3-rc.0',
    'v1.2.3-rc',
    'v1.2.3-beta.1',
    'v1.2.3-rc.1+build',
    'v1.2.3 ',
    'v1.2.3\nlatest',
    'vlatest',
    '',
  ])('refuses %j, so a stray tag publishes nothing', (tag) => {
    expect(() => parseTag(tag)).toThrow(/not a release tag/u);
  });

  it('never lets a prerelease through with latest, whatever the candidate number', () => {
    for (let n = 1; n < 30; n += 1) {
      expect(parseTag(`v2.0.0-rc.${String(n)}`).tags).not.toContain('latest');
    }
  });
});

describe('parseTag beside the tags that exist', () => {
  const existing = ['v0.9.0', 'v1.0.0', 'v1.0.1', 'v1.1.0', 'v1.2.0-rc.1', 'v2.0.0'];

  it('moves latest and the minor tag to a release that is the newest of each', () => {
    expect(parseTag('v2.0.1', existing)).toMatchObject({
      latest: true,
      tags: ['2.0.1', '2.0', 'latest'],
    });
  });

  it('leaves latest where it is when an older line is patched, and moves its minor tag', () => {
    expect(parseTag('v1.1.1', existing)).toMatchObject({
      latest: false,
      tags: ['1.1.1', '1.1'],
    });
  });

  it('leaves the minor tag too when a patch is older than one that exists', () => {
    expect(parseTag('v1.0.0', existing)).toMatchObject({ latest: false, tags: ['1.0.0'] });
  });

  it('ignores candidates, and the tag being released, when finding the newest', () => {
    expect(parseTag('v2.0.0', existing)).toMatchObject({ latest: true });
    expect(parseTag('v1.2.0', existing)).toMatchObject({ latest: false, tags: ['1.2.0', '1.2'] });
  });

  it('never gives a candidate latest, and says so', () => {
    expect(parseTag('v3.0.0-rc.1', existing)).toMatchObject({ latest: false });
  });

  it('keeps latest for the first stable release, when none exists', () => {
    expect(parseTag('v0.1.0', ['v0.1.0-rc.1', 'v0.1.0-rc.3'])).toMatchObject({
      latest: true,
      tags: ['0.1.0', '0.1', 'latest'],
    });
  });
});

describe('imageTags', () => {
  it('names each tag on a lower-cased repository', () => {
    expect(imageTags('ghcr.io/WizzyWit/Odudu', parseTag('v1.2.3'))).toEqual([
      'ghcr.io/wizzywit/odudu:1.2.3',
      'ghcr.io/wizzywit/odudu:1.2',
      'ghcr.io/wizzywit/odudu:latest',
    ]);
  });

  it('refuses a repository that is not a registry path', () => {
    expect(() => imageTags('ghcr.io/x/odudu:latest', parseTag('v1.0.0'))).toThrow(/repository/u);
    expect(() => imageTags('', parseTag('v1.0.0'))).toThrow(/repository/u);
  });
});

describe('githubOutput', () => {
  it('writes the version, the prerelease flag and one tag per line', () => {
    const lines = githubOutput('ghcr.io/o/odudu', parseTag('v1.0.0-rc.1')).split('\n');
    expect(lines).toEqual([
      'version=1.0.0-rc.1',
      'prerelease=true',
      'latest=false',
      'tags<<ODUDU_TAGS',
      'ghcr.io/o/odudu:1.0.0-rc.1',
      'ODUDU_TAGS',
      '',
    ]);
  });
});
