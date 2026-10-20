import { globSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { DOCS_ROOT } from '#docs/tests/support/dist.ts';

const REPO = path.resolve(DOCS_ROOT, '../..');
const PAGE = path.join(DOCS_ROOT, 'content/en/quick-start/index.mdx');

// Where a name a page quotes can be defined: the console's own sources, and
// the sign-in page's messages, which the console sends people to.
const SOURCES = [
  ...globSync('apps/admin-console/src/**/*.{ts,tsx}', {
    cwd: REPO,
    exclude: (entry) => /\.test\.|\/testing\/|\/gallery\//u.test(entry),
  }),
  'packages/protocol-oidc/src/view/messages.ts',
];
const corpus = SOURCES.flatMap((file) => readFileSync(path.join(REPO, file), 'utf8').split('\n'));

const escape = (text: string): string => text.replaceAll(/[.*+?^${}()|[\]\\]/gu, '\\$&');

// A line that defines the name: it is the whole line (JSX text), or it sits in
// quotes, backticks or between tags.
function defined(name: string): boolean {
  const quoted = new RegExp(`(^|['"\`>])${escape(name)}(['"\`<]|$)`, 'iu');
  return corpus.some(
    (line) => line.trim().toLowerCase() === name.toLowerCase() || quoted.test(line),
  );
}

// `Enter ${name}` defines "Enter demo".
const TEMPLATES = corpus
  .flatMap((line) => [...line.matchAll(/`([^`$]*)\$\{[^}]*\}([^`]*)`/gu)])
  .map((match) => new RegExp(`^${escape(match[1] ?? '')}.+${escape(match[2] ?? '')}$`, 'u'));

function quotedNames(): string[] {
  const text = readFileSync(PAGE, 'utf8');
  const prose = text.replace(/^(`{3,})[\s\S]*?^\1$/gmu, '');
  return [...prose.matchAll(/\*\*([^*]+)\*\*/gu)].map((match) => match[1] ?? '');
}

describe('the names the quick start quotes from the console', () => {
  it('finds the names, so a changed quotation mark fails rather than passing vacuously', () => {
    expect(quotedNames().length).toBeGreaterThan(15);
    expect(corpus.length).toBeGreaterThan(1000);
  });

  it('are defined by the console or the sign-in page', () => {
    const missing = quotedNames().filter(
      (name) => !defined(name) && !TEMPLATES.some((template) => template.test(name)),
    );
    expect(missing).toEqual([]);
  });

  it('would catch a name the console does not have', () => {
    expect(defined('Make it so')).toBe(false);
  });
});
