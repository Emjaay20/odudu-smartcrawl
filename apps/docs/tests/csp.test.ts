import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { REPOSITORY_URL } from '#docs/nav.ts';
import { PAGES_BASE } from '#docs/site.config.ts';
import { distDir, htmlFiles, load, walk } from '#docs/tests/support/dist.ts';

function sha256(text: string): string {
  return `sha256-${createHash('sha256').update(text).digest('base64')}`;
}

interface Hashes {
  scriptHashes: string[];
  styleAttributeHashes: string[];
}

function csp(dir: string): Hashes {
  const parsed: unknown = JSON.parse(readFileSync(path.join(dir, 'csp.json'), 'utf8'));
  const lists = (key: string): string[] => {
    const value: unknown =
      typeof parsed === 'object' && parsed !== null ? Reflect.get(parsed, key) : null;
    if (!Array.isArray(value)) throw new Error(`csp.json has no ${key} list`);
    return value.map(String);
  };
  return {
    scriptHashes: lists('scriptHashes'),
    styleAttributeHashes: lists('styleAttributeHashes'),
  };
}

// Read from the bytes of the file, not through the parser the build used, so
// that the build's own extraction is not on both sides of the comparison.
function rawInlineScripts(html: string): string[] {
  return [...html.matchAll(/<script(\s[^>]*)?>([\s\S]*?)<\/script>/gu)]
    .filter(
      ([, attributes]) => !/\ssrc=|\stype="?application\/(?:ld\+)?json/u.test(attributes ?? ''),
    )
    .map(([, , body]) => body ?? '');
}

const ENTITIES: Readonly<Record<string, string>> = {
  '&quot;': '"',
  '&#x27;': "'",
  '&#39;': "'",
  '&lt;': '<',
  '&gt;': '>',
  '&amp;': '&',
};

