import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { REPO_ROOT } from './markdown.js';

// A transcript that shows a response's headers and its whole JSON body quotes a
// `content-length`; the body's own bytes are what that must be. A body that
// gained a member (an error_description) once left two blocks claiming 25.
// Scoped to error bodies: a success body (a token response, a document) is
// often shown trimmed, so its quoted length is for bytes the page does not
// print, and only an error body is always printed whole.

const CONTENT = path.join(REPO_ROOT, 'apps/docs/content/en');

function pages(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return pages(full);
    return entry.name.endsWith('.md') ? [full] : [];
  });
}

interface Block {
  readonly line: number;
  readonly text: string;
}

function blocks(source: string): Block[] {
  const found: Block[] = [];
  const lines = source.split('\n');
  for (let i = 0; i < lines.length; i += 1) {
    if (!/^```\w*$/u.test(lines[i] ?? '')) continue;
    const start = i + 1;
    let end = start;
    while (end < lines.length && !(lines[end] ?? '').startsWith('```')) end += 1;
    found.push({ line: start + 1, text: lines.slice(start, end).join('\n') });
    i = end;
  }
  return found;
}

// The quoted length and the body, for a block that is a header list then one
// JSON document and nothing after it.
export function claim(block: string): { length: number; body: string } | null {
  const [head, ...rest] = block.split('\n\n');
  if (head === undefined || rest.length === 0 || !head.startsWith('HTTP/')) return null;
  const length = /^content-length: (\d+)$/mu.exec(head)?.[1];
  if (length === undefined || !/^content-type: application\/json/mu.test(head)) return null;
  const body = rest.join('\n\n').trimEnd();
  try {
    const parsed: unknown = JSON.parse(body);
    if (typeof parsed !== 'object' || parsed === null || !('error' in parsed)) return null;
  } catch {
    return null;
  }
  return { length: Number(length), body };
}

describe('the content-length a transcript quotes for a JSON body it shows whole', () => {
  it('is the number of bytes of that body', () => {
    const wrong: string[] = [];
    let checked = 0;
    for (const file of pages(CONTENT)) {
      for (const block of blocks(readFileSync(file, 'utf8'))) {
        const quoted = claim(block.text);
        if (quoted === null) continue;
        checked += 1;
        const bytes = Buffer.byteLength(quoted.body, 'utf8');
        if (bytes !== quoted.length) {
          wrong.push(
            `${path.relative(REPO_ROOT, file)}:${String(block.line)} says ${String(quoted.length)}, the body is ${String(bytes)}`,
          );
        }
      }
    }
    expect(wrong).toEqual([]);
    expect(checked).toBeGreaterThan(3);
  });

  it('notices a body that grew', () => {
    const stale =
      'HTTP/1.1 400 Bad Request\ncontent-type: application/json; charset=utf-8\ncontent-length: 25\n\n{"error":"invalid_grant","error_description":"The code or token is not valid."}';
    expect(claim(stale)).toEqual({
      length: 25,
      body: '{"error":"invalid_grant","error_description":"The code or token is not valid."}',
    });
    expect(Buffer.byteLength(claim(stale)?.body ?? '', 'utf8')).not.toBe(25);
  });
});
