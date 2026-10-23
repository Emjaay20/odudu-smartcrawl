import { existsSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { REPO_ROOT } from './markdown.js';
import { siteConstants } from './site-constants.js';

const { OWNER_NOTICE, PAGES_BASE, PAGES_DOCS_BASE, REPOSITORY_URL, SITE_ORIGIN } =
  await siteConstants();

// The README is the front door: what Odudu is, a way in, and where the rest
// lives. Anything a reader needs to run it is on the site, and this holds the
// two to each other, so the front door cannot say something the site denies.
const README = readFileSync(path.join(REPO_ROOT, 'README.md'), 'utf8');
const LINES = README.split('\n');
const CONTENT = path.join(REPO_ROOT, 'apps/docs/content/en');
const SITE_DOCS = `${SITE_ORIGIN}${PAGES_DOCS_BASE}`;
const released = existsSync(path.join(REPO_ROOT, '.github/workflows/release.yml'));
// `releases/latest/download` skips pre-releases, so the download address
// answers only once a stable version has a dated section in the changelog.
const stable = /^## \[\d+\.\d+\.\d+\] - \d{4}-\d{2}-\d{2}$/mu.test(
  readFileSync(path.join(REPO_ROOT, 'CHANGELOG.md'), 'utf8'),
);

function section(heading: string): string {
  const start = LINES.findIndex((line) => line === `## ${heading}`);
  if (start === -1) throw new Error(`the README has no "## ${heading}" section`);
  const next = LINES.findIndex((line, index) => index > start && line.startsWith('## '));
  return LINES.slice(start + 1, next === -1 ? undefined : next).join('\n');
}

function images(): { alt: string | undefined; src: string }[] {
  const html = [...README.matchAll(/<img\b[^>]*>/gu)].map((match) => ({
    alt: /\balt="([^"]*)"/u.exec(match[0])?.[1],
    src: /\bsrc="([^"]*)"/u.exec(match[0])?.[1] ?? '',
  }));
  const markdown = [...README.matchAll(/!\[([^\]]*)\]\(([^)\s]+)/gu)].map((match) => ({
    alt: match[1],
    src: match[2] ?? '',
  }));
  return [...html, ...markdown];
}

function links(): string[] {
  const html = [...README.matchAll(/\bhref="([^"]+)"/gu)].map((match) => match[1] ?? '');
  const markdown = [...README.matchAll(/(?<!!)\[[^\]]*\]\(([^)\s]+)\)/gu)].map(
    (match) => match[1] ?? '',
  );
  return [...html, ...markdown];
}

function isRemote(target: string): boolean {
  return /^[a-z][a-z0-9+.-]*:/iu.test(target);
}

function repoPath(target: string): string {
  return path.join(REPO_ROOT, decodeURIComponent(target.split('#')[0] ?? ''));
}

