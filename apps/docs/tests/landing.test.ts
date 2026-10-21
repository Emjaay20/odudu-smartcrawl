import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fromMarkdown } from 'mdast-util-from-markdown';
import { describe, expect, it } from 'vitest';
import { JOURNEYS, SECTIONS } from '#docs/nav.ts';
import { PAGES_BASE } from '#docs/site.config.ts';
import { DOCS_ROOT, distDir, fileOf, load } from '#docs/tests/support/dist.ts';

const REPO_ROOT = path.resolve(DOCS_ROOT, '../..');
const NOTICE =
  'Odudu and the staff mark are the property of Wisdom Praise. The software is licensed under the AGPL; the name and the mark are used under the trademark policy.';

const $ = load(path.join(distDir('pages'), 'index.html'));
const landing = $('[data-page="landing"]');

function quickStartCommand(): string {
  const source = readFileSync(path.join(DOCS_ROOT, 'content/en/quick-start/index.mdx'), 'utf8');
  const first = fromMarkdown(source.replace(/^---\n[\s\S]*?\n---\n/u, '')).children.find(
    (node) => node.type === 'code',
  );
  if (first?.type !== 'code') throw new Error('the quick start has no code block');
  return first.value;
}

function hrefs(scope: ReturnType<typeof $>): string[] {
  return scope
    .find('a[href]')
    .map((_, element) => $(element).attr('href') ?? '')
    .get();
}

function exists(href: string): boolean {
  const pathname = new URL(href, 'https://placeholder.test').pathname;
  const file = fileOf(distDir('pages'), PAGES_BASE, pathname);
  return file !== null && existsSync(file);
}

describe('the landing page as built', () => {
  it('is the page at the site root and has one h1', () => {
    expect(landing).toHaveLength(1);
    expect($('h1')).toHaveLength(1);
    expect(landing.find('h1')).toHaveLength(1);
  });

  it('prints the quick start command and no other, for each shell', () => {
    const command = quickStartCommand().trim();
    const printed = landing.find('code[data-shell]');
    expect(printed.length).toBeGreaterThanOrEqual(2);
    const unix = landing.find('code[data-shell="unix"]').text();
    expect(unix).toBe(command);
    const windows = landing.find('code[data-shell="windows"]').text();
    expect(windows).toContain('compose.yaml');
    expect(windows).toContain('docker compose up -d');
    expect(windows).toContain('curl.exe');
    for (const text of [unix, windows]) {
      expect(text).toMatch(/^[\x20-\x7e]+$/u);
    }
  });

  it('does not say where the name comes from', () => {
    const text = landing.text();
    expect(text).not.toMatch(/ibibio|akwa ibom|coined|means authority/iu);
  });

  it('says it is not ready for production, and what is planned is said to be planned', () => {
    const text = landing.text();
    expect(text).toMatch(/not ready for production/iu);
    const ai = landing.find('[data-section="agents"]');
    expect(ai).toHaveLength(1);
    expect(ai.text()).toMatch(/planned/iu);
    expect(ai.text()).toMatch(/not built yet/iu);
    expect(hrefs(ai)).toContain(`${PAGES_BASE}llms.txt`);
    expect(exists(`${PAGES_BASE}llms.txt`)).toBe(true);
  });

  it('presents Hosted Odudu as planned, with nothing to buy or join', () => {
    const hosted = landing.find('[data-section="hosted"]');
    expect(hosted).toHaveLength(1);
    expect(hosted.text()).toContain('in the works');
    expect(hosted.find('form, input, button, textarea, select')).toHaveLength(0);
    const links = hosted.find('a');
    expect(hrefs(hosted)).toEqual([`${PAGES_BASE}roadmap/`]);
    const forbidden = /pricing|price|buy|checkout|sign.?up|subscribe|trial|waitlist|\$\d/iu;
    links.each((_, element) => {
      expect($(element).text()).not.toMatch(forbidden);
      expect($(element).attr('href') ?? '').not.toMatch(forbidden);
    });
    expect(hosted.text()).not.toMatch(/[$€£¥]/u);
    expect(landing.find('a[href^="mailto:"]')).toHaveLength(0);
    expect(landing.find('form')).toHaveLength(0);
  });

  it('collects nothing: its only inputs are the shell choice', () => {
    const inputs = landing.find('input');
    expect(inputs.length).toBeGreaterThan(0);
    inputs.each((_, element) => {
      expect($(element).attr('type')).toBe('radio');
    });
  });

  it('lists at least six capabilities, each linking to a page the build wrote', () => {
    const items = landing.find('[data-section="capabilities"] li a[href]');
    expect(items.length).toBeGreaterThanOrEqual(6);
    for (const href of hrefs(landing.find('[data-section="capabilities"]'))) {
      expect(exists(href), href).toBe(true);
    }
  });

  it('has four reader paths, each linking to a page the build wrote', () => {
    const readers = landing.find('[data-section="readers"] a[href]');
    expect(readers).toHaveLength(4);
    for (const href of hrefs(landing.find('[data-section="readers"]'))) {
      expect(exists(href), href).toBe(true);
    }
  });

  it('shows the four examples, each beside the guide that walks through it', () => {
    const examples = landing.find('[data-section="examples"] li');
    expect(examples).toHaveLength(4);
    const guides = hrefs(landing.find('[data-section="examples"]')).filter((href) =>
      href.startsWith(`${PAGES_BASE}guides/`),
    );
    expect(guides.sort()).toEqual(
      ['web-app', 'single-page-app', 'api', 'machine-to-machine']
        .map((name) => `${PAGES_BASE}guides/${name}/`)
        .sort(),
    );
  });

  it('links every section of the documentation and every journey', () => {
    const all = hrefs(landing);
    for (const section of SECTIONS) expect(all).toContain(`${PAGES_BASE}${section.route}`);
    for (const journey of JOURNEYS) expect(all).toContain(`${PAGES_BASE}${journey.route}`);
  });

  it('links the comparison pages and the roadmap', () => {
    const compare = landing.find('[data-section="compare"]');
    expect(hrefs(compare)).toEqual(
      expect.arrayContaining([
        `${PAGES_BASE}introduction/compare/`,
        `${PAGES_BASE}guides/keycloak/`,
        `${PAGES_BASE}roadmap/`,
      ]),
    );
  });

  it('puts the hero image first in the page: sized, high priority and never lazy', () => {
    const images = landing.find('img');
    const hero = images.first();
    expect(hero.attr('fetchpriority')).toBe('high');
    expect(hero.attr('loading')).toBeUndefined();
    expect(hero.attr('width')).toBeDefined();
    expect(hero.attr('height')).toBeDefined();
    expect(hero.attr('src') ?? '').toMatch(/\.webp$/u);
    images.each((_, element) => {
      const image = $(element);
      expect(image.attr('alt'), image.attr('src')).toBeDefined();
      expect(image.attr('width'), image.attr('src')).toBeDefined();
      expect(image.attr('height'), image.attr('src')).toBeDefined();
      if (image.attr('fetchpriority') === 'high') expect(image.attr('loading')).toBeUndefined();
    });
    const lazy = images.filter((_, element) => $(element).attr('loading') === 'lazy');
    expect(lazy.length).toBeGreaterThan(0);
  });

  it('carries the ownership notice exactly when the trademark policy exists', () => {
    const footer = $('footer').text();
    const present = existsSync(path.join(REPO_ROOT, 'TRADEMARK.md'));
    expect(footer.includes(NOTICE)).toBe(present);
  });

  it('names the licences of what it offers, and links where they are explained', () => {
    const licence = landing.find('[data-section="licence"]');
    expect(licence.text()).toContain('AGPL-3.0');
    expect(licence.text()).toContain('Apache-2.0');
    expect(hrefs(licence).some((href) => href.endsWith('/LICENSING.md'))).toBe(true);
  });
});