// An attribute is read only inside a tag. Escaped markup in a transcript
// writes `style=` in its text, which is not an attribute of anything.
const TAG = /<[A-Za-z][^\s>/]*((?:\s+[^\s=>/]+(?:=(?:"[^"]*"|'[^']*'|[^\s>"']+))?)*)\s*\/?>/gu;

function rawStyleAttributes(html: string): string[] {
  return [...html.matchAll(TAG)].flatMap(([, attributes = '']) =>
    [...attributes.matchAll(/\sstyle=(?:"([^"]*)"|'([^']*)'|([^\s>"']+))/gu)].map(
      ([, double, single, bare]) =>
        (double ?? single ?? bare ?? '').replace(
          /&(?:quot|#x27|#39|lt|gt|amp);/gu,
          (e) => ENTITIES[e] ?? e,
        ),
    ),
  );
}

const LOOPBACK_DEFAULT = 'http://localhost:3000';

describe('the policy computed from the image build', () => {
  const dir = distDir('image');
  const files = htmlFiles(dir);
  const hashes = csp(dir);

  it('names the hash of every executable inline script and style attribute the built pages carry', () => {
    const scripts = new Set<string>();
    const styles = new Set<string>();
    for (const file of files) {
      const html = readFileSync(file, 'utf8');
      for (const script of rawInlineScripts(html)) scripts.add(sha256(script));
      for (const style of rawStyleAttributes(html)) styles.add(sha256(style));
    }
    expect([...scripts].sort()).toEqual([...hashes.scriptHashes].sort());
    expect([...styles].sort()).toEqual([...hashes.styleAttributeHashes].sort());
  });

  it('hashes every inline script in every emitted HTML file, not a sample', () => {
    expect(files.length).toBeGreaterThan(20);
    const named = new Set(hashes.scriptHashes);
    const unnamed = files.filter((file) =>
      rawInlineScripts(readFileSync(file, 'utf8')).some((script) => !named.has(sha256(script))),
    );
    expect(unnamed.map((file) => path.relative(dir, file))).toEqual([]);
  });

  it('has exactly one executable inline script per page, the colour-mode initialiser, the same on every page of the build', () => {
    const bodies = files.map((file) => ({
      file: path.relative(dir, file),
      scripts: rawInlineScripts(readFileSync(file, 'utf8')),
    }));
    expect(bodies.filter(({ scripts }) => scripts.length !== 1).map(({ file }) => file)).toEqual(
      [],
    );
    const distinct = new Set(bodies.flatMap(({ scripts }) => scripts));
    expect(distinct.size).toBe(1);
    const [body] = [...distinct];
    expect(body).toContain('theme');
    expect(hashes.scriptHashes).toEqual([sha256(body ?? '')]);
  });

  it('carries no style element, event handler or javascript: URL, which no hash licenses', () => {
    const offenders = files.flatMap((file) => {
      const $ = load(file);
      const found: string[] = [];
      if ($('style').length > 0) found.push('a style element');
      $('*').each((_, element) => {
        for (const name of Object.keys($(element).attr() ?? {})) {
          if (/^on/iu.test(name)) found.push(`an ${name} handler`);
        }
      });
      if ($('[href^="javascript:" i], [src^="javascript:" i]').length > 0)
        found.push('javascript:');
      return found.map((what) => `${path.relative(dir, file)}: ${what}`);
    });
    expect(offenders).toEqual([]);
  });

  it('has no landing page in the image build', () => {
    const home = load(path.join(dir, 'index.html'));
    expect(home('[data-page="docs-home"]')).toHaveLength(1);
    expect(home.text()).not.toContain('Hosted Odudu');
    for (const file of files) {
      const $ = load(file);
      expect($('[data-page="landing"]'), path.relative(dir, file)).toHaveLength(0);
      expect($.text(), path.relative(dir, file)).not.toContain('Hosted Odudu');
    }
  });

  it('contains no link to /odudu/, the hosted copy', () => {
    const offenders = files.filter((file) =>
      /(?:href|src)=["']?\/odudu\//u.test(readFileSync(file, 'utf8')),
    );
    expect(offenders.map((file) => path.relative(dir, file))).toEqual([]);
  });

  it('makes no request to another origin', () => {
    const offenders = files.flatMap((file) => {
      const $ = load(file);
      const absolute = /^(?:[a-z][a-z0-9+.-]*:)?\/\//iu;
      const found: string[] = [];
      $('script[src], img[src], iframe[src], source[src], video[src], audio[src]').each(
        (_, element) => {
          const value = $(element).attr('src') ?? '';
          if (absolute.test(value)) found.push(`src ${value}`);
        },
      );
      $('link[href]').each((_, element) => {
        const value = $(element).attr('href') ?? '';
        if (absolute.test(value)) found.push(`link ${value}`);
      });
      // An anchor is a navigation, not a request the page makes. The repository
      // is named, and the CLI reference states its own loopback default.
      $('a[href]').each((_, element) => {
        const value = $(element).attr('href') ?? '';
        if (
          absolute.test(value) &&
          !value.startsWith(REPOSITORY_URL) &&
          value !== LOOPBACK_DEFAULT
        ) {
          found.push(`a ${value}`);
        }
      });
      return found.map((what) => `${path.relative(dir, file)}: ${what}`);
    });
    expect(offenders).toEqual([]);
  });

  // The build's placeholder `url`, which the theme requires and no page may show.
  it('writes no address of its own into a page or an agent copy', () => {
    const offenders = walk(dir)
      .filter((file) => /\.(?:html|md|txt)$/u.test(file))
      .filter((file) => /https?:\/\/localhost(?!:\d)/iu.test(readFileSync(file, 'utf8')))
      .map((file) => path.relative(dir, file));
    expect(offenders).toEqual([]);
  });
});

describe('the Pages build', () => {
  // Under a base of its own, a link to `/docs/` leaves the site for the server's mount;
  // under the root base `/docs/` is the site's own directory and starts with that base.
  it("links nothing in the image server's mount outside its own base", () => {
    const dir = distDir('pages');
    const offenders = htmlFiles(dir).flatMap((file) =>
      [...readFileSync(file, 'utf8').matchAll(/(?:href|src)=["']?(\/docs\/[^"'\s>]*)/gu)]
        .map((match) => match[1] ?? '')
        .filter((address) => !address.startsWith(PAGES_BASE))
        .map((address) => `${path.relative(dir, file)}: ${address}`),
    );
    expect(offenders).toEqual([]);
  });

  it('carries no policy file of the image', () => {
    expect(existsSync(path.join(distDir('pages'), 'csp.json'))).toBe(false);
  });
});