function sitePage(url: string): boolean {
  const route = url.slice(SITE_DOCS.length).split(/[#?]/u)[0]?.replace(/\/$/u, '') ?? '';
  const candidates = [`${route}.md`, `${route}.mdx`, `${route}/index.md`, `${route}/index.mdx`];
  return route === '' || candidates.some((candidate) => existsSync(path.join(CONTENT, candidate)));
}

function codeBlocks(source: string): string[] {
  return [...source.matchAll(/^```[^\n]*\n([\s\S]*?)\n```$/gmu)].map((match) => match[1] ?? '');
}

describe('the README is a front door, not a manual', () => {
  it('fits on a screen or two', () => {
    expect(LINES.length).toBeLessThan(150);
  });

  it('opens with the logo, with alt text, and a dark variant of it', () => {
    const [first] = images();
    expect(first?.src).toBe('brand/lockup.svg');
    expect(first?.alt?.length ?? 0).toBeGreaterThan(0);
    expect(README).toMatch(
      /<source media="\(prefers-color-scheme: dark\)" srcset="brand\/lockup-paper\.svg"/u,
    );
  });

  it('gives every image alt text, and every picture a dark source', () => {
    for (const image of images()) expect(image.alt?.length ?? 0, image.src).toBeGreaterThan(0);
    const pictures = [...README.matchAll(/<picture>[\s\S]*?<\/picture>/gu)].map(
      (match) => match[0],
    );
    expect(pictures.length).toBeGreaterThan(0);
    for (const picture of pictures) {
      expect(picture).toContain('(prefers-color-scheme: dark)');
      expect(picture).toMatch(/\bwidth="\d+"/u);
    }
  });

  it('names no ownership, name origin or trademark claim beyond the notice', () => {
    expect(README).not.toMatch(/Ibibio|Akwa Ibom|coined|®/u);
    expect(README).toContain(OWNER_NOTICE);
  });
});

describe('the badges are the ones that can be checked', () => {
  const badges = images()
    .map((image) => image.src)
    .filter((src) => /^https:\/\/(github\.com\/.+\/badge\.svg|img\.shields\.io\/)/u.test(src));

  it('are the build, the licence and the documentation, plus the release and the image once one is published', () => {
    const expected = [
      `${REPOSITORY_URL}/actions/workflows/verify.yml/badge.svg`,
      'https://img.shields.io/badge/licence-AGPL--3.0--only-blue',
      'https://img.shields.io/badge/docs-read%20them-0b7a5a',
      ...(released
        ? [
            'https://img.shields.io/github/v/release/wizzywit/odudu?include_prereleases',
            'https://img.shields.io/badge/image-ghcr.io%2Fwizzywit%2Fodudu-0b7a5a',
          ]
        : []),
    ];
    expect([...badges].sort()).toEqual([...expected].sort());
  });

  it('link to the page each one reports on', () => {
    expect(README).toContain(`${REPOSITORY_URL}/actions/workflows/verify.yml`);
    expect(README).toContain('(LICENSING.md)');
    expect(README).toContain(SITE_DOCS);
  });

  it('keep the workflow they report on', () => {
    expect(existsSync(path.join(REPO_ROOT, '.github/workflows/verify.yml'))).toBe(true);
  });
});

describe('what it says about the product matches the roadmap', () => {
  const roadmap = readFileSync(path.join(CONTENT, 'roadmap.md'), 'utf8');
  const shipped = roadmap.slice(roadmap.indexOf('## Shipped'), roadmap.indexOf('## Next'));
  const features = section('What it does')
    .split('\n')
    .filter((line) => line.startsWith('- '));

  // What each README feature line is held to: a line of the roadmap's Shipped section.
  const EVIDENCE: readonly (readonly [readme: RegExp, shipped: RegExp])[] = [
    [/authorization code flow with PKCE/iu, /authorization code flow with PKCE, always required/iu],
    [/refresh tokens/iu, /Refresh tokens that rotate/u],
    [/client credentials and token exchange/iu, /Client credentials, and token exchange/u],
    [/single sign-on/iu, /Single sign-on across the apps of one tenant/u],
    [/back-channel logout/iu, /back-channel logout delivered/u],
    [/many tenants/iu, /Any number of tenants on one server/u],
    [/passkeys/iu, /passkeys/u],
    [/recovery codes/iu, /Recovery codes: ten per person/u],
    [/admin API/u, /An admin API of more than a hundred operations/u],
    [/admin console/u, /An admin console with a page for every area/u],
    [/audit/iu, /Every administrative change, sign-in, refusal/u],
    [/one container/iu, /The container image and the Docker Compose quick start/u],
  ];

  it('lists features, and each one is on the roadmap as shipped', () => {
    expect(features.length).toBeGreaterThanOrEqual(8);
    for (const feature of features) {
      const rule = EVIDENCE.find(([readme]) => readme.test(feature));
      expect(rule, `no roadmap evidence is named for: ${feature}`).toBeDefined();
      expect(shipped, feature).toMatch(rule?.[1] ?? /$^/u);
    }
  });

  it('names no feature the roadmap places later or decides against', () => {
    const text = features.join('\n');
    expect(text).not.toMatch(/SAML|LDAP|SCIM|FAPI|implicit|device authorization|CIBA|MCP/u);
  });

  it('says plainly where it stands, links the roadmap, and promises no hosted date or price', () => {
    const status = section('Status');
    expect(status).toMatch(/before 1\.0|pre-1\.0/iu);
    expect(status).toContain(`${SITE_DOCS}roadmap/`);
    expect(status).toMatch(/hosted/iu);
    expect(status).toMatch(/in the works/iu);
    expect(status).not.toMatch(/[$€£]\s?\d|\bpric(e|es|ing)\b|\b20\d\d\b/iu);
  });

  it('keeps the not-production-ready notice at the top', () => {
    const top = LINES.slice(0, 40).join('\n');
    expect(top).toMatch(/Not production ready/u);
    expect(top).toMatch(/security review/iu);
  });
});

describe('the console is on show', () => {
  it('opens with the recording, dark, with alt text describing the flow', () => {
    const [animation] = images().filter((image) => image.src.endsWith('.gif'));
    expect(animation?.src).toBe('docs/media/console.gif');
    expect(animation?.alt).toMatch(/sign/iu);
    expect(animation?.alt).toMatch(/client/iu);
  });

  it('shows a still of the same screen directly under it, then a small gallery', () => {
    const shown = images().map((image) => image.src);
    const at = shown.indexOf('docs/media/console.gif');
    expect(shown[at + 1]).toMatch(/^apps\/docs\/static\/console\/clients-(light|dark)\.webp$/u);
    const gallery = shown.filter((src) => src.startsWith('apps/docs/static/console/'));
    expect(gallery.length).toBeGreaterThanOrEqual(4);
  });

  it('only names images that exist, within a size budget', () => {
    for (const { src } of images().filter((image) => !isRemote(image.src))) {
      expect(existsSync(repoPath(src)), src).toBe(true);
      const kilobytes = statSync(repoPath(src)).size / 1024;
      expect(kilobytes, `${src} is ${kilobytes.toFixed(0)} KB`).toBeLessThan(
        src.endsWith('.gif') ? 1536 : 200,
      );
    }
  });

  it('is a looping GIF 800 pixels wide that lasts 8 to 10 seconds', () => {
    const gif = readFileSync(path.join(REPO_ROOT, 'docs/media/console.gif'));
    expect(gif.subarray(0, 6).toString('latin1')).toBe('GIF89a');
    expect(gif.readUInt16LE(6)).toBe(800);
    expect(gif.toString('latin1')).toContain('NETSCAPE2.0');
    let hundredths = 0;
    for (let at = 0; at + 7 < gif.length; at += 1) {
      if (gif[at] === 0x21 && gif[at + 1] === 0xf9 && gif[at + 2] === 4 && gif[at + 7] === 0) {
        hundredths += gif.readUInt16LE(at + 4);
      }
    }
    expect(hundredths / 100).toBeGreaterThanOrEqual(8);
    expect(hundredths / 100).toBeLessThanOrEqual(10);
  });
});

describe('the quick start in the README is the quick start page', () => {
  const page = readFileSync(path.join(CONTENT, 'quick-start/index.mdx'), 'utf8');
  const onPage = new Set(codeBlocks(page).flatMap((block) => block.split('\n')));
  const [quickstart = ''] = codeBlocks(section('Quick start'));
  const commands = quickstart.split('\n').filter((line) => line.trim() !== '');

  it('is at most five lines', () => {
    expect(commands.length).toBeGreaterThan(0);
    expect(commands.length).toBeLessThanOrEqual(5);
  });

  it('copies each line from a block of the page, byte for byte', () => {
    for (const command of commands) expect(onPage.has(command), command).toBe(true);
  });

  it('carries no operating detail', () => {
    expect(README.match(/ODUDU_[A-Z_]+/gu) ?? []).toEqual([]);
  });

  it('says the download arrives with the first release until a stable one is published', () => {
    expect(section('Quick start').includes('Arrives with the first release.')).toBe(!stable);
  });
});

describe('every link goes somewhere that exists', () => {
  const all = links();

  it('finds the links', () => {
    expect(all.length).toBeGreaterThan(10);
  });

  it('resolves repository files, and pages of the site', () => {
    for (const target of all.filter((link) => !link.startsWith('#'))) {
      if (target.startsWith(SITE_DOCS)) {
        expect(sitePage(target), target).toBe(true);
      } else if (!isRemote(target)) {
        expect(existsSync(repoPath(target)), target).toBe(true);
      }
    }
  });

  it('keeps the site address to the one file that writes it', () => {
    expect(PAGES_BASE.startsWith('/')).toBe(true);
    for (const target of all.filter((link) => /^https:\/\/[a-z0-9-]+\.github\.io/u.test(link))) {
      expect(target.startsWith(SITE_ORIGIN), target).toBe(true);
    }
  });

  it('links the docs, the examples, the roadmap, contributing, security, the licence and the trademark policy', () => {
    for (const wanted of [
      SITE_DOCS,
      'examples/',
      `${SITE_DOCS}roadmap/`,
      'CONTRIBUTING.md',
      'SECURITY.md',
      'LICENSING.md',
      'TRADEMARK.md',
    ]) {
      expect(
        all.some((link) => link.startsWith(wanted)),
        wanted,
      ).toBe(true);
    }
  });

  it('names the licences by LICENSING.md', () => {
    expect(README).toMatch(/AGPL-3\.0/u);
    expect(README).toMatch(/Apache-2\.0/u);
    expect(section('Licence')).toContain('LICENSING.md');
  });
});
