import { glob, readFile } from 'node:fs/promises';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const REPO_ROOT = path.resolve(import.meta.dirname, '../..');

export const MAX_CHARACTERS = 160;
export const MAX_SENTENCES = 2;

// A message a person reads is short and plain: at most 160 characters and two
// sentences. A longer explanation belongs on a docs page the message can name.
// An ICU argument such as `{min, number}` is counted as the one word it
// becomes; there is no allowlist and no waiver. What this cannot see: a
// message assembled from several ids; wording that is short but not plain;
// ICU apostrophe quoting such as '{' (it would confuse the arm reader); a
// catalogue built without createCatalogue( or createTranslators( in the file,
// which is how the files are found.

function closing(text: string, open: number): number {
  let depth = 0;
  for (let at = open; at < text.length; at += 1) {
    if (text[at] === '{') depth += 1;
    if (text[at] === '}') depth -= 1;
    if (depth === 0) return at;
  }
  return text.length - 1;
}

function armsOf(body: string): string[] {
  const arms: string[] = [];
  let at = body.search(/(?:select|plural|selectordinal),/u);
  at = body.indexOf(',', at) + 1;
  for (;;) {
    const open = body.indexOf('{', at);
    if (open === -1) return arms;
    const end = closing(body, open);
    arms.push(body.slice(open + 1, end));
    at = end + 1;
  }
}

// Every text a person can be shown: an argument counts as one word, and a
// select or plural gives one text per arm.
export function renderings(message: string): string[] {
  const open = message.indexOf('{');
  if (open === -1) return [message];
  const end = closing(message, open);
  const inner = message.slice(open + 1, end);
  const rest = renderings(message.slice(end + 1));
  const choices = /^\w+,\s*(?:select|plural|selectordinal),/u.test(inner)
    ? armsOf(inner).flatMap(renderings)
    : ['x'];
  return choices.flatMap((choice) =>
    rest.map((tail) => `${message.slice(0, open)}${choice}${tail}`),
  );
}

function sentencesIn(text: string): number {
  const spoken = text.replace(/\b(e\.g|i\.e|etc)\./giu, '$1');
  return spoken.split(/(?<=[.!?])\s+/u).filter((part) => /\p{L}/u.test(part)).length;
}

export function tooLong(messages: Readonly<Record<string, string>>): string[] {
  return Object.entries(messages).flatMap(([id, message]) =>
    renderings(message).flatMap((text) => {
      const sentences = sentencesIn(text);
      if (text.length <= MAX_CHARACTERS && sentences <= MAX_SENTENCES) return [];
      return [`${id}: ${String(text.length)} characters, ${String(sentences)} sentences`];
    }),
  );
}

function isMessages(value: unknown): value is Record<string, string> {
  return (
    typeof value === 'object' &&
    value !== null &&
    Object.keys(value).length > 0 &&
    Object.values(value).every((entry) => typeof entry === 'string')
  );
}

async function cataloguesInSource(): Promise<string[]> {
  const found: string[] = [];
  for await (const file of glob('packages/*/src/**/*.ts', {
    cwd: REPO_ROOT,
    exclude: (entry) => path.basename(entry) === 'node_modules',
  })) {
    if (file.startsWith('packages/i18n/') || file.endsWith('.test.ts')) continue;
    const source = await readFile(path.join(REPO_ROOT, file), 'utf8');
    if (source.includes('createCatalogue(') || source.includes('createTranslators(')) {
      found.push(file);
    }
  }
  return found.sort();
}

describe('the length check', () => {
  it('passes a short message and one with an argument', () => {
    expect(
      tooLong({ a: 'Back to sign in', b: 'Password must be at least {min} characters.' }),
    ).toEqual([]);
  });

  it('flags a message over 160 characters', () => {
    expect(tooLong({ a: `${'word '.repeat(33)}end.` })).toHaveLength(1);
  });

  it('measures every arm of a select', () => {
    const arm = 'word '.repeat(40);
    expect(tooLong({ a: `Hi. {m, select, sent {${arm}} other {${arm}}}` })).toHaveLength(2);
    expect(tooLong({ a: 'Hi. {m, select, sent {One.} other {Two.}}' })).toEqual([]);
    expect(renderings('A {n} b')).toEqual(['A x b']);
  });

  it('does not count e.g. as the end of a sentence', () => {
    expect(tooLong({ a: 'Use a name, e.g. billing. Then save it.' })).toEqual([]);
  });

  it('flags a message of three sentences', () => {
    expect(tooLong({ a: 'One. Two. Three.' })).toHaveLength(1);
  });
});

describe('every catalogue message', () => {
  it('is at most 160 characters and two sentences', async () => {
    const files = await cataloguesInSource();
    expect(files.length).toBeGreaterThan(0);
    const long: string[] = [];
    for (const file of files) {
      const module: unknown = await import(path.join(REPO_ROOT, file));
      for (const [name, entry] of Object.entries(module as Record<string, unknown>)) {
        if (isMessages(entry)) {
          long.push(...tooLong(entry).map((finding) => `${file} ${name} ${finding}`));
        }
      }
    }

    expect(long).toEqual([]);
  });
});
