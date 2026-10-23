import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { releaseNotes } from '../../tools/release/src/notes.ts';
import { stampCompose } from '../../tools/release/src/stamp.ts';
import { parseTag } from '../../tools/release/src/version.ts';

const REPO_ROOT = path.resolve(import.meta.dirname, '../..');

async function read(file: string): Promise<string> {
  return readFile(path.join(REPO_ROOT, file), 'utf8');
}

const WORKFLOW = await read('.github/workflows/release.yml');
const JOBS = ['prepare', 'image', 'release'] as const;

function job(name: string): string {
  const from = WORKFLOW.indexOf(`\n  ${name}:\n`);
  expect(from, `job ${name}`).toBeGreaterThan(-1);
  const rest = WORKFLOW.slice(from + 1);
  const next = /\n {2}[a-z][\w-]*:\n/u.exec(rest.slice(1));
  return next === null ? rest : rest.slice(0, next.index + 1);
}

function permissions(block: string): Record<string, string> {
  const body = /^ {4}permissions:\n((?: {6}[\w-]+: \w+\n)+)/mu.exec(block)?.[1] ?? '';
  const granted: Record<string, string> = {};
  for (const [, scope = '', level = ''] of body.matchAll(/^ {6}([\w-]+): (\w+)$/gmu)) {
    granted[scope] = level;
  }
  return granted;
}

function steps(block: string): string[] {
  return block.split(/^ {6}- /mu).slice(1);
}