const roadmap = readFileSync(path.join(DOCS_ROOT, 'content/en/roadmap.md'), 'utf8');
const shipped = roadmap.slice(roadmap.indexOf('## Shipped'), roadmap.indexOf('## Next'));
const sessions = readFileSync(path.join(DOCS_ROOT, 'content/en/concepts/sessions.mdx'), 'utf8');

// What each named capability is held to: a line of the roadmap's Shipped
// section, or, for single sign-on, the Sessions page that explains it.
const EVIDENCE: Record<string, [string, RegExp]> = {
  passwords: [shipped, /Passwords with a policy and lockouts/u],
  passkeys: [shipped, /passkeys/u],
  'authenticator-codes': [shipped, /one-time password from an authenticator app/u],
  'single-sign-on': [shipped, /Single sign-on across the apps of one tenant/u],
  'back-channel-logout': [shipped, /back-channel logout delivered to the apps that registered/u],
};

describe('the sign-in pictures', () => {
  const flow = landing.find('[data-section="signin"]');
  const steps = flow.find('ol[data-flow] > li');

  it('has nine steps in three acts, each with a caption and a text alternative', () => {
    expect(flow.find('ol[data-flow]')).toHaveLength(3);
    expect(steps).toHaveLength(9);
    steps.each((_, element) => {
      expect($(element).find('p').text().length).toBeGreaterThan(15);
      expect($(element).find('svg[role="img"]').attr('aria-label') ?? '').not.toBe('');
    });
  });

  it('says what it shows in everyday words, in the page itself', () => {
    const text = flow.text();
    for (const phrase of [
      'A person opens your app.',
      'Your app sends them to Odudu to sign in.',
      'Odudu sends them back with a signed pass, and your app lets them in.',
      'Odudu sees they are already signed in, so it shows no sign-in page.',
      'Sign out of one, and the apps that registered for it are told.',
    ]) {
      expect(text).toContain(phrase);
    }
    expect(text).not.toMatch(/authorization code|pkce|oauth/iu);
  });

  it('names only what ships: every claim has a line in the roadmap, and nothing else is promised', () => {
    const claims = flow
      .find('[data-claim]')
      .map((_, element) => $(element).attr('data-claim') ?? '')
      .get();
    expect(new Set(claims)).toEqual(new Set(Object.keys(EVIDENCE)));
    for (const claim of new Set(claims)) {
      const [source, pattern] = EVIDENCE[claim] ?? ['', /^$/u];
      expect(source, claim).toMatch(pattern);
    }
    expect(sessions).toMatch(/sent straight back signed in/u);
    expect(
      flow.text() +
        flow
          .find('svg')
          .toArray()
          .map((svg) => $(svg).attr('aria-label'))
          .join(' '),
    ).not.toMatch(
      /saml|google|github|social|ldap|federat|brokering|every app\b(?! of that tenant)|all apps/iu,
    );
    expect(
      flow
        .find('ul li')
        .map((_, element) => $(element).text())
        .get(),
    ).toEqual(['Password', 'Passkey', 'Authenticator code']);
  });

  it('links the pages that give the detail', () => {
    expect(hrefs(flow)).toEqual([
      `${PAGES_BASE}concepts/sessions/`,
      `${PAGES_BASE}concepts/tokens/`,
      `${PAGES_BASE}guides/sign-a-user-in/`,
    ]);
  });
});
