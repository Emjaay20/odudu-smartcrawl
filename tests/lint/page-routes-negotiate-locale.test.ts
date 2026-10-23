import { readFile, glob } from 'node:fs/promises';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const REPO_ROOT = path.resolve(import.meta.dirname, '../..');

// A renderer takes the page's language as its last argument, so a route that
// forgets to negotiate one cannot leave a page in the default: the call that
// omits it is named here, with nothing going red anywhere else.
async function files(pattern: string): Promise<string[]> {
  const found: string[] = [];
  for await (const file of glob(pattern, {
    cwd: REPO_ROOT,
    exclude: (entry) => path.basename(entry) === 'node_modules',
  })) {
    if (!file.endsWith('.test.ts')) found.push(file);
  }
  return found.sort();
}

function closing(text: string, open: number): number {
  let depth = 0;
  for (let at = open; at < text.length; at += 1) {
    const char = text[at];
    if (char === "'" || char === '"' || char === '`') {
      const quote = char;
      at += 1;
      while (at < text.length && text[at] !== quote) at += text[at] === '\\' ? 2 : 1;
    } else if (char === '(' || char === '[' || char === '{') {
      depth += 1;
    } else if (char === ')' || char === ']' || char === '}') {
      depth -= 1;
      if (depth === 0) return at;
    }
  }
  throw new Error('unbalanced call');
}

function lastArgument(args: string): string {
  let depth = 0;
  let start = 0;
  let last = '';
  for (let at = 0; at < args.length; at += 1) {
    const char = args[at];
    if (char === "'" || char === '"' || char === '`') {
      const quote = char;
      at += 1;
      while (at < args.length && args[at] !== quote) at += args[at] === '\\' ? 2 : 1;
    } else if (char === '(' || char === '[' || char === '{') depth += 1;
    else if (char === ')' || char === ']' || char === '}') depth -= 1;
    else if (char === ',' && depth === 0) {
      last = args.slice(start, at);
      start = at + 1;
    }
  }
  const tail = args.slice(start);
  return tail.trim() === '' ? last : tail;
}

describe('every route that renders a page passes the negotiated locale', () => {
  it('ends each renderer call with a locale', async () => {
    const names = new Set<string>();
    for (const file of await files('packages/*/src/view/*-html.ts')) {
      const text = await readFile(path.join(REPO_ROOT, file), 'utf8');
      for (const match of text.matchAll(/^export function (render[A-Z]\w*)\(/gmu)) {
        if (match[1] !== undefined) names.add(match[1]);
      }
    }
    expect(names.size).toBeGreaterThan(20);

    const offences: string[] = [];
    let calls = 0;
    const routes = [
      ...(await files('packages/*/src/view/routes/*.ts')),
      ...(await files('packages/*/src/view/*.ts')),
    ].filter((file) => !file.endsWith('-html.ts'));
    for (const file of routes) {
      const text = await readFile(path.join(REPO_ROOT, file), 'utf8');
      for (const match of text.matchAll(/(?<![\w.])(render[A-Z]\w*)\(/gu)) {
        const name = match[1] ?? '';
        const before = text.slice(Math.max(0, match.index - 9), match.index);
        if (!names.has(name) || before.endsWith('function ')) continue;
        calls += 1;
        const open = match.index + match[0].length - 1;
        const args = text.slice(open + 1, closing(text, open));
        if (!/\blocale\b|requestLocale\(|negotiatePageLocale\(/u.test(lastArgument(args))) {
          const line = text.slice(0, match.index).split('\n').length.toString();
          offences.push(`${file}:${line} ${name}`);
        }
      }
    }
    expect(calls).toBeGreaterThan(30);
    expect(offences).toEqual([]);
  });
});

// The theme rides on the negotiated locale, so the one way a page loses it is
// a negotiation that never passes through withPageTheme. The helpers every
// route reads the locale from are the only places that negotiate.
describe('every negotiation of a page locale carries the theme', () => {
  it('passes the result of negotiatePageLocale through withPageTheme', async () => {
    const offences: string[] = [];
    let negotiating = 0;
    const routes = [
      ...(await files('packages/*/src/view/routes/*.ts')),
      ...(await files('packages/*/src/view/*.ts')),
    ].filter((file) => !file.endsWith('-html.ts'));
    for (const file of routes) {
      const text = await readFile(path.join(REPO_ROOT, file), 'utf8');
      for (const match of text.matchAll(/(?<![\w.])negotiatePageLocale\(/gu)) {
        negotiating += 1;
        const open = match.index + match[0].length - 1;
        const before = text.slice(Math.max(0, match.index - 120), match.index);
        const after = text.slice(closing(text, open) + 1, closing(text, open) + 3);
        const wrapper = /withPageTheme\(\s*$/u.exec(before);
        let cookieArgument = false;
        if (wrapper !== null && after.startsWith(',')) {
          const wrapperOpen = match.index - wrapper[0].length + wrapper[0].indexOf('(');
          const wrapperArgs = text.slice(wrapperOpen + 1, closing(text, wrapperOpen));
          cookieArgument = /^\s*(?:reply\.)?request\.headers\.cookie\s*$/u.test(
            lastArgument(wrapperArgs),
          );
        }
        if (!cookieArgument) {
          const line = text.slice(0, match.index).split('\n').length.toString();
          offences.push(
            `${file}:${line} negotiatePageLocale not wrapped in withPageTheme(…, request.headers.cookie)`,
          );
        }
      }
    }
    expect(negotiating).toBeGreaterThanOrEqual(4);
    expect(offences).toEqual([]);
  });
});