describe('the release workflow', () => {
  it('runs on a pushed v* tag, and by hand, and on nothing else', () => {
    const on = /^on:\n([\s\S]*?)\n\npermissions:/mu.exec(WORKFLOW)?.[1] ?? '';
    expect(on).toContain("tags: ['v*']");
    expect(on).toContain('workflow_dispatch:');
    expect(on).not.toMatch(/branches:|pull_request|schedule:|workflow_run/u);
    expect(WORKFLOW).not.toContain('pull_request_target');
  });

  it('grants nothing by default and each job exactly what it uses', () => {
    expect(WORKFLOW).toMatch(/^permissions: \{\}$/mu);
    expect(permissions(job('prepare'))).toEqual({ contents: 'read', checks: 'read' });
    expect(permissions(job('image'))).toEqual({
      contents: 'read',
      packages: 'write',
      'id-token': 'write',
    });
    expect(permissions(job('release'))).toEqual({ contents: 'write' });
  });

  it('gives packages and id-token write to the job that pushes and signs, and contents write to the one that releases', () => {
    for (const name of JOBS) {
      const block = job(name);
      expect(block.includes('packages: write'), `${name} packages`).toBe(name === 'image');
      expect(block.includes('id-token: write'), `${name} id-token`).toBe(name === 'image');
      expect(block.includes('contents: write'), `${name} contents`).toBe(name === 'release');
    }
  });

  it('pins every action to a commit, names the version beside it, and runs no local action', () => {
    const uses = [...WORKFLOW.matchAll(/^\s+(?:- )?uses: (\S+)(.*)$/gmu)];
    expect(uses.length).toBeGreaterThan(8);
    for (const [, action = '', rest = ''] of uses) {
      expect(action, action).toMatch(/^[\w.-]+\/[\w.-]+@[0-9a-f]{40}$/u);
      expect(rest.trim(), action).toMatch(/^# v\d+\.\d+\.\d+$/u);
    }
  });

  it('uses the workflow token alone: no secret, no personal token', () => {
    expect(WORKFLOW).not.toMatch(/secrets\./u);
    expect(WORKFLOW).not.toMatch(/\bPAT\b|personal/iu);
    expect(WORKFLOW.match(/\$\{\{ github\.token \}\}/gu)?.length).toBeGreaterThanOrEqual(3);
  });

  it('keeps no credential in the checkout', () => {
    const checkouts = WORKFLOW.match(/uses: actions\/checkout@/gu) ?? [];
    const careful =
      WORKFLOW.match(
        /uses: actions\/checkout@\S+[^\n]*\n {8}with:\n {10}persist-credentials: false\n/gu,
      ) ?? [];
    expect(checkouts).toHaveLength(3);
    expect(careful).toHaveLength(3);
  });

  it('never puts an expression inside a script, where a tag name could become a command', () => {
    for (const step of JOBS.flatMap((name) => steps(job(name)))) {
      const script = /\n {8}run: (?:\|\n)?([\s\S]*)$/u.exec(step)?.[1];
      if (script === undefined) continue;
      expect(script, step.split('\n')[0]).not.toContain('${{');
    }
  });

  it('runs the image and the release only after prepare, and releases only after the image', () => {
    expect(job('image')).toMatch(/^ {4}needs: prepare$/mu);
    expect(job('release')).toMatch(/^ {4}needs: \[prepare, image\]$/mu);
  });

  it('refuses a commit the gate has not passed, naming the check, before building', () => {
    const block = job('prepare');
    expect(block).toContain('select(.name == "gate" and .conclusion == "success")');
    expect(block).toMatch(/if: github\.event_name == 'push'\n\s+env:\n\s+GH_TOKEN/u);
    expect(block).toContain('commits/$GITHUB_SHA/check-runs');
  });

  it('takes the version and the image tags from the script that refuses a stray tag', () => {
    const block = job('prepare');
    expect(block).toContain('node tools/release/src/index.ts tags "$TAG" "$IMAGE"');
    expect(job('image')).toContain('tags: ${{ needs.prepare.outputs.tags }}');
    expect(WORKFLOW).not.toContain('type=raw');
    expect(WORKFLOW).not.toContain('docker/metadata-action');
  });

  it('never tags a prerelease latest, and never makes it the latest release', () => {
    expect(parseTag('v0.1.0-rc.1').tags).not.toContain('latest');
    expect(parseTag('v0.1.0').tags).toContain('latest');
    const release = job('release');
    expect(release).toContain('kind=(--latest)');
    expect(release).toContain('if [ "$PRERELEASE" = "true" ]; then kind=(--prerelease); fi');
  });

  it('builds both architectures in one build, with an SBOM and provenance attached', () => {
    const image = job('image');
    expect(image).toContain('platforms: linux/amd64,linux/arm64');
    expect(image).toContain('docker/setup-qemu-action@');
    expect(image).toContain('sbom: true');
    expect(image).toContain('provenance: mode=max');
    expect(image).toContain('ODUDU_VERSION=${{ needs.prepare.outputs.version }}');
    expect(image).toContain('ODUDU_REVISION=${{ github.sha }}');
  });

  it('fails the release when the pushed image lacks either architecture', () => {
    const image = job('image');
    expect(image).toContain('docker buildx imagetools inspect "$IMAGE@$DIGEST"');
    expect(image).toContain("grep -q 'Platform:.*linux/amd64' manifest.txt");
    expect(image).toContain("grep -q 'Platform:.*linux/arm64' manifest.txt");
  });

  it('signs and verifies by digest, never by tag, against this workflow as the signer', () => {
    const lines = WORKFLOW.split('\n').filter((line) => /cosign (sign|verify)\b/u.test(line));
    expect(lines).toHaveLength(2);
    for (const line of lines) expect(line).toContain('"$IMAGE@$DIGEST"');
    expect(WORKFLOW).toContain(
      '--certificate-identity-regexp "^https://github.com/$GITHUB_REPOSITORY/\\.github/workflows/release\\.yml@refs/tags/v"',
    );
    expect(WORKFLOW).toContain(
      '--certificate-oidc-issuer https://token.actions.githubusercontent.com',
    );
    expect(WORKFLOW).not.toMatch(/IMAGE:\$\{?\w+/u);
  });

  it('builds without publishing when run by hand: nothing is pushed, signed or released', () => {
    const image = job('image');
    expect(image).toContain("push: ${{ github.event_name == 'push' }}");
    const afterBuild = image.slice(image.indexOf('- id: build'));
    const [, ...later] = steps(afterBuild.replace(/^/u, '      - '));
    expect(later.length).toBeGreaterThan(4);
    for (const step of later) {
      expect(step, step.split('\n')[0]).toContain("if: github.event_name == 'push'");
    }
    expect(image).toMatch(/Log in to ghcr\.io\n\s+if: github\.event_name == 'push'/u);
    expect(job('release')).toMatch(/^ {4}if: github\.event_name == 'push'$/mu);
  });

  it('attaches the stamped compose file, the SBOM and the checksums to the release', () => {
    const release = job('release');
    expect(release).toContain(
      'stamp-compose quickstart/compose.yaml "$VERSION" > assets/compose.yaml',
    );
    expect(release).toContain('sha256sum compose.yaml odudu-sbom.json > SHA256SUMS');
    expect(release).toContain(
      'gh release create "$TAG" assets/compose.yaml assets/odudu-sbom.json assets/SHA256SUMS',
    );
    expect(release).toContain('--verify-tag');
    expect(release).toContain('--notes-file notes.md');
  });

  it('checks the release notes and the compose file before any image is built', () => {
    const prepare = job('prepare');
    expect(prepare).toContain('index.ts notes CHANGELOG.md "$VERSION"');
    expect(prepare).toContain('index.ts stamp-compose quickstart/compose.yaml "$VERSION"');
  });

  it('serialises runs of one ref without cancelling a publish halfway', () => {
    expect(WORKFLOW).toMatch(
      /^concurrency:\n {2}group: release-\$\{\{ github\.ref \}\}\n {2}cancel-in-progress: false$/mu,
    );
  });

  it('has a timeout on every job', () => {
    for (const name of JOBS) expect(job(name), name).toMatch(/^ {4}timeout-minutes: \d+$/mu);
  });
});

describe('the files a release rests on', () => {
  it('stamps the compose file the repository holds in exactly its two image lines', async () => {
    const compose = await read('quickstart/compose.yaml');
    const before = compose.split('\n');
    const changed = stampCompose(compose, '1.2.3')
      .split('\n')
      .filter((line, index) => line !== before[index]);
    expect(changed).toEqual([
      '    image: ${ODUDU_IMAGE:-ghcr.io/wizzywit/odudu:1.2.3}',
      '    image: ${ODUDU_IMAGE:-ghcr.io/wizzywit/odudu:1.2.3}',
    ]);
  });

  it('keeps the placeholder tag in the compose file the repository holds', async () => {
    const compose = await read('quickstart/compose.yaml');
    expect(compose.match(/ghcr\.io\/wizzywit\/odudu:0\.0\.0\}/gu)).toHaveLength(2);
  });

  it('has a changelog in Keep a Changelog form, with a dated section for every release', async () => {
    const changelog = await read('CHANGELOG.md');
    expect(changelog).toContain('keepachangelog.com');
    const headings = [...changelog.matchAll(/^## \[([^\]]+)\](.*)$/gmu)];
    expect(headings[0]?.[1]).toBe('Unreleased');
    for (const [, name = '', rest = ''] of headings.slice(1)) {
      expect(rest, name).toMatch(/^ - \d{4}-\d{2}-\d{2}( \[YANKED\])?$/u);
      expect(releaseNotes(changelog, name).length, name).toBeGreaterThan(20);
      expect(() => parseTag(`v${name}`), name).not.toThrow();
    }
    for (const [, name = ''] of headings) {
      expect(changelog, name).toMatch(
        new RegExp(`^\\[${name.replace('.', '\\.')}\\]: https://`, 'mu'),
      );
    }
  });

  it('groups each release under the headings the form allows', async () => {
    const changelog = await read('CHANGELOG.md');
    const groups = [...changelog.matchAll(/^### (.+)$/gmu)].map((m) => m[1]);
    expect(groups.length).toBeGreaterThan(0);
    for (const group of groups) {
      expect(['Added', 'Changed', 'Deprecated', 'Removed', 'Fixed', 'Security']).toContain(group);
    }
  });
});

describe('RELEASING.md', () => {
  async function releasing(): Promise<string> {
    return read('RELEASING.md');
  }

  it('gives the exact commands to cut a release and to verify the image', async () => {
    const text = await releasing();
    expect(text).toContain('git tag -s');
    expect(text).toContain('git push origin v');
    const verify = text.split('\n').filter((line) => line.startsWith('cosign verify'));
    expect(verify).toEqual([
      "cosign verify ghcr.io/wizzywit/odudu:<version> --certificate-identity-regexp '^https://github.com/wizzywit/odudu/.github/workflows/release.yml@refs/tags/v' --certificate-oidc-issuer https://token.actions.githubusercontent.com",
    ]);
  });

  it('says a release candidate is never latest, and where the compose file comes from', async () => {
    const text = await releasing();
    expect(text).toMatch(/release candidate[^.]*never[^.]*latest/iu);
    expect(text).toContain('releases/latest/download/compose.yaml');
    expect(text).toContain('releases/download/<tag>/compose.yaml');
  });

  it('lists the steps only the owner can take', async () => {
    const text = await releasing();
    for (const step of [
      'Make the package public',
      'Require the checks',
      'private vulnerability reporting',
      'GitHub Pages',
    ]) {
      expect(text, step).toContain(step);
    }
  });

  it('documents the domain swap', async () => {
    const text = await releasing();
    for (const term of [
      'SITE_ORIGIN',
      'PAGES_BASE',
      'Search Console',
      '185.199.108.153',
      '2606:50c0:8000::153',
      'CNAME',
    ]) {
      expect(text, term).toContain(term);
    }
  });
});
