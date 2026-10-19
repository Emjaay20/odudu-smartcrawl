import { createHash } from 'node:crypto';
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import * as cheerio from 'cheerio';

export interface Csp {
  readonly scriptHashes: readonly string[];
  readonly styleAttributeHashes: readonly string[];
}

// Types a browser treats as data and never runs. Any other type, a module and
// an import map among them, is subject to `script-src`.
const DATA_TYPES: ReadonlySet<string> = new Set(['application/ld+json', 'application/json']);

function hash(text: string): string {
  return `sha256-${createHash('sha256').update(text).digest('base64')}`;
}

function htmlFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return htmlFiles(full);
    return entry.name.endsWith('.html') ? [full] : [];
  });
}

// The policy licenses an inline script and a style attribute by hash and
// nothing else, so a page that carries anything the hashes cannot cover would
// only break in a browser. Failing the build names the file instead.
function refusal(file: string, what: string): Error {
  return new Error(`${file}: ${what}, which the documentation policy does not license`);
}

// What the pages of a build need the policy to name. A hash is over the bytes
// the browser hashes: a script's text and a style attribute's decoded value.
export function computeCsp(dir: string): Csp {
  const scripts = new Set<string>();
  const styles = new Set<string>();
  for (const file of htmlFiles(dir)) {
    const $ = cheerio.load(readFileSync(file, 'utf8'));
    const where = path.relative(dir, file);
    if ($('style').length > 0) throw refusal(where, 'a <style> element');
    $('script:not([src])').each((_, element) => {
      const type = ($(element).attr('type') ?? '').trim().toLowerCase();
      if (!DATA_TYPES.has(type)) scripts.add(hash($(element).html() ?? ''));
    });
    $('*').each((_, element) => {
      const attributes = $(element).attr() ?? {};
      for (const name of Object.keys(attributes)) {
        if (/^on/iu.test(name)) throw refusal(where, `an inline ${name} handler`);
      }
      const value = attributes.style;
      if (value !== undefined) styles.add(hash(value));
      for (const attribute of ['href', 'src', 'action', 'formaction']) {
        if (/^\s*javascript:/iu.test(attributes[attribute] ?? '')) {
          throw refusal(where, `a javascript: URL in ${attribute}`);
        }
      }
    });
  }
  return { scriptHashes: [...scripts].sort(), styleAttributeHashes: [...styles].sort() };
}

export function writeCsp(dir: string): Csp {
  const csp = computeCsp(dir);
  writeFileSync(path.join(dir, 'csp.json'), `${JSON.stringify(csp, null, 2)}\n`);
  return csp;
}

if (import.meta.main) {
  const target = process.argv[2];
  if (target === undefined) throw new Error('usage: csp.ts <built directory>');
  const csp = writeCsp(path.resolve(target));
  console.log(
    `csp.json: ${String(csp.scriptHashes.length)} script and ${String(csp.styleAttributeHashes.length)} style attribute hashes`,
  );
}
